# AGENT.md (New Project Template)

Use this file in the new repo as `AGENT.md`.

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

## Commands (Example)

API:
```bash
npm run start:dev
```

Web:
```bash
npm run dev
```

DB:
```bash
docker compose up -d postgres
```

## Guardrails

- Do not hardcode local absolute paths.
- Do not couple frontend to internal model details.
- Keep API response stable once UI is integrated.
- Add migrations for every schema change.
