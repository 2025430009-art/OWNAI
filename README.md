# OWNAI — Local-first AI Platform

Full-stack AI platform powered by [QVAC SDK](https://docs.qvac.tether.io/) with a **plugin-based agent architecture** (format inspired by extensible CLI plugin systems — all implementation code is original).

## Architecture

```
OWN AI/
├── .ownai-plugin/marketplace.json   # Plugin marketplace manifest
├── .ownai/commands/                 # Project-level slash commands
├── ownai-core/                      # Plugin runtime + CLI (original)
├── plugins/                         # 6 official OWNAI plugins
│   ├── inference/
│   ├── rag-pipeline/
│   ├── voice-loop/
│   ├── model-ops/
│   ├── deploy-ops/
│   └── capability-dev/
├── backend/                         # Express + QVAC API
├── frontend/                        # React docs site + playground
└── mobile/                          # Expo on-device app
```

## Plugin System

Each plugin follows the OWNAI format:

| Layer | Format |
|-------|--------|
| **Commands** | Markdown + YAML frontmatter, phase-based (`## Phase 1:`) |
| **Agents** | Markdown with `name`, `description`, `color` frontmatter |
| **Skills** | `skills/*/SKILL.md` with auto-invoke metadata |
| **Hooks** | `hooks/hooks.json` for PreCommand / PostCommand events |

See [plugins/README.md](./plugins/README.md) for full documentation.

## Quick Start

### Local development

```bash
cd "/path/to/OWN AI"
cp .env.example .env
npm install

# Terminal 1 — start the backend API (default http://localhost:3000)
cd backend && npm run start

# Terminal 2 — start the frontend (default http://localhost:5176)
cd frontend && npm run dev
```

Open **http://localhost:5176** in your browser.

The frontend talks to the backend at `http://localhost:3000` by default. To use a different port, set `PORT` in `.env` and `VITE_API_URL` to match (e.g. `VITE_API_URL=http://localhost:3002`).

### GitHub Pages (static UI only)

The live demo at [GitHub Pages](https://2025430009-art.github.io/OWNAI/) hosts **only the frontend**. Chat works offline via the built-in prompt engine. Sign-in, attachments, and full AI inference require a backend.

**Options on GitHub Pages:**
1. **Chat offline** — works immediately, no setup needed
2. **Connect a remote backend** — use the "Connect backend" panel and enter your API URL (e.g. a tunnel to your local server)
3. **Bake in API URL at build time** — set the `VITE_API_URL` GitHub Actions secret to your deployed API origin

### Configuring the backend URL

| Method | When to use |
|--------|-------------|
| `VITE_API_URL` in `.env` | Local dev or CI build-time default |
| `VITE_API_URL` GitHub secret | GitHub Pages deploy with a remote API |
| Connect panel in the UI | Runtime override (saved in browser localStorage) |

### Deploy backend on Render (recommended for Pages)

This repo now includes a Render blueprint at `render.yaml` for the backend service.

1. In Render, create a **Blueprint** from this repository (or create a Web Service manually).
2. Ensure service points to:
   - `rootDir: backend`
   - build command: `npm install`
   - start command: `npm run start`
3. Set required environment variables in Render:
   - `DATABASE_URL`
   - `MONGODB_URI`
   - `API_KEY`
   - `JWT_SECRET` (auto-generated in blueprint)
   - Any model/API keys you use (`ANTHROPIC_API_KEY`, `STABILITY_API_KEY`, etc.)
4. Set `CORS_ORIGIN` to include your Pages origin:
   - `https://2025430009-art.github.io`
5. Copy your Render backend URL, e.g. `https://ownai-6pc9.onrender.com`
6. In GitHub repo settings, add Actions secret:
   - `VITE_API_URL=https://ownai-6pc9.onrender.com`
7. Re-run the **Deploy OWNAI** workflow (or push to `main`) so Pages is rebuilt with the backend URL.

After deploy, frontend calls `/api` to your Render backend and backend features become available on the live site.

Example `.env`:

```bash
VITE_API_URL=http://localhost:3000
PORT=3000
```

### CLI (optional)

```bash
npm run ownai:help
npm run ownai -- inference:run "Hello OWNAI"
npm run ownai -- rag-pipeline:query "What is RAG?"
npm run ownai -- model-ops:status
```

## Official Plugins

| Plugin | Commands |
|--------|----------|
| `inference` | `run`, `embed` |
| `rag-pipeline` | `ingest`, `query` |
| `voice-loop` | `loop` |
| `model-ops` | `load`, `status`, `unload` |
| `deploy-ops` | `up` |
| `capability-dev` | `scaffold` |

## API

- REST: `http://localhost:3000/api/v1`
- OpenAI-compatible: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/api-docs`
- Web UI: `http://localhost:5176`

## Requirements

- Node.js v22.17+
- Vulkan GPU drivers
- PostgreSQL (optional, for auth)

## Pre-deploy checklist

Before exposing the backend to the internet, verify every item below:

- Rotate `DATABASE_URL` credentials
- Set `JWT_SECRET` to 64+ random characters
- Set `NODE_ENV=production`
- Set `REQUIRE_API_AUTH=true`
- Set `CORS_ORIGIN` to your frontend URL only
- Set `SWAGGER_ENABLED=false` or guard with `SWAGGER_USER` / `SWAGGER_PASSWORD`

## License

Apache 2.0
