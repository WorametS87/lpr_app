# Team Quickstart (Copy/Paste)

Use this file if you just want to run everything without reading long docs.

## 0) Prerequisites

- Git
- Node.js 20+
- npm 10+
- Docker
- Python environment for `lpr_new`

## 1) Clone both repos

```bash
cd ~/work
git clone <LPR_APP_REPO_URL> lpr_app
git clone <LPR_MODEL_REPO_URL> lpr_new
```

## 2) Start model server (`lpr_new`)

Use the model repo's normal setup/install steps, then run:

```bash
cd ~/work/lpr_new
.venv/bin/uvicorn serve:app --host 0.0.0.0 --port 8000 --reload
```

Check model health:

```bash
curl -sS http://localhost:8000/health
```

Expected: healthy response from model service.

## 3) Start app stack (`lpr_app`)

Open a new terminal:

```bash
cd ~/work/lpr_app
npm install
npm run dev:stack
```

This starts:
- Web: http://localhost:5173
- API: http://localhost:3000
- Postgres: localhost:5432

## 4) Verify API

```bash
curl -sS http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

## 5) Test from browser

1. Open http://localhost:5173
2. Upload an image
3. Click Analyze

## If model server is not on your machine

Run stack with model URL override:

```bash
cd ~/work/lpr_app
MODEL_SERVER_URL=http://<MODEL_HOST>:8000 npm run dev:stack
```

## Stop everything

- Stop app stack:

```bash
cd ~/work/lpr_app
npm run dev:stack:down
```

- Stop model server: `Ctrl+C` in model terminal.

## Most common failure

- `Inference failed` in UI/API usually means model server is down or wrong URL.
