---
description: Run LLM text generation against the OWNAI backend
argument-hint: Prompt text to send to the model
---

# Inference Run

Execute a text generation request through the OWNAI QVAC pipeline.

## Core Principles

- **Local-first**: Inference runs on your hardware via @qvac/sdk
- **Validate connectivity**: Confirm API health before heavy requests
- **Measure latency**: Report duration from the capability response

---

## Phase 1: Preflight

**Goal**: Verify the inference backend is reachable

**Actions**:
1. Check `/api/v1/health` returns healthy
2. Confirm at least one model is available in cache or registry
3. Abort with clear error if API is offline

---

## Phase 2: Execute

**Goal**: Generate completion for user prompt

Initial prompt: $ARGUMENTS

**Actions**:
1. Send POST to `/api/v1/generate` with prompt and sensible defaults
2. Capture output text and metadata (duration_ms)
3. Return structured JSON result

---

## Phase 3: Report

**Goal**: Present results clearly

**Actions**:
1. Print generated text
2. Log token count and latency if available
3. Suggest `/model-ops:status` if output quality seems degraded
