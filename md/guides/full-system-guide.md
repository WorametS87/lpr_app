# Full System Guide

Everything you need to understand, run, and explain the full Thai License Plate Recognition system.
Covers both repos: `lpr_new` (Python model server) and `lpr_app` (web app + API).

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Architecture Overview](#2-architecture-overview)
3. [How to Run Everything](#3-how-to-run-everything)
4. [The ML Pipeline — Stage by Stage](#4-the-ml-pipeline--stage-by-stage)
5. [Why ResNet18?](#5-why-resnet18)
6. [The Web App](#6-the-web-app)
7. [The NestJS API](#7-the-nestjs-api)
8. [The Database](#8-the-database)
9. [Shared Types Contract](#9-shared-types-contract)
10. [Environment Variables](#10-environment-variables)
11. [File Map](#11-file-map)
12. [Design Decisions](#12-design-decisions)
13. [Performance](#13-performance)
14. [Known Issues](#14-known-issues)
15. [Onboarding Checklist](#15-onboarding-checklist)

---

## 1. What This System Does

You upload a photo. The system finds every license plate in it, reads the plate number, and identifies the province. It also returns a full debug view of every step it took to reach that answer.

**User flow:**
1. Open the web app → drag-drop or browse for an image
2. Click Analyze
3. See: plate number, province, confidence scores
4. Optionally expand the Debug Panel to see every intermediate step

---

## 2. Architecture Overview

Three independent services communicate over HTTP:

```
┌─────────────────────────┐
│   Browser (React)       │  :5173  ← user interacts here
└──────────┬──────────────┘
           │ POST /v1/infer/image  (multipart/form-data)
           ▼
┌─────────────────────────┐
│   NestJS API            │  :3000  ← validates, stores, proxies
│   + PostgreSQL          │  :5432  ← stores every request + result
└──────────┬──────────────┘
           │ POST /infer  (multipart/form-data)
           ▼
┌─────────────────────────┐
│   Python FastAPI        │  :8000  ← runs all the ML models
│   (lpr_new)            │
└─────────────────────────┘
```

**Why 3 separate services?**

| Service | Language | Why separate |
|---------|----------|-------------|
| Frontend | TypeScript / React | Runs in browser — can't run Python |
| NestJS API | TypeScript / Node | Handles HTTP, file validation, database — keeps Python isolated |
| Python server | Python | ML libraries (PyTorch, EasyOCR, PaddleOCR) only exist in Python |

Each service can be restarted, debugged, or replaced independently.
The API is the bridge: it never exposes Python directly to the browser.

---

## 3. How to Run Everything

### Prerequisites

- Git
- Python 3.9+
- Node.js 20+ and npm 10+
- Docker + Docker Compose
- Model weight files (shared separately):
  - `weights/yolo100/yolo_100ep.pth`
  - `weights/classifier/best.pth` + `class_mapping.json`

### Step 1 — Clone both repos

```bash
cd ~/work
git clone <LPR_NEW_REPO_URL> lpr_new
git clone <LPR_APP_REPO_URL> lpr_app
```

### Step 2 — Start the Python model server

```bash
cd ~/work/lpr_new
bash scripts/setup.sh          # creates .venv and installs dependencies
bash scripts/check_runtime.sh  # verifies environment

# Start server (recommended flags for local dev)
LPR_DEVICE=cpu LPR_DEBUG_MODE=1 .venv/bin/uvicorn serve:app --host 0.0.0.0 --port 8000
```

Health check:
```bash
curl -sS http://localhost:8000/health
# Expected: {"status":"ok"}
```

### Step 3 — Start the web app stack

Open a new terminal:

```bash
cd ~/work/lpr_app
npm install
npm run dev:stack
```

This starts 3 services via Docker Compose:
- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

The API inside Docker reaches the model server at `http://host.docker.internal:8000` (maps to your host machine where Python is running).

Health check:
```bash
curl -sS http://localhost:3000/health
# Expected: {"status":"ok"}
```

### Step 4 — Test in browser

1. Open `http://localhost:5173`
2. Upload a Thai license plate photo
3. Click Analyze
4. Result dialog appears with plate number, province, confidence

### Stop everything

```bash
# Stop app stack
cd ~/work/lpr_app && npm run dev:stack:down

# Stop model server
Ctrl+C in the uvicorn terminal
```

---

## 4. The ML Pipeline — Stage by Stage

All ML work happens inside `lpr_new`. For every image, this pipeline runs:

```
Image in
  │
  ▼
[Stage 1] YOLOX — find all license plates → bounding boxes
  │
  ▼  (for each plate)
[Stage 2] Dewarp — perspective correction
  │
  ▼
[Stage 3] OCR — read the plate number
  │           (CLAHE → unsharp → EasyOCR/PaddleOCR/Hybrid)
  │           (15+ strategies: top70, full, rotations, fallback)
  │           (digit suffix repair + Thai prefix repair)
  ▼
[Stage 4] Province Classifier — ResNet18 on bottom 30% strip
  │           (fallback: bottom-strip OCR override)
  ▼
Result: plateNumber + province + confidence + debug artifacts
```

---

### Stage 1 — YOLOX: Find the Plates

YOLOX is a neural network trained to detect license plates. It scans the full image and outputs bounding boxes:

```
Output: [ [x1, y1, x2, y2, confidence], ... ]
         one entry per plate found
```

- Image is resized to max 1280px before detection (`LPR_MAX_SIZE`)
- Faster than older two-stage detectors (no region proposal step needed)
- Returns a confidence score per detection (0.0–1.0)

After this step you know *where* each plate is. Now you need to read it.

---

### Stage 2 — Perspective Dewarp (OpenCV)

CCTV cameras are mounted at angles. The plate in the photo looks like a parallelogram, not a rectangle. This step corrects that.

**How it works:**
1. Crop the plate region using the YOLOX bounding box (with a 3% inset to remove frame edges)
2. Convert to grayscale
3. Apply adaptive threshold to find strong edges
4. Detect the 4 corner points of the plate (find a quad shape)
5. Use `cv2.warpPerspective` to mathematically flatten it into a clean rectangle

```
Before:              After:
  ╱────────╲          ┌────────┐
 ╱  กข 1234 ╲   →    │ กข 1234│
╱____________╲         └────────┘
```

If no quad is found (plate too blurry or partially blocked), it falls back to the raw crop and continues.

Two dewarp modes are tried internally (dual-mask rotation + Canny edge detection) for robustness.

---

### Stage 3 — OCR: Read the Plate Number

#### Pre-processing (two modes)

Before OCR runs, the image is enhanced. Two modes:

| Mode | Steps | When used |
|------|-------|-----------|
| `clahe` (default) | Bilateral denoise → adaptive CLAHE → two-tier unsharp mask | Main OCR passes |
| `binarize` | Bilateral denoise → adaptive threshold → morphological close | Specific retry passes |

**CLAHE** (Contrast Limited Adaptive Histogram Equalization): Boosts local contrast per region. Fixes uneven lighting — headlights, shadows, night shots — without washing out the whole image.

**Unsharp mask**: Sharpens character edges so individual strokes of Thai characters are more distinct to OCR.

#### OCR Backends (3 choices)

Set via `LPR_OCR_BACKEND`:

| Backend | Value | How it works |
|---------|-------|-------------|
| **EasyOCR** | `easyocr` (default) | Neural network OCR, supports Thai natively |
| **PaddleOCR** | `paddle` | Alternative OCR engine from Baidu |
| **Hybrid** | `hybrid` | Runs **both**, picks the winner per plate |

**Why multiple backends?** EasyOCR sometimes merges tightly spaced digits (e.g., reads `732` as `72`). PaddleOCR uses a different architecture and may catch what EasyOCR misses. Hybrid mode runs both and picks the result with better structure + confidence.

In hybrid mode, the `ocrRegionUsed` field includes the backend as a prefix: e.g., `paddle:top70`, `easyocr:full`.

`LPR_PADDLE_FAST_MODE=1` (default on): PaddleOCR is slow on CPU with many retries. Fast mode skips expensive passes to keep web response times acceptable.

#### OCR Strategy (tries in order, stops at first valid result)

| Strategy | What it does |
|----------|-------------|
| `top70` | Top 70% of plate, strict format check |
| `full` | Full plate, strict format check |
| `top70_retry` | Top 70% rotated at ±3°, ±6°, ±10°, strict |
| `full_retry` | Full plate rotated at ±3°, ±6°, ±10°, strict |
| `top70_fallback` | Top 70%, soft check (any Thai + digits) |
| `full_fallback` | Full plate, soft check |
| `top70_retry_fallback` | Rotated + soft |
| `full_retry_fallback` | Rotated + soft |
| `none` | Nothing valid found |

**Why top 70% first?** Thai plates have the plate number on top and the province name at the bottom. Cutting the bottom 30% stops province text from interfering with reading the number.

**Why rotation retries?** Even after dewarp, plates still come in at slight angles. OCR reads horizontal text best, so small rotations (±3°, ±6°, ±10°) catch plates that would otherwise fail.

**Valid plate formats (strict check):**
- `กข1234` — 2 Thai letters + 4 digits (standard)
- `1กข1234` — 1 digit + 2 Thai + 4 digits (with province prefix)
- `ก1234` — 1 Thai + 4 digits (temporary plate)

#### Digit Suffix Repair

After the main OCR pass, if the digit count at the end is less than 4, `_repair_digit_suffix()` re-reads the digit portion using a digits-only allowlist. Tries 3 crop widths (right 65%, 75%, 55%) to recover dropped digits.

This targets the known issue where EasyOCR merges tightly spaced digits (`732` → `72`).

#### Thai Prefix Repair

`_repair_thai_prefix()` fixes misread Thai characters at the start of the plate number.

**How it works:**
1. Identifies the 1–2 Thai character prefix
2. Crops multiple windows from the left portion of the plate
3. Runs Thai-only OCR with both **greedy** and **beam search** decoders
4. Also runs on the raw (non-preprocessed) crop — preprocessing can hurt thin Thai strokes
5. Collects votes from all windows and decoder modes
6. Applies the correction only if:
   - Enough votes (`LPR_THAI_PREFIX_REPAIR_MIN_HITS` = 2)
   - High enough confidence (`LPR_THAI_PREFIX_REPAIR_MIN_CONF` = 0.55)
   - Sufficient margin over the original reading (`LPR_THAI_PREFIX_REPAIR_MARGIN` = 0.08)
   - Non-confusable character swaps require stronger evidence

#### OCR Debug Trace

When `LPR_DEBUG_MODE=1`, every OCR stage logs a trace step containing:
- Raw OCR tokens + confidence
- Extracted candidates (top 20)
- Confusion-expanded candidates (top 20)
- Pick result (winner or null)
- Preprocessed image for that stage
- Human-readable note

Trace is returned as `ocrTrace` in the API response and displayed in the web app's OCR Trace Panel.

---

### Stage 4 — Province Classifier (ResNet18)

The bottom 30% of the dewarped plate contains the province name printed in Thai. ResNet18 classifies that strip into one of 77 Thai provinces.

**Two competing methods:**

| Method | Source | When used |
|--------|--------|-----------|
| ResNet18 classifier | Trained model looks at the image | Primary |
| Bottom OCR override | EasyOCR reads the province strip as text | When classifier confidence < `LPR_BOTTOM_OCR_MAX_CLASSIFIER_CONF` (0.60) |

The `provinceSource` field in the response tells you which one was used: `"classifier"` or `"bottom_ocr"`.

**Red plates** (`isRedPlate: true`) skip province classification entirely — red government plates use a different format.

---

### Debug Artifacts Built Per Plate

After inference, `serve.py` builds the debug payload:

| Artifact | Description |
|----------|-------------|
| `annotatedImage` | Full image with YOLOX bounding boxes drawn (base64 JPEG) |
| `plateCrop` | Stage 1: raw YOLOX crop (base64) |
| `plateCropDewarped` | Stage 2: perspective-corrected (base64) |
| `plateCropTop70` | Stage 3: top 70% OCR region (base64) |
| `plateCropPreprocessed` | Stage 4: after CLAHE + unsharp mask (base64) |
| `plateCropInner` | Stage 5: province input crop (in payload but hidden in UI) |
| `plateCropBottom` | Stage 6: bottom 30% province strip (base64) |
| `ocrRawTokens` | Raw OCR character fragments + per-char confidence |
| `ocrRegionUsed` | Which strategy won (e.g. `top70`, `paddle:full`) |
| `provinceSource` | `"classifier"` or `"bottom_ocr"` |
| `ocrTrace` | Per-stage OCR trace (see above) |
| `timings` | `resize_ms`, `inference_ms`, `total_ms` |

All images are base64-encoded JPEG — embedded directly in the JSON response, no separate image storage needed.

#### Server Warmup

On startup, `serve.py` runs `_warmup_pipeline()`:
1. Sends a blank image through YOLOX detector
2. Sends a region through ResNet18 classifier
3. Renders a synthetic `"กข 1234"` and runs OCR on it

This absorbs PyTorch's first-use initialization stall so real requests don't feel the delay.

Disable with `LPR_WARMUP_ON_START=0`.

---

## 5. Why ResNet18?

ResNet = **Residual Network**. "18" = 18 layers deep.

### The Problem It Solves

Early deep networks suffered from **vanishing gradients**. When training, the error signal flows backward through layers — but it fades to near-zero before reaching early layers. Those layers stop learning. Making networks deeper actually made them worse.

### ResNet's Solution — Skip Connections

```
Input ──┬──► [Conv Layer] ──► [Conv Layer] ──► + ──► Output
        │                                      ▲
        └──────────────────────────────────────┘
                    (skip connection)
```

The skip connection adds the input directly to the output of a block. The gradient can flow straight backward through the skip — it never vanishes. This is why ResNet made it possible to train very deep networks successfully.

### Why ResNet**18** Specifically?

| Model | Parameters | Speed on CPU |
|-------|-----------|-------------|
| ResNet18 | 11M | Fast |
| ResNet50 | 25M | Medium |
| ResNet101 | 44M | Slow |

The province classification task is not hard:
- 77 classes (one per Thai province)
- Small input (~200px wide province strip)
- Patterns are visually distinct

ResNet18 is sufficient, runs fast on CPU, loads quickly. No GPU required.

**How it processes the province strip:**
1. Input: bottom 30% of the dewarped plate image
2. Convolutional layers extract features (edges → shapes → patterns)
3. Skip connections ensure clean gradient flow
4. Final fully-connected layer outputs 77 scores (one per province)
5. Softmax → probability distribution → pick highest

Two classifier versions exist in the repo:
- `weights/classifier/` — trained at 32×128px input (current default)
- `weights/classifier_64x256/` — larger resolution (in training)

---

## 6. The Web App

**Repo:** `lpr_app/apps/web`
**Stack:** React 18 + Vite + TypeScript + Material-UI

### Folder Structure

```
apps/web/src/
├── main.tsx                        ← React entry point (9 lines)
├── App.tsx                         ← MUI ThemeProvider + router (14 lines)
├── router/index.tsx                ← Renders InferencePage (7 lines)
├── pages/
│   └── InferencePage.tsx           ← The one and only page (63 lines)
├── controllers/
│   └── useInferenceController.ts   ← All state + business logic (86 lines)
├── services/
│   ├── inference.service.ts        ← Calls /v1/infer/image (12 lines)
│   ├── apiService.ts               ← Generic HTTP wrapper (43 lines)
│   └── api/axios.ts                ← Axios instance config (19 lines)
├── components/
│   ├── features/
│   │   ├── UploadPanel.tsx         ← Drag-drop file input (92 lines)
│   │   ├── ResultDialog.tsx        ← Shows results (72 lines)
│   │   ├── DebugPanel.tsx          ← 5 pipeline stage images + timings (318 lines)
│   │   └── OcrTracePanel.tsx       ← Per-strategy OCR detail (246 lines)
│   └── common/
│       └── DebugImage.tsx          ← Image viewer + resolution display (33 lines)
├── types/inference.ts              ← ResultDialogState type (17 lines)
├── constants/index.ts              ← API endpoints + OCR strategy labels (15 lines)
├── theme/index.ts                  ← MUI colors (18 lines)
└── utils/parseErrorMessage.ts      ← Normalizes error strings (21 lines)
```

### Pattern: Thin Components, Fat Controller

`useInferenceController.ts` owns all state and logic:
- State: `selectedFile`, `isDragging`, `isAnalyzing`, `errorMessage`, `previewUrl`, `dialogState`
- Handlers: `onDropFile`, `onAnalyze`, `closeDialog`

UI components just receive props and render. They contain no business logic.

### Upload Flow

1. User drops or selects a file (JPG/PNG/WEBP, max 5MB)
2. Preview thumbnail shows immediately
3. Click Analyze → `onAnalyze()` packages file into `FormData`, calls API
4. Spinner shows while waiting
5. Result dialog opens with plate number, province, confidence

### The Debug Panel

Shows every internal step the ML pipeline took:

```
TIMINGS
└── resize_ms | inference_ms | total_ms

ANNOTATED FRAME
└── Full photo with bounding boxes drawn

Per Detection:
  FINAL OUTPUT
  └── Plate number, Province, OCR strategy used, Province source,
      OCR confidence %, Province confidence %

  FULL PROCESS
  ├── Step 1: YOLOX confidence, red plate flag
  ├── Step 2: 5 pipeline stage images side-by-side
  │          (raw crop → dewarped → top70 → preprocessed → province strip)
  ├── Step 3: OCR — raw token table (character + confidence %)
  ├── Step 3.5: OcrTracePanel — which strategies ran and what they found
  └── Step 4: Province source + bottom OCR score
```

Each debug image shows its pixel resolution (captured from `onLoad` naturalWidth/Height).

### Axios FormData Trick

When sending `FormData`, you must NOT manually set `Content-Type: multipart/form-data`. The browser must set it because it includes the `boundary` parameter separating each form field. The axios interceptor in `api/axios.ts` removes the Content-Type header for FormData requests specifically for this reason.

### OCR Strategy Labels (constants/index.ts)

| Key | Label |
|-----|-------|
| `top70` | top 70% — strict valid (fastest) |
| `full` | full plate — strict valid |
| `top70_retry` | top 70% rotation retry — strict valid |
| `full_retry` | full plate rotation retry — strict valid |
| `top70_fallback` | top 70% — soft fallback |
| `full_fallback` | full plate — soft fallback |
| `top70_retry_fallback` | top 70% rotation retry — soft fallback |
| `full_retry_fallback` | full plate rotation retry — soft fallback |
| `none` | no valid text found |

---

## 7. The NestJS API

**Repo:** `lpr_app/apps/api`
**Stack:** NestJS 10 + TypeORM + PostgreSQL + Axios

### Folder Structure

```
apps/api/src/
├── main.ts                         ← NestJS bootstrap (23 lines)
├── app.module.ts                   ← TypeORM + module wiring (25 lines)
├── infer/
│   ├── infer.controller.ts         ← POST /v1/infer/image (35 lines)
│   ├── infer.service.ts            ← Core logic (106 lines)
│   └── infer.module.ts             ← Wires controller + service (13 lines)
├── health/
│   └── health.controller.ts        ← GET /health → { status: 'ok' } (9 lines)
├── database/
│   ├── data-source.ts              ← TypeORM config (15 lines)
│   ├── entities/
│   │   ├── inference-request.entity.ts
│   │   └── detection.entity.ts
│   └── migrations/
│       └── 20260226160000-InitInferenceTables.ts  ← production migration
└── common/filters/
    └── http-exception.filter.ts    ← Global error handler (39 lines)
```

### Request Flow Through the API

```
POST /v1/infer/image
  │
  ▼ infer.controller.ts
  Validate: file type (jpg/jpeg/png/webp) + size (≤5MB)
  → 422 Unprocessable Entity if invalid
  │
  ▼ infer.service.ts
  1. INSERT inference_requests row (status='success')
  2. POST image to http://[MODEL_SERVER_URL]/infer
  3. Parse Python response
  4. INSERT detection rows (one per plate found)
  5. Return InferenceResponse to frontend
  │
  (if step 2 or 3 fails)
  UPDATE inference_requests SET status='failed', error_message=...
  → throw 500 Internal Server Error
```

### Error Handling

Every unhandled exception returns the same JSON structure (via global `HttpExceptionFilter`):
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "timestamp": "2026-03-02T...",
  "path": "/v1/infer/image"
}
```

No raw stack traces exposed to the client.

### Optimistic DB Write

The `inference_requests` row is created with `status='success'` **before** calling the model server. If the model server fails, the row is updated to `status='failed'`. This ensures there is always a record of every request attempt, even when inference crashes.

---

## 8. The Database

Two tables, auto-created with `TYPEORM_SYNC=true` during development.
A proper migration file exists for production: `20260226160000-InitInferenceTables.ts`.

### `inference_requests` — one row per upload

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| file_name | varchar(255) | Original filename |
| created_at | timestamptz | Auto-set |
| status | varchar(16) | `'success'` or `'failed'` (CHECK constraint) |
| error_message | text | Filled if status='failed', otherwise null |

### `detections` — one row per plate found

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| request_id | UUID | FK → inference_requests (CASCADE delete) |
| plate_number | varchar(32) | e.g. `กข1234`, nullable |
| province | varchar(128) | e.g. `กรุงเทพมหานคร`, nullable |
| ocr_conf | float | 0.0–1.0, nullable |
| province_conf | float | 0.0–1.0, nullable |
| bbox_json | jsonb | `[x1, y1, x2, y2]` |

One image → one `inference_requests` row → zero or more `detections` rows.

---

## 9. Shared Types Contract

**File:** `lpr_app/packages/shared-types/src/index.ts`

Used by **both** `apps/web` and `apps/api`. If you change a type here, TypeScript catches mismatches in both apps at compile time.

```
InferenceResponse
├── requestId: string               UUID of the DB row
├── message: string                 "2 plates detected" or "No plate detected"
├── detections: DetectionResult[]
│   └── plateNumber: string | null
│       province: string | null
│       ocrConf: number             0.0–1.0
│       provinceConf: number        0.0–1.0
│       plateSource?: string        which OCR strategy won
│       provinceSource?: string     "classifier" or "bottom_ocr"
│       bbox: [x1, y1, x2, y2]
└── debugInfo: DebugInfo
    ├── annotatedImage: string      base64 JPEG, full image with boxes
    ├── timings: { resize_ms, inference_ms, total_ms }
    └── plates: PlateDebug[]
        ├── detectionIndex: number
        ├── plateCrop               Stage 1: raw YOLOX crop (base64)
        ├── plateCropDewarped       Stage 2: perspective corrected (base64)
        ├── plateCropTop70          Stage 3: top 70% OCR region (base64)
        ├── plateCropPreprocessed   Stage 4: CLAHE + unsharp (base64)
        ├── plateCropInner          Stage 5: province input (in payload, hidden in UI)
        ├── plateCropBottom         Stage 6: bottom 30% province strip (base64)
        ├── ocrRegionUsed           which strategy won
        ├── isRedPlate              red plates skip province classification
        ├── ocrRawTokens[]          { text, conf } per OCR character
        ├── detectionConf           YOLOX detection confidence
        ├── provinceSource          "classifier" or "bottom_ocr"
        ├── bottomOcrProvince
        ├── bottomOcrScore
        └── ocrTrace: OcrTraceStep[]
```

**Python↔TypeScript naming:** Python returns snake_case (`ocr_tokens`, `pick_result`). TypeScript expects camelCase. `OcrTraceStep` accepts both spellings. The `OcrTracePanel` component has helper functions (`readTokens()`, `readPickResult()`, etc.) that check both and return whichever exists.

---

## 10. Environment Variables

### lpr_new (Model Server)

| Variable | Default | Description |
|----------|---------|-------------|
| `LPR_DEVICE` | auto | Force device: `cpu`, `cuda` (avoid `mps` — crashes YOLOX) |
| `LPR_OCR_BACKEND` | `easyocr` | OCR engine: `easyocr`, `paddle`, or `hybrid` |
| `LPR_DEBUG_MODE` | `0` | `1` = include debug images/crops in response |
| `LPR_WARMUP_ON_START` | `1` | Warm models at startup to avoid first-request stall |
| `LPR_DETECTOR_CKPT` | `weights/yolo100/yolo_100ep.pth` | YOLOX checkpoint |
| `LPR_DETECTOR_EXP` | `weights/thai_plate_exp.py` | YOLOX experiment config |
| `LPR_CLASSIFIER_DIR` | `weights/classifier` | Province classifier directory |
| `LPR_MAX_SIZE` | `1280` | Downscale large input images |
| `LPR_OCR_MIN_HEIGHT` | `220` | Upscale plate crop if smaller than this |
| `LPR_OCR_CANVAS_SIZE` | `1024` | OCR canvas size |
| `LPR_OCR_RETRY_ANGLES` | `-10,-6,-3,3,6,10` | Rotation angles to try |
| `LPR_ENABLE_SLOW_PATHS` | `0` | Extra OCR passes (slower, more recovery) |
| `LPR_ALWAYS_BOTTOM_OCR` | `0` | Force bottom-strip province OCR every time |
| `LPR_BOTTOM_OCR_MAX_CLASSIFIER_CONF` | `0.60` | Run bottom OCR when classifier conf below this |
| `LPR_PADDLE_FAST_MODE` | `1` | Leaner retry profile for PaddleOCR on CPU |
| `LPR_THAI_PREFIX_REPAIR_MIN_CONF` | `0.55` | Min confidence for Thai prefix repair |
| `LPR_THAI_PREFIX_REPAIR_MIN_HITS` | `2` | Min vote count for Thai prefix repair |
| `LPR_THAI_PREFIX_REPAIR_MARGIN` | `0.08` | Min margin over original prefix to apply fix |

### lpr_app — API (apps/api/.env)

```
PORT=3000
CORS_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lpr
DB_USER=lpr
DB_PASSWORD=lpr
TYPEORM_SYNC=true
MODEL_SERVER_URL=http://localhost:8000
```

Inside Docker Compose: `MODEL_SERVER_URL=http://host.docker.internal:8000`

### lpr_app — Web (apps/web/.env)

```
VITE_API_BASE_URL=http://localhost:3000
```

---

## 11. File Map

```
lpr_app/                              ← web app monorepo (npm workspaces)
├── apps/
│   ├── api/                          ← NestJS backend
│   │   └── src/
│   │       ├── main.ts               ← server bootstrap
│   │       ├── app.module.ts         ← DB + module wiring
│   │       ├── infer/
│   │       │   ├── infer.controller.ts  ← POST /v1/infer/image
│   │       │   └── infer.service.ts     ← model proxy + DB writes
│   │       ├── database/entities/
│   │       │   ├── inference-request.entity.ts
│   │       │   └── detection.entity.ts
│   │       └── health/health.controller.ts  ← GET /health
│   └── web/                          ← React frontend
│       └── src/
│           ├── pages/InferencePage.tsx
│           ├── controllers/useInferenceController.ts
│           ├── services/inference.service.ts
│           └── components/features/
│               ├── UploadPanel.tsx
│               ├── ResultDialog.tsx
│               ├── DebugPanel.tsx
│               └── OcrTracePanel.tsx
├── packages/
│   └── shared-types/src/index.ts     ← shared TypeScript types (API contract)
└── infra/docker-compose.yml          ← Postgres + API + Web stack

lpr_new/                              ← ML pipeline (Python)
├── serve.py                          ← FastAPI server + warmup
└── src/
    ├── pipeline.py                   ← YOLOX + OCR + ResNet18 + debug trace
    ├── detection/                    ← YOLOX detector wrapper
    ├── province/                     ← ResNet18 province classifier
    └── ocr/                          ← OCR utilities and helpers
```

---

## 12. Design Decisions

| Decision | Why |
|----------|-----|
| 3-service split | Browser = JS only, ML = Python only — they can't share a process |
| Monorepo with shared-types | Type errors caught at compile time, not at runtime |
| Top 70% crop before OCR | Province text at the bottom confuses digit reading |
| 15+ OCR strategies | Real CCTV plates vary: angle, distance, lighting — one strategy fails too often |
| ResNet18 (not 50/101) | 77 classes, small input image — lightweight is sufficient, runs on CPU |
| Two province sources | ResNet18 + OCR fallback — redundancy improves accuracy |
| Thai prefix repair | OCR misreads Thai characters; voting-based multi-window re-read fixes them |
| Digit suffix repair | EasyOCR merges tight digits; re-reading with digits-only allowlist recovers them |
| Hybrid OCR backend | Different engines fail differently — running both catches more plates |
| CLAHE preprocessing | Handles uneven CCTV lighting without retraining models |
| Base64 debug images in JSON | No blob storage, no extra HTTP requests, self-contained response |
| Optimistic DB write | Always records the attempt even if the model server crashes |
| Server warmup on startup | PyTorch lazy-inits on first use — warmup absorbs the stall |
| TYPEORM_SYNC=true | Fast development iteration; switch to migration for production |
| FormData Content-Type removed | Browser must set the boundary in multipart headers — removing it is correct |
| host.docker.internal in Docker | Containers reach the model server running on the host machine |

---

## 13. Performance

| Step | CPU | GPU (CUDA) |
|------|-----|-----------|
| EasyOCR (main bottleneck) | 1–3s | <0.3s |
| PaddleOCR | Similar to EasyOCR on CPU | <0.3s |
| ResNet18 province | 0.1–0.3s | <0.05s |
| YOLOX detection | 0.3–0.8s | <0.1s |
| CLAHE + dewarp + repair | <0.1s | <0.1s |
| **Total (typical)** | **2–5s** | **<0.5s** |

OCR is the bottleneck. Retry paths (rotations, digit repair, prefix repair) add time.

The system defaults to `LPR_DEVICE=cpu` — works on any machine. Switch to `LPR_DEVICE=cuda` if a GPU is available. Avoid `mps` (Apple Silicon) — YOLOX crashes in this setup.

Warmup absorbs ~1–2s of first-request stall at startup.

---

## 14. Known Issues

| Issue | Status |
|-------|--------|
| Dropped digits (732→72) | EasyOCR merges tightly spaced digits. Multi-crop repair in place; scale variation (1.5x/2x upscale) and Tesseract second-opinion planned |
| Thai char misread (ษ→บ, ศ→ส, ฒ→ฝ) | Thai prefix repair system in place; thresholds need tuning against known test cases |
| NISSAN dealer frame | Chrome frame text confuses OCR. 3% inset trim partially helps |
| Tiny plates (<120×80px) | Skip dewarp — too few pixels to find reliable corners |
| Province classifier accuracy | Not yet formally measured |

**Known test cases (do not hardcode):**

| Plate | Currently reads | Expected | Problem |
|-------|----------------|----------|---------|
| ศษ 732 | ศบ 72 | ศษ 732 | Dropped digit + Thai misread ษ→บ |
| ศศ 8899 | ศส 8899 | ศศ 8899 | Thai misread ศ→ส |
| ฒอ 1896 | ฝอ 1896 | ฒอ 1896 | Thai misread ฒ→ฝ |

**Revert point** (before Thai prefix repair experiments):
```bash
cd ~/work/lpr_new
git stash apply stash@{1}
```

---

## 15. Onboarding Checklist

- [ ] Both repo URLs shared
- [ ] Weight files shared: `yolo_100ep.pth`, `best.pth`, `class_mapping.json`
- [ ] `http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] `http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] Browser upload flow works end-to-end
- [ ] Debug panel shows pipeline stage images (requires `LPR_DEBUG_MODE=1`)

### Common Issues

| Symptom | Fix |
|---------|-----|
| Inference fails in UI | Model server down, wrong `MODEL_SERVER_URL`, or missing weight files |
| API 500 with `torch.mps.FloatTensor` | Restart model with `LPR_DEVICE=cpu` |
| Web cannot reach API | Wrong `VITE_API_BASE_URL` or API not running |
| API cannot connect to DB | Postgres container not running |
| `ModuleNotFoundError: yolox` | Re-run `bash scripts/setup.sh` in `lpr_new` |
| Debug panel shows only timings | Model started without `LPR_DEBUG_MODE=1` |
| Detection count higher than expected | Count is plate candidates, not car count — false positives happen |
