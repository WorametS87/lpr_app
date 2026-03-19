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

- Documentation hub: [`md/README.md`](md/README.md)
- Team onboarding: [`md/guides/team-handoff.md`](md/guides/team-handoff.md)
- Service architecture: [`md/guides/system-flow.md`](md/guides/system-flow.md)
- Request walkthrough: [`md/guides/request-lifecycle.md`](md/guides/request-lifecycle.md)

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
- For local model stability, run model with:
  - `LPR_DEVICE=cpu`
  - `LPR_DEBUG_MODE=1` (enables debug crops/images)
- Model response includes per-detection source metadata (`plateSource`, `provinceSource`) and per-plate debug trace (`ocrTrace`).

## Workspace Docs

- [`apps/api/README.md`](apps/api/README.md)
- [`apps/web/README.md`](apps/web/README.md)
- [`packages/shared-types/README.md`](packages/shared-types/README.md)

## Useful Commands

```bash
npm run dev:stack       # postgres + api + web via docker compose
npm run dev:stack:down  # stop stack
npm run dev:api         # api only
npm run dev:web         # web only
```
