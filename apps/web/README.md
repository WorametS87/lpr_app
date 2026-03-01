# Web (React + Vite + MUI)

Frontend for image upload and viewing LPR results.

## Environment

Copy template:

```bash
cp apps/web/.env.example apps/web/.env
```

Main variable:

- `VITE_API_BASE_URL` (default `http://localhost:3000`)

## Run (from repo root)

```bash
npm run dev:web
```

Or run full stack:

```bash
npm run dev:stack
```

Open:

- http://localhost:5173

## Notes

- Ensure API is running and reachable at `VITE_API_BASE_URL`.
- If API runs on another port (example `3001`), update `apps/web/.env`.
