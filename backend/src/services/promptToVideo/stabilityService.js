import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const STYLE_SUFFIX = ', cinematic, 8k, professional photography, dramatic lighting, film quality, 16:9 aspect ratio';

export function isStabilityAvailable() {
  return Boolean(config.promptToVideo?.stabilityApiKey);
}

async function writeDemoImage(outputPath, sceneNumber) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const ffmpegPath = (await import('ffmpeg-static')).default;
  const exec = promisify(execFile);

  const hue = (sceneNumber * 36) % 360;
  await exec(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=hue=${hue}:s=0.4:b=0.15:s=1920x1080:d=1`,
    '-frames:v', '1',
    outputPath,
  ], { maxBuffer: 10 * 1024 * 1024 });

  return outputPath;
}

export async function generateImage(visualDescription, outputPath, sceneNumber = 1) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (!isStabilityAvailable()) {
    logger.info('PromptToVideo: demo image', { sceneNumber });
    return writeDemoImage(outputPath, sceneNumber);
  }

  const response = await fetch(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.promptToVideo.stabilityApiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{
          text: `${visualDescription}${STYLE_SUFFIX}`,
          weight: 1,
        }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Stability AI error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const artifact = data.artifacts?.[0];
  if (!artifact?.base64) {
    throw new Error('Stability AI returned no image');
  }

  await fs.writeFile(outputPath, Buffer.from(artifact.base64, 'base64'));
  return outputPath;
}
