import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { isMongoAvailable } from '../../db/mongo.js';
import { VideoJob } from '../../models/Video.model.js';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const JOBS_FILE = path.join(PROJECT_ROOT, 'backend/data/prompt-to-video-jobs.json');

export const PROMPT_TO_VIDEO_DIRS = {
  temp: path.join(PROJECT_ROOT, 'temp/prompt-to-video'),
  output: path.join(PROJECT_ROOT, 'output/prompt-to-video'),
  thumbs: path.join(PROJECT_ROOT, 'output/prompt-to-video/thumbs'),
};

function enrichJob(job) {
  if (!job?.id) return job;
  const enriched = { ...job };
  if (enriched.status === 'completed' || enriched.output_path) {
    enriched.video_url = `/api/v1/prompt-to-video/jobs/${enriched.id}/video`;
  }
  if (enriched.thumbnail_path || enriched.status === 'completed') {
    enriched.thumbnail_url = `/api/v1/prompt-to-video/jobs/${enriched.id}/thumbnail`;
  }
  return enriched;
}

function toApiJob(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  return enrichJob({
    id: String(plain._id || plain.id),
    user_id: plain.userId ?? plain.user_id ?? null,
    prompt: plain.prompt,
    status: plain.status,
    progress: plain.progress ?? 0,
    current_step: plain.currentStep ?? plain.current_step,
    title: plain.title,
    mood: plain.mood,
    script: plain.script,
    scene_images: plain.sceneImages ?? plain.scene_images ?? [],
    output_path: plain.outputPath ?? plain.output_path,
    thumbnail_path: plain.thumbnailPath ?? plain.thumbnail_path,
    duration_sec: plain.durationSec ?? plain.duration_sec,
    share_token: plain.shareToken ?? plain.share_token,
    error: plain.error,
    created_at: plain.createdAt ?? plain.created_at,
    updated_at: plain.updatedAt ?? plain.updated_at,
  });
}

async function readFileStore() {
  try {
    const raw = await fs.readFile(JOBS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { jobs: [] };
  }
}

async function writeFileStore(store) {
  await fs.mkdir(path.dirname(JOBS_FILE), { recursive: true });
  await fs.writeFile(JOBS_FILE, JSON.stringify(store, null, 2));
}

export async function ensurePromptToVideoDirs() {
  await fs.mkdir(PROMPT_TO_VIDEO_DIRS.temp, { recursive: true });
  await fs.mkdir(PROMPT_TO_VIDEO_DIRS.output, { recursive: true });
  await fs.mkdir(PROMPT_TO_VIDEO_DIRS.thumbs, { recursive: true });
}

export async function createJob({ userId, prompt }) {
  const shareToken = randomUUID().replace(/-/g, '').slice(0, 16);

  if (isMongoAvailable()) {
    const doc = await VideoJob.create({
      userId,
      prompt,
      status: 'queued',
      progress: 0,
      shareToken,
    });
    return toApiJob(doc);
  }

  const job = {
    id: randomUUID(),
    user_id: userId,
    prompt,
    status: 'queued',
    progress: 0,
    current_step: null,
    title: null,
    mood: null,
    script: null,
    scene_images: [],
    output_path: null,
    thumbnail_path: null,
    share_token: shareToken,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const store = await readFileStore();
  store.jobs.unshift(job);
  await writeFileStore(store);
  return job;
}

export async function updateJob(id, patch) {
  const mongoPatch = {};
  if (patch.status !== undefined) mongoPatch.status = patch.status;
  if (patch.progress !== undefined) mongoPatch.progress = patch.progress;
  if (patch.current_step !== undefined) mongoPatch.currentStep = patch.current_step;
  if (patch.title !== undefined) mongoPatch.title = patch.title;
  if (patch.mood !== undefined) mongoPatch.mood = patch.mood;
  if (patch.script !== undefined) mongoPatch.script = patch.script;
  if (patch.scene_images !== undefined) mongoPatch.sceneImages = patch.scene_images;
  if (patch.output_path !== undefined) mongoPatch.outputPath = patch.output_path;
  if (patch.thumbnail_path !== undefined) mongoPatch.thumbnailPath = patch.thumbnail_path;
  if (patch.duration_sec !== undefined) mongoPatch.durationSec = patch.duration_sec;
  if (patch.error !== undefined) mongoPatch.error = patch.error;

  if (isMongoAvailable()) {
    const doc = await VideoJob.findByIdAndUpdate(id, mongoPatch, { new: true });
    return toApiJob(doc);
  }

  const store = await readFileStore();
  const index = store.jobs.findIndex((j) => j.id === id);
  if (index < 0) return null;
  store.jobs[index] = {
    ...store.jobs[index],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await writeFileStore(store);
  return store.jobs[index];
}

export async function getJob(id) {
  if (isMongoAvailable()) {
    const doc = await VideoJob.findById(id);
    return toApiJob(doc);
  }

  const store = await readFileStore();
  return store.jobs.find((j) => j.id === id) || null;
}

export async function listJobs(userId, limit = 20) {
  if (isMongoAvailable()) {
    const filter = userId != null ? { userId } : {};
    const docs = await VideoJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('prompt status progress title mood shareToken thumbnailPath outputPath createdAt updatedAt');
    return docs.map(toApiJob);
  }

  const store = await readFileStore();
  let jobs = store.jobs;
  if (userId != null) jobs = jobs.filter((j) => j.user_id === userId);
  return jobs.slice(0, limit).map(({ script, output_path, ...rest }) => rest);
}

export async function deleteJob(id) {
  const job = await getJob(id);
  if (!job) return false;

  if (job.output_path) {
    await fs.unlink(job.output_path).catch(() => {});
  }
  if (job.thumbnail_path) {
    await fs.unlink(job.thumbnail_path).catch(() => {});
  }

  if (isMongoAvailable()) {
    await VideoJob.findByIdAndDelete(id);
    return true;
  }

  const store = await readFileStore();
  store.jobs = store.jobs.filter((j) => j.id !== id);
  await writeFileStore(store);
  return true;
}

export async function getJobByShareToken(token) {
  if (isMongoAvailable()) {
    const doc = await VideoJob.findOne({ shareToken: token });
    return toApiJob(doc);
  }

  const store = await readFileStore();
  return store.jobs.find((j) => j.share_token === token) || null;
}
