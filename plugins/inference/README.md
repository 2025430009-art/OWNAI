# Inference Plugin

Run LLM text generation and embeddings through the OWNAI QVAC backend.

## Commands

| Command | Description |
|---------|-------------|
| `/inference:run` | Generate text from a prompt |
| `/inference:embed` | Create vector embeddings |

## Agents

| Agent | Role |
|-------|------|
| `inference-tuner` | Latency and model configuration advisor |

## Usage

```bash
ownai inference:run "Summarize local-first AI in one paragraph"
ownai inference:embed "semantic search query"
```
