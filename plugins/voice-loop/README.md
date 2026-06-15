# Voice Loop Plugin

Real-time voice assistant: transcription → generation → speech synthesis.

## Command

`/voice-loop:loop` — Run the full voice pipeline

## Requirements

Configure in `.env`:
- `WHISPER_MODEL_SRC`
- `TTS_MODEL_SRC`
- `LLM_MODEL_SRC`

Test on physical mobile device via Expo (emulators not supported).
