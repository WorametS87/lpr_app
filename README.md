# lpr_app

Monorepo for Thai LPR web application.

## Stack

- Backend: NestJS + TypeORM + PostgreSQL
- Frontend: React + Vite + MUI

## Services

- `apps/api`: API (`POST /v1/infer/image`, `GET /health`)
- `apps/web`: Web UI for image upload and detection result
- `packages/shared-types`: shared TypeScript types

## Setup Docs

- Full teammate setup (recommended): `TEAM_SETUP.md`
- System walkthrough: `HOW_IT_WORKS.md`

## Quick Start

```bash
npm install
npm run dev:stack
```

Open: http://localhost:5173

Notes:
- API default URL is `http://localhost:3000`
- Model server must be reachable at `MODEL_SERVER_URL`
- Non-Docker API default: `http://localhost:8000`
- Docker stack default: `http://host.docker.internal:8000`

## Useful Commands

```bash
npm run dev:stack       # postgres + api + web via docker compose
npm run dev:stack:down  # stop stack
npm run dev:api         # api only
npm run dev:web         # web only
```
