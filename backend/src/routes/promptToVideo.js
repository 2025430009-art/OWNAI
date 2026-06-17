import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { VIDEO_GENERATION_STEPS, EXAMPLE_PROMPTS } from '../data/promptToVideoSteps.js';
import { VIDEO_QUALITY_OPTIONS } from '../data/videoQuality.js';
import {
  listJobs,
  getJob,
  deleteJob,
  getJobByShareToken,
} from '../services/promptToVideo/videoJobStore.js';
import { generateVideo, cancelJob } from '../services/promptToVideo/orchestrator.js';
import {
  canAccessJob,
  canAccessJobByShareToken,
} from '../services/promptToVideo/jobAccess.js';
import { resolveDbUserId } from '../services/thinkingLogService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(10, 'prompt must be at least 10 characters').max(2000),
  stream: z.boolean().optional().default(true),
  subtitle: z.object({
    fontName: z.string().min(1).max(64).optional(),
    fontSize: z.number().int().min(14).max(72).optional(),
    fontColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
    outlineColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
    primaryColour: z.string().regex(/^&H[0-9A-Fa-f]{6}$/).optional(),
    outlineColour: z.string().regex(/^&H[0-9A-Fa-f]{6}$/).optional(),
    outline: z.number().int().min(0).max(6).optional(),
  }).optional().default({}),
  quality: z.enum(['480p', '720p', '1080p']).optional().default('1080p'),
});

router.get('/steps', (_req, res) => {
  res.json({
    success: true,
    steps: VIDEO_GENERATION_STEPS,
    examples: EXAMPLE_PROMPTS,
    qualities: VIDEO_QUALITY_OPTIONS,
  });
});

router.get('/jobs', inferenceAuth, async (req, res, next) => {
  try {
    const userId = resolveDbUserId(req);
    const jobs = await listJobs(userId, 50);
    res.json({ success: true, jobs });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id', inferenceAuth, async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to access this job' });
    }
    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
});

router.get('/share/:token', async (req, res, next) => {
  try {
    const job = await getJobByShareToken(req.params.token);
    if (!job || job.status !== 'completed') {
      return res.status(404).json({ error: 'Shared video not found' });
    }
    res.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        mood: job.mood,
        prompt: job.prompt,
        videoUrl: `/api/v1/prompt-to-video/share/${req.params.token}/video`,
        thumbnailUrl: `/api/v1/prompt-to-video/share/${req.params.token}/thumbnail`,
        shareToken: job.share_token,
        created_at: job.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/share/:token/thumbnail', async (req, res, next) => {
  try {
    const job = await getJobByShareToken(req.params.token);
    if (!job || !canAccessJobByShareToken(req.params.token, job)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    if (!job.thumbnail_path || !fs.existsSync(job.thumbnail_path)) {
      return res.status(404).json({ error: 'Thumbnail not ready' });
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(job.thumbnail_path).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get('/share/:token/video', async (req, res, next) => {
  try {
    const job = await getJobByShareToken(req.params.token);
    if (!job || !canAccessJobByShareToken(req.params.token, job)) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (!job.output_path || !fs.existsSync(job.output_path)) {
      return res.status(404).json({ error: 'Video not ready' });
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="${job.title || 'prompt-to-video'}.mp4"`);
    fs.createReadStream(job.output_path).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id/thumbnail', inferenceAuth, async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job || !canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to access this thumbnail' });
    }
    if (!job.thumbnail_path || !fs.existsSync(job.thumbnail_path)) {
      return res.status(404).json({ error: 'Thumbnail not ready' });
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(job.thumbnail_path).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id/video', inferenceAuth, async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job || !canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to access this video' });
    }
    if (!job.output_path || !fs.existsSync(job.output_path)) {
      return res.status(404).json({ error: 'Video not ready' });
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="${job.title || 'prompt-to-video'}.mp4"`);
    fs.createReadStream(job.output_path).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.delete('/jobs/:id', inferenceAuth, async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!canAccessJob(req, job)) {
      return res.status(403).json({ error: 'Not authorized to delete this job' });
    }
    const deleted = await deleteJob(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/jobs/:id/cancel', inferenceAuth, async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (!canAccessJob(req, job)) {
    return res.status(403).json({ error: 'Not authorized to cancel this job' });
  }
  const cancelled = cancelJob(req.params.id);
  res.json({ success: true, cancelled });
});

router.post('/generate', inferenceAuth, inferenceRateLimiter, validate(generateSchema), async (req, res, next) => {
  const { prompt, stream, subtitle, quality } = req.validated;
  const userId = resolveDbUserId(req);
  const startTime = Date.now();

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await generateVideo(prompt, {
        userId,
        subtitle,
        quality,
        onProgress: (event) => {
          send(event);
        },
      });
      send({ type: 'done', result, meta: { duration_ms: Date.now() - startTime } });
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      send({ type: 'error', error: error.message });
      res.write('data: [DONE]\n\n');
      res.end();
    }
    return;
  }

  try {
    const result = await generateVideo(prompt, { userId, subtitle, quality });
    res.json({
      success: true,
      result,
      meta: { duration_ms: Date.now() - startTime },
    });
  } catch (error) {
    logger.error('PromptToVideo generate failed', { error: error.message });
    next(error);
  }
});

export default router;
