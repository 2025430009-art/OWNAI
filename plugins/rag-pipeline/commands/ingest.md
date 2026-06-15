---
description: Ingest documents into the RAG vector store
argument-hint: Documents separated by pipe (|)
---

# RAG Ingest

Index documents for retrieval-augmented generation.

## Phase 1: Prepare Documents

Parse $ARGUMENTS as pipe-separated document chunks. Minimum 1 document required.

## Phase 2: Ingest

POST to `/api/v1/capabilities/rag/execute` with `action: ingest` and documents array.

## Phase 3: Verify

Report processed count. Suggest reindex if collection exceeds 16 documents.
