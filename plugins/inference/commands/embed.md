---
description: Generate vector embeddings for semantic search
argument-hint: Text to embed (pipe-separated for batch)
---

# Embedding Generation

Create vector embeddings for retrieval and clustering workflows.

## Phase 1: Input Validation

Ensure input text is non-empty. Split on `|` for batch embedding.

Input: $ARGUMENTS

## Phase 2: Execute

POST to `/api/v1/capabilities/text-embeddings/execute` with text payload.

## Phase 3: Output

Return embedding dimensions and vector count. Do not dump full vectors unless requested.
