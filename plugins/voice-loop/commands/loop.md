---
description: Start a voice assistant pipeline (ASR → LLM → TTS)
argument-hint: Optional initial system prompt
---

# Voice Loop

Orchestrate the full voice pipeline on OWNAI.

## Phase 1: Audio Input

Accept audio via mobile app, file upload, or streaming WebSocket (roadmap).

System context: $ARGUMENTS

## Phase 2: Transcribe

Run Whisper/Parakeet ASR via `/api/v1/capabilities/transcription/execute`.

## Phase 3: Reason

Pass transcript to LLM generation with conversation history.

## Phase 4: Synthesize

Convert response to speech via GGML TTS backend.

## Phase 5: Deliver

Return transcript, text response, and audio_base64 to client.
