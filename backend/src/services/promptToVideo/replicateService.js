import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const SVD_VERSION = '3f0457e4619daac51203dedb1a4f33847b18b138a89a719a9a4d3b0a2a2c0b6a';

export function isReplicateAvailable() {
  return Boolean(config.promptToVideo?.replicateApiKey);
}

async function pollPrediction(getUrl, apiKey, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const response = await fetch(getUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Replicate poll error (${response.status})`);
    }
    const data = await response.json();
    if (data.status === 'succeeded') return data;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(data.error || `Replicate job ${data.status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Replicate prediction timed out');
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download video (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function imageToKenBurnsClip(imagePath, outputPath, scene, durationSec = 30) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const ffmpegPath = (await import('ffmpeg-static')).default;
  const exec = promisify(execFile);

  const frames = Math.max(24, Math.round(durationSec * 24));
  const motion = scene?.cameraAngle?.includes('zoom')
    ? `zoompan=z='min(zoom+0.0015,1.5)':d=${frames}:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=1920x1080:fps=24`
    : `zoompan=z='min(zoom+0.0008,1.3)':d=${frames}:x='if(lte(on,1),0,x+1)':y=ih/2-(ih/zoom/2):s=1920x1080:fps=24`;

  await exec(ffmpegPath, [
    '-y',
    '-loop', '1',
    '-i', imagePath,
    '-vf', `${motion},format=yuv420p`,
    '-t', String(durationSec),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ], { maxBuffer: 20 * 1024 * 1024 });

  return outputPath;
}

export async function generateVideoClip(imagePath, scene, outputPath, durationSec = 30) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (!isReplicateAvailable()) {
    logger.info('PromptToVideo: demo clip (Ken Burns)', { scene: scene?.sceneNumber });
    return imageToKenBurnsClip(imagePath, outputPath, scene, durationSec);
  }

  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.promptToVideo.replicateApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: SVD_VERSION,
      input: {
        input_image: dataUri,
        video_length: '25_frames_with_svd_xt',
        sizing_strategy: 'maintain_aspect_ratio',
        frames_per_second: 6,
        motion_bucket_id: 127,
        cond_aug: 0.02,
        decoding_chunk_size: 8,
      },
    }),
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text().catch(() => '');
    logger.warn('Replicate failed, falling back to Ken Burns', { err: errText.slice(0, 200) });
    return imageToKenBurnsClip(imagePath, outputPath, scene, durationSec);
  }

  const created = await createResponse.json();
  const result = await pollPrediction(
    created.urls.get,
    config.promptToVideo.replicateApiKey,
  );

  const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!videoUrl) {
    return imageToKenBurnsClip(imagePath, outputPath, scene, durationSec);
  }

  await downloadFile(videoUrl, outputPath);

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const ffmpegPath = (await import('ffmpeg-static')).default;
  const exec = promisify(execFile);

  const scaledPath = `${outputPath}.scaled.mp4`;
  await exec(ffmpegPath, [
    '-y', '-i', outputPath,
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
    '-t', String(durationSec),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    scaledPath,
  ], { maxBuffer: 20 * 1024 * 1024 });
  await fs.rename(scaledPath, outputPath);

  return outputPath;
}
