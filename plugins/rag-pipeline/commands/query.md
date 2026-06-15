---
description: Query the RAG knowledge base with natural language
argument-hint: Your question
---

# RAG Query

Retrieve relevant context and generate an answer.

## Phase 1: Search

Send query to RAG search endpoint with top_k=5.

Query: $ARGUMENTS

## Phase 2: Synthesize

Combine retrieved chunks with LLM completion for grounded answer.

## Phase 3: Cite Sources

Include source chunk references in the response.
