import path from 'path';
import { generateScript } from './scriptService.js';
import { generateImage } from './stabilityService.js';
import { generateVoiceover } from './elevenlabsService.js';
import { combineImagesWithAudio, generateVideoThumbnail } from './ffmpegService.js';
import {
  createJob,
  updateJob,
  PROMPT_TO_VIDEO_DIRS,
  ensurePromptToVideoDirs,
} from './videoJobStore.js';
import { VIDEO_GENERATION_STEPS } from '../../data/promptToVideoSteps.js';
import { logger } from '../../utils/logger.js';

const activeJobs = new Map();

/** @type {import('ws').WebSocketServer | null} */
let wsHub = null;

export function attachPromptToVideoWs(wss) {
  wsHub = wss;
}

function broadcast(jobId, event) {
  if (!wsHub) return;
  const payload = JSON.stringify({ jobId, ...event });
  wsHub.clients.forEach((client) => {
    if (client.readyState !== 1) return;
    if (!client.jobId || client.jobId === jobId) {
      client.send(payload);
    }
  });
}

function emitProgress(onProgress, jobId, stepKey, extra = {}) {
  const step = VIDEO_GENERATION_STEPS.find((s) => s.key === stepKey);
  const progress = Math.round(((step?.id || 1) / VIDEO_GENERATION_STEPS.length) * 100);
  const event = {
    type: 'progress',
    step: stepKey,
    stepName: step?.name,
    stepIcon: step?.icon,
    progress,
    ...extra,
  };
  onProgress?.(event);
  broadcast(jobId, event);
}

export function cancelJob(jobId) {
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.cancelled = true;
    return true;
  }
  return false;
}

/**
 * OWNAI Text-to-Video pipeline (6 steps):
 * 1. User prompt (handled by route/UI)
 * 2. Claude → 10-scene JSON script
 * 3. Stability AI → image per scene
 * 4. ElevenLabs → voiceover per scene
 * 5. FFmpeg → images + audio → 5 min MP4
 * 6. Deliver result URL to user
 */
export async function generateVideo(userPrompt, { userId, onProgress, subtitle, quality = '1080p' } = {}) {
  await ensurePromptToVideoDirs();

  const job = await createJob({ userId, prompt: userPrompt });
  const jobId = job.id;
  onProgress?.({ type: 'started', jobId });
  broadcast(jobId, { type: 'started', jobId });

  const workDir = path.join(PROMPT_TO_VIDEO_DIRS.temp, jobId);
  const outputPath = path.join(PROMPT_TO_VIDEO_DIRS.output, `${jobId}.mp4`);

  const state = { cancelled: false };
  activeJobs.set(jobId, state);

  try {
    await updateJob(jobId, { status: 'processing', progress: 0 });

    // Step 2: Claude script
    if (state.cancelled) throw new Error('Generation cancelled');
    emitProgress(onProgress, jobId, 'script');
    const script = await generateScript(userPrompt);
    await updateJob(jobId, {
      title: script.title,
      mood: script.mood,
      script,
      current_step: 'script',
      progress: 17,
    });
    emitProgress(onProgress, jobId, 'script', { script, complete: true });

    // Step 3: Stability images
    if (state.cancelled) throw new Error('Generation cancelled');
    emitProgress(onProgress, jobId, 'images');
    const sceneImages = [];
    const images = await Promise.all(
      script.scenes.map(async (scene, index) => {
        const imagePath = path.join(workDir, `scene_${index}.png`);
        await generateImage(scene.visualDescription, imagePath, scene.sceneNumber);
        sceneImages.push({ sceneNumber: scene.sceneNumber, path: imagePath });
        emitProgress(onProgress, jobId, 'images', {
          sceneNumber: scene.sceneNumber,
          previewCount: index + 1,
        });
        return imagePath;
      }),
    );
    await updateJob(jobId, { scene_images: sceneImages, current_step: 'images', progress: 33 });
    emitProgress(onProgress, jobId, 'images', { complete: true });

    // Step 4: ElevenLabs voiceover
    if (state.cancelled) throw new Error('Generation cancelled');
    emitProgress(onProgress, jobId, 'voiceover');
    const voiceovers = await Promise.all(
      script.scenes.map((scene, index) => {
        const audioPath = path.join(workDir, `voiceover_${index}.mp3`);
        return generateVoiceover(scene.narratorText, audioPath, scene.duration || 30);
      }),
    );
    await updateJob(jobId, { current_step: 'voiceover', progress: 50 });
    emitProgress(onProgress, jobId, 'voiceover', { complete: true });

    // Step 5: FFmpeg combine
    if (state.cancelled) throw new Error('Generation cancelled');
    emitProgress(onProgress, jobId, 'combine');
    const totalDuration = script.scenes.reduce((sum, s) => sum + (s.duration || 30), 0);
    await combineImagesWithAudio({
      workDir,
      images,
      voiceovers,
      scenes: script.scenes,
      outputPath,
      quality,
      subtitle: {
        fontName: subtitle?.fontName || script.subtitleFont || 'Arial',
        fontColor: subtitle?.fontColor || script.subtitleColor || (script.subtitleStyle === 'yellow' ? '#FFD54A' : '#FFFFFF'),
        outlineColor: subtitle?.outlineColor || '#000000',
        fontSize: subtitle?.fontSize ?? 24,
        primaryColour: subtitle?.primaryColour,
        outlineColour: subtitle?.outlineColour,
        outline: subtitle?.outline,
      },
    });
    await updateJob(jobId, { current_step: 'combine', progress: 75 });
    emitProgress(onProgress, jobId, 'combine', { complete: true });

    // Step 6: Export thumbnail + deliver
    emitProgress(onProgress, jobId, 'export');
    const thumbnailPath = path.join(PROMPT_TO_VIDEO_DIRS.thumbs, `${jobId}.jpg`);
    const thumbAt = Math.min(30, Math.max(5, Math.floor(totalDuration * 0.08)));
    await generateVideoThumbnail(outputPath, thumbnailPath, thumbAt);

    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      current_step: 'deliver',
      output_path: outputPath,
      thumbnail_path: thumbnailPath,
      duration_sec: totalDuration,
    });

    const result = {
      jobId,
      title: script.title,
      outputPath,
      videoUrl: `/api/v1/prompt-to-video/jobs/${jobId}/video`,
      thumbnailUrl: `/api/v1/prompt-to-video/jobs/${jobId}/thumbnail`,
      durationSec: totalDuration,
      mood: script.mood,
      quality,
    };

    emitProgress(onProgress, jobId, 'deliver', { complete: true, result });
    broadcast(jobId, { type: 'complete', result });

    return result;
  } catch (error) {
    logger.error('Text-to-Video generation failed', { jobId, error: error.message });
    await updateJob(jobId, {
      status: error.message === 'Generation cancelled' ? 'cancelled' : 'failed',
      error: error.message,
    });
    broadcast(jobId, { type: 'error', error: error.message });
    throw error;
  } finally {
    activeJobs.delete(jobId);
  }
}
