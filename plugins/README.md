# OWNAI Plugins

Plugin ecosystem for the OWNAI local-first AI platform. Inspired by extensible agent/plugin architecture patterns — **all code and content here is original to OWNAI**.

## What are OWNAI Plugins?

Plugins extend OWNAI with slash commands, specialized agents, skills, and lifecycle hooks. Each plugin is a self-contained module that connects to the QVAC-powered backend via `ownai-core`.

## Plugins in This Directory

| Name | Description | Contents |
|------|-------------|----------|
| [inference](./inference/) | LLM text generation and embeddings | **Commands:** `run`, `embed` · **Agent:** `inference-tuner` |
| [rag-pipeline](./rag-pipeline/) | Document ingest and RAG query | **Commands:** `ingest`, `query` · **Agent:** `rag-indexer` · **Skill:** `rag-pipeline` |
| [voice-loop](./voice-loop/) | ASR → LLM → TTS pipeline | **Command:** `loop` · **Agent:** `voice-engineer` · **Hooks:** PreCommand |
| [model-ops](./model-ops/) | Model cache lifecycle | **Commands:** `load`, `status`, `unload` · **Agent:** `cache-optimizer` |
| [deploy-ops](./deploy-ops/) | Docker deployment | **Command:** `up` · **Agent:** `deploy-architect` |
| [capability-dev](./capability-dev/) | Scaffold new capabilities | **Command:** `scaffold` · **Agent:** `capability-architect` · **Skill:** `capability-dev` |

## Plugin Structure

```
plugin-name/
├── .ownai-plugin/
│   └── plugin.json          # Plugin metadata
├── commands/                # Slash commands (Markdown + YAML frontmatter)
├── agents/                  # Specialist agent definitions
├── skills/                  # Auto-invoked skills (SKILL.md)
├── hooks/                   # Lifecycle hooks (hooks.json)
└── README.md
```

## Command Format

Commands use **phase-based Markdown** with YAML frontmatter:

```markdown
---
description: Short summary
argument-hint: Args description
---

# Command Title

## Phase 1: Discovery
**Goal**: ...

## Phase 2: Execute
...
```

## CLI Usage

```bash
cd ownai-core && npm install
node bin/ownai.js help
node bin/ownai.js inference:run "Hello OWNAI"
node bin/ownai.js rag-pipeline:query "What is local-first AI?"
node bin/ownai.js model-ops:status
node bin/ownai.js plugin list
```

Requires the OWNAI backend running at `http://localhost:3000`.

## Marketplace

All plugins are registered in [`.ownai-plugin/marketplace.json`](../.ownai-plugin/marketplace.json).
