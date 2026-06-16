import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { logger } from '../../utils/logger.js';
import { resolveQuality } from '../../data/videoQuality.js';

const exec = promisify(execFile);

export function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function generateSRT(scenes) {
  let srt = '';
  let timeCounter = 0;

  scenes.forEach((scene, index) => {
    const startTime = formatSrtTime(timeCounter);
    const duration = scene.duration || 30;
    timeCounter += duration;
    const endTime = formatSrtTime(timeCounter);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${scene.narratorText}\n\n`;
  });

  return srt;
}

async function runFfmpeg(args, label) {
  try {
    await exec(ffmpegPath, args, { maxBuffer: 50 * 1024 * 1024 });
  } catch (error) {
    logger.error(`FFmpeg ${label} failed`, { error: error.message });
    throw new Error(`FFmpeg ${label} failed: ${error.message}`);
  }
}

function hexToAssColor(hex, fallback) {
  if (typeof hex !== 'string') return fallback;
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  const r = normalized.slice(0, 2);
  const g = normalized.slice(2, 4);
  const b = normalized.slice(4, 6);
  return `&H${b}${g}${r}`.toUpperCase();
}

function resolveSubtitleStyle(subtitle = {}) {
  const fontName = subtitle.fontName || 'Arial';
  const fontSize = Number.isFinite(subtitle.fontSize) ? Math.max(14, Math.min(72, subtitle.fontSize)) : 24;
  const primaryColour = subtitle.primaryColour?.startsWith('&H')
    ? subtitle.primaryColour
    : hexToAssColor(subtitle.fontColor, '&HFFFFFF');
  const outlineColour = subtitle.outlineColour?.startsWith('&H')
    ? subtitle.outlineColour
    : hexToAssColor(subtitle.outlineColor, '&H000000');
  const outline = Number.isFinite(subtitle.outline) ? Math.max(0, Math.min(6, subtitle.outline)) : 2;

  return `FontName=${fontName},FontSize=${fontSize},PrimaryColour=${primaryColour},OutlineColour=${outlineColour},Outline=${outline}`;
}

function kenBurnsFilter(durationSec, scene, width, height) {
  const frames = Math.max(24, Math.round(durationSec * 24));
  if (scene?.cameraAngle?.includes('zoom')) {
    return `zoompan=z='min(zoom+0.0015,1.5)':d=${frames}:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=${width}x${height}:fps=24`;
  }
  return `zoompan=z='min(zoom+0.0008,1.3)':d=${frames}:x='if(lte(on,1),0,x+1)':y=ih/2-(ih/zoom/2):s=${width}x${height}:fps=24`;
}

function scaleSubtitleFontSize(baseSize, height) {
  const scale = height / 1080;
  return Math.max(14, Math.min(72, Math.round(baseSize * scale)));
}

/**
 * Step 5: Combine scene images + voiceovers into a single 5-minute MP4.
 * Each image becomes a 30s cinematic clip with Ken Burns motion and synced narration.
 */
export async function combineImagesWithAudio({
  workDir,
  images,
  voiceovers,
  scenes,
  outputPath,
  subtitle,
  quality = '1080p',
}) {
  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const { width, height } = resolveQuality(quality);
  const scaledSubtitle = {
    ...subtitle,
    fontSize: scaleSubtitleFontSize(subtitle?.fontSize ?? 24, height),
  };

  const sceneClips = [];

  for (let i = 0; i < images.length; i += 1) {
    const duration = scenes[i]?.duration || 30;
    const outClip = path.join(workDir, `scene_clip_${i}.mp4`);
    const motion = kenBurnsFilter(duration, scenes[i], width, height);

    await runFfmpeg([
      '-y',
      '-loop', '1',
      '-i', images[i],
      '-i', voiceovers[i],
      '-filter_complex',
      `[0:v]${motion},format=yuv420p[v];[1:a]apad,atrim=0:${duration}[a]`,
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-t', String(duration),
      '-pix_fmt', 'yuv420p',
      '-shortest',
      outClip,
    ], `scene-${i}`);

    sceneClips.push(outClip);
  }

  const concatFile = path.join(workDir, 'concat.txt');
  const concatContent = sceneClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(concatFile, concatContent);

  const combinedPath = path.join(workDir, 'combined.mp4');
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    combinedPath,
  ], 'concat');

  const srtPath = path.join(workDir, 'subtitles.srt');
  await fs.writeFile(srtPath, generateSRT(scenes));

  const escapedSrt = srtPath.replace(/:/g, '\\:').replace(/'/g, "\\'");
  const forceStyle = resolveSubtitleStyle(scaledSubtitle);
  await runFfmpeg([
    '-y',
    '-i', combinedPath,
    '-vf', `subtitles='${escapedSrt}':force_style='${forceStyle}'`,
    '-c:a', 'copy',
    outputPath,
  ], 'subtitles');

  return outputPath;
}

/**
 * Extract a JPEG thumbnail from a finished MP4 using FFmpeg screenshot.
 * @param {string} videoPath - source MP4
 * @param {string} thumbnailPath - output .jpg path
 * @param {number} atSeconds - seek position for the frame capture
 */
export async function generateVideoThumbnail(videoPath, thumbnailPath, atSeconds = 15) {
  await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });

  await runFfmpeg([
    '-y',
    '-ss', String(atSeconds),
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', 'scale=640:-1',
    '-q:v', '3',
    thumbnailPath,
  ], 'thumbnail');

  return thumbnailPath;
}
