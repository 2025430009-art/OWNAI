---
description: Warm-load the default LLM into cache
argument-hint: Optional model key
---

# Model Load

Pre-load a model into the OWNAI cache to reduce first-request latency.

Model key: $ARGUMENTS (default: default)

## Phase 1: Check Cache

GET `/api/v1/models` — skip load if already cached.

## Phase 2: Warmup

Trigger lightweight generation to force model load.

## Phase 3: Confirm

Report load time and modelId from cache status.
