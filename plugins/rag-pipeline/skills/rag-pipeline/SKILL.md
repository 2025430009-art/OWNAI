---
name: RAG Pipeline
description: Use when building retrieval-augmented generation workflows with OWNAI — ingest, chunk, embed, search, and query document collections.
version: 1.0.0
---

# RAG Pipeline Skill

## When to Use

- User asks to index documents for Q&A
- Building knowledge base features
- Semantic search over private data

## OWNAI RAG Flow

1. **Ingest** — `ragIngest()` or segregated chunk → embed → save
2. **Search** — `ragSearch()` with query and topK
3. **Answer** — `completion()` with retrieved context prepended

## API Endpoints

```bash
# Ingest
POST /api/v1/capabilities/rag/execute
{ "action": "ingest", "documents": ["..."] }

# Query
POST /api/v1/capabilities/rag/execute
{ "action": "query", "query": "..." }
```

## CLI

```bash
ownai rag-pipeline:ingest "doc one|doc two|doc three"
ownai rag-pipeline:query "What are the main topics?"
```
