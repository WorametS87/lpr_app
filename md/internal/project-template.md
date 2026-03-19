# Project Template

Legacy internal template kept for reference. This is not the onboarding path for the current `lpr_app` repo.

## Project Goal

Build a simple LPR web app:
- User uploads/drops a CCTV-captured image.
- Backend runs LPR inference.
- UI shows popup message with result.

V1 is upload-only. Live CCTV streaming is out of scope for now.

## Locked Stack

- Backend: NestJS
- ORM: TypeORM
- DB: PostgreSQL
- Frontend: React + MUI

## V1 Scope

In scope:
- Single image upload
- Synchronous inference API
- Result popup: plate number, province, confidence
- Store request/result records in DB

Out of scope:
- RTSP/live camera stream
- Queue workers
- Auth/SSO
- Multi-user roles

## Suggested Repo Structure

```text
new-lpr-webapp/
├── apps/
│   ├── api/                  # NestJS
│   └── web/                  # React + MUI
├── packages/
│   └── shared-types/         # Shared DTO/types (optional)
├── infra/
│   └── docker-compose.yml    # api + web + postgres
└── AGENT.md
```

## API Contract (V1)

### `POST /v1/infer/image`

- Request: `multipart/form-data`
  - `file`: image
- Response:
```json
{
  "requestId": "uuid",
  "detections": [
    {
      "plateNumber": "1กฆ1753",
      "province": "กรุงเทพมหานคร",
      "ocrConf": 0.84,
      "provinceConf": 0.99,
      "bbox": [100, 200, 300, 260]
    }
  ],
  "message": "1 plate detected"
}
```

### `GET /health`
- Response: `{ "status": "ok" }`

## Database (TypeORM) - V1 Tables

1. `inference_requests`
- `id` (uuid, pk)
- `file_name`
- `created_at`
- `status` (`success|failed`)
- `error_message` (nullable)

2. `detections`
- `id` (uuid, pk)
- `request_id` (fk -> inference_requests.id)
- `plate_number` (nullable)
- `province` (nullable)
- `ocr_conf` (nullable)
- `province_conf` (nullable)
- `bbox_json` (json)

## Frontend (React + MUI) V1 UX

Single page:
- Drag/drop image area
- Analyze button
- Result Dialog (MUI):
  - Title: `Detection Result`
  - Body: plate/province/confidence
  - Actions: Close

If no detection:
- Show warning dialog: `No plate detected`

## Backend Rules

- Keep controller thin; put inference logic in service.
- Validate file type and max file size.
- Return consistent error payloads.
- Use env vars for model paths and DB settings.

## Definition of Done (V1)

- Upload image works from UI.
- API returns detection payload in <= 2s for one image (local target).
- Result popup shown for success/failure.
- Request + detection rows written to PostgreSQL.
- Health endpoint passes.

## How to Run

### Prerequisites
- Docker running with the `lpr-postgres` container (port 5432)
- `lpr_new` project with `.venv` set up

### Step 1 — Model server (from `lpr_new/`)
```bash
cd ~/work/lpr_new
.venv/bin/uvicorn serve:app --host 0.0.0.0 --port 8000 --reload --reload-dir src --reload-dir . --reload-include "*.py"
```
Loads `ThaiLPRPipeline` (YOLOX + OCR + province classifier) once at startup.
Exposes `POST /infer` and `GET /health` on port **8000**.

### Step 2 — NestJS API (from `lpr_app/`)
```bash
cd ~/work/lpr_app
PORT=3001 npm run dev:api
```
Port 3001 is used because port 3000 is occupied by `lcams-backend`.
Reads `MODEL_SERVER_URL` from `apps/api/.env` (default: `http://localhost:8000`).

### Step 3 — Frontend (from `lpr_app/`)
```bash
cd ~/work/lpr_app
npm run dev:web
```
Reads `VITE_API_BASE_URL` from `apps/web/.env` (set to `http://localhost:3001`).
Opens at **http://localhost:5173**.

### Service map
| Service | Port | Notes |
|---|---|---|
| Frontend (Vite) | 5173 | React + MUI |
| NestJS API | 3001 | NestJS + TypeORM |
| FastAPI model server | 8000 | ThaiLPRPipeline |
| PostgreSQL | 5432 | Docker container `lpr-postgres` |

## Guardrails

- Do not hardcode local absolute paths.
- Do not couple frontend to internal model details.
- Keep API response stable once UI is integrated.
- Add migrations for every schema change.
