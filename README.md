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

```bash
cd "/home/system21/Downloads/OWN AI"
cp .env.example .env
npm install

# Start API
npm run dev

# Start web UI (separate terminal)
npm run dev:frontend

# CLI — list plugins & run commands
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
- Web UI: `http://localhost:5173`

## Requirements

- Node.js v22.17+
- Vulkan GPU drivers
- PostgreSQL (optional, for auth)

## License

Apache 2.0
