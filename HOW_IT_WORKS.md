# How It Works — Thai LPR Web App

This document explains the full system from a user uploading an image to getting a result back. Written so you can explain it to your team without needing to read the code.

---

## The Big Picture

There are **3 running services** talking to each other:

```
Browser (React UI)
    │  upload image
    ▼
NestJS API  :3001        ← TypeScript / Node.js backend
    │  forward image
    ▼
FastAPI Model Server  :8000   ← Python / ML backend
    │
    ▼
ThaiLPRPipeline (YOLOX + OCR + Classifier)
    │
    └── PostgreSQL  :5432   ← stores every request + result
```

The frontend talks only to NestJS. NestJS talks to the Python model server. The Python server is the only thing that knows about the ML models.

---

## Step-by-Step: What Happens When You Click "Analyze"

### 1. Frontend sends the image
File: [apps/web/src/App.tsx](apps/web/src/App.tsx)

The browser packages the image into a `multipart/form-data` request and POSTs it to:
```
POST http://localhost:3001/v1/infer/image
```

While waiting, it shows a spinner. The button is disabled.

---

### 2. NestJS validates and records the request
Files: [apps/api/src/infer/infer.controller.ts](apps/api/src/infer/infer.controller.ts) → [apps/api/src/infer/infer.service.ts](apps/api/src/infer/infer.service.ts)

The controller checks:
- File type must be JPG / PNG / WEBP
- File size must be under 5 MB

If it passes, the service immediately writes a row to the `inference_requests` table in PostgreSQL with status `"success"` (optimistic — updated to `"failed"` later if something goes wrong).

---

### 3. NestJS forwards the image to the Python model server
File: [apps/api/src/infer/infer.service.ts](apps/api/src/infer/infer.service.ts)

NestJS re-packages the image and POSTs it to:
```
POST http://localhost:8000/infer
```

---

### 4. Python pipeline processes the image
Files: [lpr_new/serve.py](../lpr_new/serve.py) → [lpr_new/src/pipeline.py](../lpr_new/src/pipeline.py)

This is where all the ML work happens. The pipeline runs in 4 stages per detected plate:

#### Stage 1 — YOLOX Detection
The YOLOX model scans the full image and finds bounding boxes around license plates. It returns `[x1, y1, x2, y2, confidence]` for each detected plate region.

#### Stage 2 — Dewarp (Perspective Correction)
`_dewarp_plate()` in pipeline.py

Real CCTV images are rarely straight-on. The plate might be at an angle. This step:
1. Converts the crop to grayscale
2. Applies adaptive threshold to find the plate border
3. Finds the 4-corner contour (quad) of the plate
4. Uses `cv2.warpPerspective` to "flatten" the plate into a rectangle

If no clean quad is found, the crop is passed through unchanged.

#### Stage 3 — OCR (Plate Number)
`_best_plate_text()` in pipeline.py

EasyOCR reads the text from the plate. It tries multiple strategies in order, stopping as soon as it finds a valid result:

| Attempt | What it tries |
|---|---|
| 1 | Top 70% of plate (cuts out province text at bottom) |
| 2 | Full plate |
| 3–14 | Rotated versions at -10°, -6°, -3°, +3°, +6°, +10° (both top70 and full) |
| 15+ | Soft fallback (any text with Thai chars + digits) |

Before OCR, the image is enhanced with:
- **CLAHE** — adaptive contrast boost (makes faint characters visible)
- **Unsharp mask** — sharpens character edges

Valid Thai plate formats it accepts:
- `กข1234` — 2 Thai + 4 digits (standard)
- `1กข1234` — 1 digit + 2 Thai + 4 digits (standard with province prefix)
- `ก1234` — 1 Thai + 4 digits (temporary)

#### Stage 4 — Province Classifier
`ProvinceClassifier` in pipeline.py

A ResNet18 model trained to classify the province from the bottom portion of the plate (the line with the province name). Returns province name + confidence score.

Skipped for **red plates** (temporary/transit plates) — those are detected by checking if the plate's dominant color is red in HSV space.

---

### 5. Debug artifacts are built
File: [lpr_new/serve.py](../lpr_new/serve.py) — `_run_inference()`

After inference, serve.py builds visual debug data:
- **Annotated frame** — full image with bounding boxes drawn
- **4 pipeline stage images** per plate (raw crop → dewarped → top70% → preprocessed)
- **OCR tokens** — raw text fragments EasyOCR saw with confidence scores
- **Timings** — how many ms each step took

All images are encoded as base64 JPEGs so they can be sent in JSON.

---

### 6. NestJS saves results and returns response
File: [apps/api/src/infer/infer.service.ts](apps/api/src/infer/infer.service.ts)

NestJS receives the JSON response from Python and:
1. Saves each detected plate as a row in the `detections` table (linked to the original request row)
2. Returns the full response to the browser

---

### 7. Frontend shows the result
File: [apps/web/src/App.tsx](apps/web/src/App.tsx)

A dialog pops up showing:
- Plate number
- Province
- OCR confidence / province confidence
- A collapsible **Debug Info** section with all the pipeline stage images

---

## What's Stored in the Database

Two tables, auto-created on first run (`TYPEORM_SYNC=true`):

### `inference_requests`
One row per uploaded image.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique ID for this request |
| file_name | text | Original filename |
| created_at | timestamp | When it was uploaded |
| status | text | `"success"` or `"failed"` |
| error_message | text | Error details if failed |

### `detections`
One row per detected plate per image.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique ID |
| request_id | UUID | Links back to `inference_requests.id` |
| plate_number | text | e.g. `กข1234` |
| province | text | e.g. `กรุงเทพมหานคร` |
| ocr_conf | float | 0.0–1.0 |
| province_conf | float | 0.0–1.0 |
| bbox_json | JSONB | `[x1, y1, x2, y2]` |

---

## Shared Types

File: [packages/shared-types/src/index.ts](packages/shared-types/src/index.ts)

This file defines TypeScript types used by **both** the frontend and the NestJS backend. It's the contract that ensures both sides agree on what the API response looks like.

Key type: `InferenceResponse` — what NestJS returns to the browser:
```typescript
{
  requestId: string          // UUID of the DB row
  detections: [{
    plateNumber: string | null
    province: string | null
    ocrConf: number
    provinceConf: number
    bbox: [x1, y1, x2, y2]
  }]
  message: string            // "1 plate detected"
  debugInfo: { ... }         // all the debug images and timings
}
```

---

## Configuration

### apps/api/.env
```
PORT=3001                              # NestJS API port
CORS_ORIGIN=http://localhost:5173      # Allow requests from frontend
DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD   # PostgreSQL connection
TYPEORM_SYNC=true                      # Auto-create DB tables on startup
MODEL_SERVER_URL=http://localhost:8000 # Where to find the Python model server
```

### apps/web/.env
```
VITE_API_BASE_URL=http://localhost:3001   # Where to find the NestJS API
```

### lpr_new model server (env vars, optional)
```
LPR_DEVICE=cpu              # or 'cuda' if you have a GPU
LPR_DETECTOR_CKPT=weights/yolo100/yolo_100ep.pth
LPR_DETECTOR_EXP=weights/thai_plate_exp.py
LPR_CLASSIFIER_DIR=weights/classifier
LPR_MAX_SIZE=1280           # resize input frames larger than this before inference
```

---

## File Map

```
lpr_app/                              ← web app monorepo
├── apps/
│   ├── api/                          ← NestJS backend (TypeScript)
│   │   └── src/
│   │       ├── main.ts               ← starts the server
│   │       ├── app.module.ts         ← wires DB + modules together
│   │       ├── infer/
│   │       │   ├── infer.controller.ts  ← handles HTTP, validates file
│   │       │   └── infer.service.ts     ← calls model server, saves to DB
│   │       ├── database/
│   │       │   └── entities/
│   │       │       ├── inference-request.entity.ts
│   │       │       └── detection.entity.ts
│   │       └── health/
│   │           └── health.controller.ts  ← GET /health
│   └── web/                          ← React frontend (TypeScript)
│       └── src/
│           └── App.tsx               ← entire UI: upload, analyze, results, debug panel
└── packages/
    └── shared-types/
        └── src/index.ts              ← shared TypeScript types (API contract)

lpr_new/                              ← ML pipeline project (Python)
├── serve.py                          ← FastAPI server wrapping the pipeline
└── src/
    ├── pipeline.py                   ← core ML pipeline (YOLOX + OCR + classifier)
    ├── detection/                    ← YOLOX detector wrapper
    ├── province/                     ← ResNet18 province classifier
    └── ocr/                          ← OCR utilities
```

---

## Why 3 Separate Services?

| Service | Language | Why separate |
|---|---|---|
| Frontend | TypeScript/React | Runs in browser, can't run Python |
| NestJS API | TypeScript/Node | Handles HTTP, DB, auth — keeps Python isolated |
| Python model server | Python | ML libraries (PyTorch, EasyOCR) only work in Python |

The NestJS API acts as a proxy — it receives uploads from the browser, forwards to Python, gets results, saves to DB, and returns a clean response. The frontend never talks directly to Python.

---

## Common Questions

**Why does it take a few seconds?**
EasyOCR is the slowest part. It runs a neural network to read text. On CPU it takes 2–5s. On a GPU it would be under 0.5s. The pipeline tries multiple strategies (rotations, retries) which can add more time.

**What does "top 70%" mean?**
Thai license plates have two lines: the plate number on top and the province name on the bottom. By cropping to the top 70%, we stop the province text from confusing the OCR that's reading the number.

**What is CLAHE?**
Contrast Limited Adaptive Histogram Equalization. It boosts local contrast in the image so faint or washed-out plate characters become more visible to OCR. It works per-region rather than on the whole image, so it handles uneven lighting well.

**What is dewarp?**
If a plate is shot at an angle (common in gate cameras), the characters appear distorted. Dewarp detects the 4 corners of the plate and applies a perspective transform to make it look like you're viewing the plate straight-on.

**What happens if no plate is found?**
The pipeline returns an empty `detections` array. The UI shows "No plate detected". The request is still saved in the DB with `status="success"` and 0 detection rows.
