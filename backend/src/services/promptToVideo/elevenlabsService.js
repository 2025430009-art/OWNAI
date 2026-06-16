import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export function isElevenLabsAvailable() {
  return Boolean(config.promptToVideo?.elevenLabsApiKey && config.promptToVideo?.elevenLabsVoiceId);
}

async function writeDemoVoice(outputPath, text, durationSec = 30) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const ffmpegPath = (await import('ffmpeg-static')).default;
  const exec = promisify(execFile);

  const safeText = (text || 'Narration').slice(0, 40).replace(/'/g, '');
  await exec(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', `sine=frequency=220:duration=${durationSec}`,
    '-af', `volume=0.15`,
    '-c:a', 'libmp3lame',
    '-t', String(durationSec),
    outputPath,
  ], { maxBuffer: 10 * 1024 * 1024 });

  return outputPath;
}

export async function generateVoiceover(text, outputPath, durationSec = 30) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (!isElevenLabsAvailable()) {
    logger.info('PromptToVideo: demo voiceover');
    return writeDemoVoice(outputPath, text, durationSec);
  }

  const voiceId = config.promptToVideo.elevenLabsVoiceId;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': config.promptToVideo.elevenLabsApiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ElevenLabs error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}
