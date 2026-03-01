# lpr_app

Monorepo for a simple LPR web app.

## Stack
- Backend: NestJS + TypeORM + PostgreSQL
- Frontend: React + MUI

## Structure
- `apps/api`: NestJS API (`POST /v1/infer/image`, `GET /health`)
- `apps/web`: React + MUI client for upload and result dialog
- `packages/shared-types`: Shared TypeScript types
- `infra`: docker compose for local services

## Quick Start
1. Install dependencies at repo root:
   ```bash
   npm install
   ```
2. Start PostgreSQL:
   ```bash
   docker compose -f infra/docker-compose.yml up -d postgres
   ```
3. Start API and Web in separate terminals:
   ```bash
   npm run dev:api
   npm run dev:web
   ```

## Database Schema Mode
- API uses TypeORM entity synchronization by default (`TYPEORM_SYNC=true`).
- No migration step is required for local development.
