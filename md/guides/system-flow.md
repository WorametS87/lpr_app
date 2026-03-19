# System Flow

This document explains how `lpr_app` and `lpr_new` work together end-to-end.

## Projects

- `lpr_app`: web + API + PostgreSQL
- `lpr_new`: Python model server (YOLOX + OCR + province classifier)

## Architecture

```text
User Browser
  └─> lpr_app/apps/web (Vite React) :5173
       └─> lpr_app/apps/api (NestJS) :3000
            ├─> PostgreSQL :5432 (request/result storage)
            └─> lpr_new/serve.py (FastAPI) :8000
                 └─> ThaiLPRPipeline (detection + OCR + province)
```

## Request Flow

1. User uploads image in web UI (`apps/web`).
2. Web sends `POST /v1/infer/image` to NestJS API.
3. API validates file (type/size) and creates request row in Postgres.
4. API forwards image to model server `POST /infer`.
5. Model server runs pipeline and returns:
   - `detections` (includes `plateSource`, `provinceSource`)
   - `debugInfo` (annotated image + per-plate debug crops/timings)
6. API stores detection rows in Postgres.
7. API returns final JSON to web UI.
8. Web shows result dialog + debug panel.

## Debug Flow

Model (`lpr_new`) produces debug payload fields such as:
- `detectionIndex`
- `plateCrop`, `plateCropDewarped`, `plateCropTop70`, `plateCropPreprocessed`
- `plateCropInner` (province input crop)
- `plateCropBottom`
- `ocrRegionUsed`
- `provinceSource`, `bottomOcrProvince`, `bottomOcrScore`
- `ocrTrace` (per-stage OCR decision trace)

Web (`lpr_app`) renders debug by `detectionIndex` so each debug block stays with its own detection.
UI currently shows 5 visual stages and hides `plateCropInner`.
When detailed crops are missing, web still shows final-output sources from `detections[]`.

## Startup Order

Recommended order:

1. Start model server (`lpr_new`) on `:8000` with stable local flags:
   - `LPR_DEVICE=cpu`
   - `LPR_DEBUG_MODE=1`
2. Start app stack (`lpr_app`) with `npm run dev:stack`
3. Open `http://localhost:5173`

Health checks:

```bash
curl -sS http://localhost:8000/health
curl -sS http://localhost:3000/health
```

## Config Mapping

- `lpr_app/apps/api/.env`
  - `MODEL_SERVER_URL=http://localhost:8000` (local)
- Docker stack fallback in `lpr_app`:
  - `MODEL_SERVER_URL=http://host.docker.internal:8000`
- `lpr_app/apps/web/.env`
  - `VITE_API_BASE_URL=http://localhost:3000`
- `lpr_new` runtime flags (recommended local):
  - `LPR_DEVICE=cpu`
  - `LPR_DEBUG_MODE=1`

## Failure Boundaries

- If model server is down: API returns inference failure, UI shows error.
- If model runs on unsupported `mps` path in this setup: model may return 500.
- If Postgres is down: API cannot persist requests/detections.
- If API is down: web cannot analyze.
- If web is down: backend can still be tested with curl/Postman.
