# API (NestJS)

Backend service for LPR inference.

## Endpoints

- `GET /health`
- `POST /v1/infer/image` (`multipart/form-data`, field name: `file`)

Upload validation:
- file type: `jpg`, `jpeg`, `png`, `webp`
- max size: `5 MB`

## Environment

Copy template:

```bash
cp apps/api/.env.example apps/api/.env
```

Main variables:

- `PORT` (default `3000`)
- `CORS_ORIGIN` (default `http://localhost:5173`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `TYPEORM_SYNC` (default `true` for local dev)
- `MODEL_SERVER_URL` (default `http://localhost:8000`)

## Run (from repo root)

```bash
npm run dev:api
```

Or run full stack:

```bash
npm run dev:stack
```

## Health check

```bash
curl -sS http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```
