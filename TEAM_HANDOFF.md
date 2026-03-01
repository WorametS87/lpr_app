# TEAM_HANDOFF.md

Single source of truth for onboarding teammates to run the full system:
- `lpr_new` (Python model server)
- `lpr_app` (API + Web app)

Keep this file identical in both repositories.

System architecture reference:
- `SYSTEM_FLOW.md` (in `lpr_app`)

## 0) Recent modifications (March 2026)

- Added one-command app stack in `lpr_app`:
  - `npm run dev:stack` (web + api + postgres)
  - `npm run dev:stack:down`
- Docker stack API now defaults to `MODEL_SERVER_URL=http://host.docker.internal:8000`.
- Debug UI in web app was expanded:
  - debug is grouped per detection (not mixed across plates)
  - each detection shows `FINAL OUTPUT` + `FULL PROCESS`
  - every debug image shows resolution (`width x height`)
  - OCR strategy label reflects OCR path used by model
- Model debug payload now includes and web consumes:
  - `plateCropInner` (province input crop, not shown in UI)
  - `plateCropBottom`
  - `provinceSource`, `bottomOcrProvince`, `bottomOcrScore`
  - `detectionIndex`
  - model response `detections[]` also includes `plateSource` and `provinceSource`
- Model runtime profile updated for stability:
  - use `LPR_DEVICE=cpu` (current `mps` path can crash YOLOX in this setup)
  - use `LPR_DEBUG_MODE=1` to return debug images/crops

## 1) What teammates need

Public repos:
- `lpr_new` repo URL
- `lpr_app` repo URL

Private files to share separately:
- `weights/yolo100/yolo_100ep.pth`
- `weights/classifier/best.pth`

Optional private config (only if not using local defaults):
- custom `MODEL_SERVER_URL`
- custom DB credentials

## 2) Prerequisites

- Git
- Python 3.9+
- Node.js 20+
- npm 10+
- Docker + Docker Compose

## 3) Clone both repos

```bash
cd ~/work
git clone <LPR_NEW_REPO_URL> lpr_new
git clone <LPR_APP_REPO_URL> lpr_app
```

## 4) Setup and run model server (`lpr_new`)

```bash
cd ~/work/lpr_new
bash scripts/setup.sh
bash scripts/check_runtime.sh
LPR_DEVICE=cpu LPR_DEBUG_MODE=1 .venv/bin/uvicorn serve:app --host 0.0.0.0 --port 8000
```

Model health check:

```bash
curl -sS http://localhost:8000/health
```

Expected:

```json
{"status":"ok"}
```

## 5) Setup and run app stack (`lpr_app`)

Open a new terminal:

```bash
cd ~/work/lpr_app
npm install
npm run dev:stack
```

This starts:
- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Postgres: `localhost:5432`

API health check:

```bash
curl -sS http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

## 6) Browser test

1. Open `http://localhost:5173`
2. Upload a plate image
3. Click Analyze

## 7) Environment defaults

`lpr_new`:
- model server at `http://localhost:8000`
- recommended local flags:
  - `LPR_DEVICE=cpu`
  - `LPR_DEBUG_MODE=1`

`lpr_app`:
- API port `3000`
- `apps/api/.env` should use `MODEL_SERVER_URL=http://localhost:8000`
- `apps/web/.env` should use `VITE_API_BASE_URL=http://localhost:3000`

## 8) Common issues

- Inference fails in UI/API:
  - model server down, wrong `MODEL_SERVER_URL`, or missing model files.
- Inference fails with API `500` and model traceback mentions `torch.mps.FloatTensor`:
  - restart model with `LPR_DEVICE=cpu`.
- Web cannot reach API:
  - wrong `VITE_API_BASE_URL` or API not running.
- API cannot connect DB:
  - Postgres container not running.
- `ModuleNotFoundError: yolox` in model server:
  - rerun `bash scripts/setup.sh` in `lpr_new`.
- Debug panel shows only timings:
  - model started without `LPR_DEBUG_MODE=1`.
- Detection count looks higher than expected:
  - count is plate candidates, not car count; false positives can happen.

## 9) Stop services

Stop app stack:

```bash
cd ~/work/lpr_app
npm run dev:stack:down
```

Stop model server:
- `Ctrl+C` in uvicorn terminal.

## 10) Handoff checklist

- Both repo URLs shared
- Private model files shared
- `http://localhost:8000/health` returns OK
- `http://localhost:3000/health` returns OK
- Browser upload flow works end-to-end
