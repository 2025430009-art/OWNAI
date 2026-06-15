import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

export function getProjectRoot() {
  return ROOT;
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function listFiles(dir, ext) {
  if (!(await fileExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && (!ext || e.name.endsWith(ext)))
    .map((e) => path.join(dir, e.name));
}

export function slugify(name) {
  return name.replace(/\.md$/, '').replace(/\s+/g, '-').toLowerCase();
}
