---
description: Scaffold a new AI capability across backend and frontend
argument-hint: capability-slug-name
---

# Capability Scaffold

Add a new AI capability to the OWNAI platform following the plugin architecture.

Target slug: $ARGUMENTS

## Phase 1: Define

- Title, description, modelType, backend label
- Input/output schema for execute endpoint
- Demo type for frontend modal

## Phase 2: Backend

1. Add entry to `backend/src/data/capabilities.js`
2. Implement handler in `backend/src/services/capabilityService.js`
3. Register in `execute()` handler map

## Phase 3: Frontend

1. Add to `frontend/src/data/capabilities.js`
2. Add icon mapping in `AICapabilities.jsx`
3. Extend `CapabilityDemo.jsx` if new input type

## Phase 4: Plugin (optional)

Create `plugins/<slug>/` with command and agent for the workflow.

## Phase 5: Document

Update README API table and Examples page.
