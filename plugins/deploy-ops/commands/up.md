---
description: Start OWNAI stack with Docker Compose
---

# Deploy Up

Launch API, frontend, and PostgreSQL via docker compose.

## Phase 1: Preflight

- Verify Docker is running
- Check `.env` exists with JWT_SECRET set
- Confirm Vulkan drivers if using GPU container

## Phase 2: Build & Start

Run `docker compose up -d` from project root.

## Phase 3: Verify

- API: http://localhost:3000/api/v1/health
- Frontend: http://localhost:5173
- Swagger: http://localhost:3000/api-docs
