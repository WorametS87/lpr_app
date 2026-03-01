# Team Setup Guide (Install + Run)

This guide is for teammates who want to run the project locally from scratch.

## What this repo includes

- Web app: `apps/web` (React + Vite)
- API: `apps/api` (NestJS + TypeORM)
- Shared types: `packages/shared-types`
- Local PostgreSQL compose file: `infra/docker-compose.yml`

Important: this repo does **not** contain the Python model implementation itself. The API calls a model server at `MODEL_SERVER_URL` (default `http://localhost:8000`).

## Architecture

1. Browser uploads image to Web app (`:5173`)
2. Web calls API `POST /v1/infer/image` (`:3000` by default)
3. API calls model server `/infer` (`:8000` by default)
4. API stores request/result in PostgreSQL (`:5432`)

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- Docker Desktop (or Docker Engine + Compose)
- Access to an LPR model server (run locally or use shared team endpoint)

## 1) Clone and install

```bash
git clone <YOUR_REPO_URL>
cd lpr_app
npm install
```

## 2) Configure environment files

### API env

```bash
cp apps/api/.env.example apps/api/.env
```

Default `apps/api/.env.example`:

```env
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

### Web env

```bash
cp apps/web/.env.example apps/web/.env
```

Default `apps/web/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

If API port changes (example to `3001`), update both:

- `apps/api/.env` -> `PORT=3001`
- `apps/web/.env` -> `VITE_API_BASE_URL=http://localhost:3001`

## 3) Start PostgreSQL

```bash
docker compose -f infra/docker-compose.yml up -d postgres
```

Check container:

```bash
docker ps | rg lpr-postgres
```

## 4) Start model server (required)

Choose one option.

### Option A: run local Python model service

Run your team model repo/service so it exposes:

- `GET /health`
- `POST /infer`

Default expected URL is `http://localhost:8000`.

### Option B: use shared team model endpoint

Set `MODEL_SERVER_URL` in `apps/api/.env` to your team URL, for example:

```env
MODEL_SERVER_URL=http://10.0.0.25:8000
```

## 5) Start API and Web

Open 2 terminals from repo root.

Terminal 1 (API):

```bash
npm run dev:api
```

Terminal 2 (Web):

```bash
npm run dev:web
```

Open web app:

- http://localhost:5173

## 5A) One-command full stack (recommended for teammates)

From repo root:

```bash
npm run dev:stack
```

This starts:

- PostgreSQL (`:5432`)
- API (`:3000`)
- Web (`:5173`)

Stop the stack:

```bash
npm run dev:stack:down
```

### Model server URL when using Docker stack

In Docker mode, API default is:

```env
MODEL_SERVER_URL=http://host.docker.internal:8000
```

If your model server is elsewhere, override at startup:

```bash
MODEL_SERVER_URL=http://10.0.0.25:8000 npm run dev:stack
```

## 6) Quick health checks

API health:

```bash
curl -sS http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

If you run API on `3001`, call `http://localhost:3001/health` instead.

## 7) Test inference endpoint manually (optional)

```bash
curl -sS -X POST http://localhost:3000/v1/infer/image \
  -F "file=@/absolute/path/to/test-image.jpg"
```

Expected: JSON with `requestId`, `detections`, `message`, and `debugInfo`.

## Common issues

- `ECONNREFUSED 127.0.0.1:5432`
  - PostgreSQL is not running. Start docker compose for `postgres`.

- `Inference failed` from API
  - Model server is not running, wrong URL, or model server crashed.
  - Verify `MODEL_SERVER_URL` and model server `/health`.

- Browser CORS error
  - Update `CORS_ORIGIN` in `apps/api/.env` to match web URL (usually `http://localhost:5173`).

- Upload rejected (422)
  - Allowed types: `jpg`, `jpeg`, `png`, `webp`
  - Max upload size: `5 MB`

- Web cannot reach API
  - Check `VITE_API_BASE_URL` in `apps/web/.env` and ensure API port matches.

## Commands reference

From repo root:

```bash
npm run dev:stack   # start full stack via docker
npm run dev:stack:down
npm run dev:api     # start NestJS API
npm run dev:web     # start React app
npm run build:api   # build API
npm run build:web   # build web
```

## What to share with new teammates

1. This repo URL
2. Model service instructions/repo (or shared endpoint URL)
3. Required `.env` values (send privately if sensitive)
4. This file (`TEAM_SETUP.md`)
