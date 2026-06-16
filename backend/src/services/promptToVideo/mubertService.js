import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export function isMubertAvailable() {
  return Boolean(config.promptToVideo?.mubertApiKey);
}

const MOOD_TAGS = {
  epic: 'epic orchestral cinematic',
  calm: 'ambient calm peaceful',
  dramatic: 'dramatic tension cinematic',
  inspiring: 'uplifting inspirational orchestral',
};

async function writeDemoMusic(outputPath, mood, durationSec = 300) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const ffmpegPath = (await import('ffmpeg-static')).default;
  const exec = promisify(execFile);

  const freq = mood === 'calm' ? 110 : mood === 'dramatic' ? 165 : 130;
  await exec(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', `sine=frequency=${freq}:duration=${durationSec}`,
    '-af', 'volume=0.2,lowpass=f=2000',
    '-c:a', 'libmp3lame',
    '-t', String(durationSec),
    outputPath,
  ], { maxBuffer: 10 * 1024 * 1024 });

  return outputPath;
}

export async function generateMusic(mood, musicStyle, outputPath, durationSec = 300) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (!isMubertAvailable()) {
    logger.info('PromptToVideo: demo background music', { mood });
    return writeDemoMusic(outputPath, mood, durationSec);
  }

  const tag = MOOD_TAGS[mood] || MOOD_TAGS.epic;
  const response = await fetch('https://api-b2b.mubert.com/v2/GetTrack', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'GetTrack',
      params: {
        pat: config.promptToVideo.mubertApiKey,
        duration: durationSec,
        format: 'mp3',
        mode: 'track',
        tags: `${tag}, ${musicStyle || 'orchestral'}`,
      },
    }),
  });

  if (!response.ok) {
    logger.warn('Mubert unavailable, using demo music');
    return writeDemoMusic(outputPath, mood, durationSec);
  }

  const data = await response.json();
  const trackUrl = data?.data?.tasks?.[0]?.result?.download_link
    || data?.data?.link
    || data?.link;

  if (!trackUrl) {
    return writeDemoMusic(outputPath, mood, durationSec);
  }

  const audioResponse = await fetch(trackUrl);
  if (!audioResponse.ok) {
    return writeDemoMusic(outputPath, mood, durationSec);
  }

  await fs.writeFile(outputPath, Buffer.from(await audioResponse.arrayBuffer()));
  return outputPath;
}
