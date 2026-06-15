import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const METADATA_FILE = 'metadata.json';
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.sql', '.html', '.css', '.sh', '.yml', '.yaml', '.xml', '.rtf',
]);
const ALLOWED_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.gif',
]);

function metadataPath() {
  return path.join(config.uploadPath, METADATA_FILE);
}

async function ensureUploadDir() {
  await fs.mkdir(config.uploadPath, { recursive: true });
}

async function readMetadata() {
  await ensureUploadDir();
  try {
    const raw = await fs.readFile(metadataPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeMetadata(items) {
  await fs.writeFile(metadataPath(), JSON.stringify(items, null, 2));
}

function truncateText(text) {
  const max = config.uploadTextMaxChars;
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated]`;
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return truncateText(data.text?.trim() || '');
}

async function extractDocxText(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return truncateText(result.value?.trim() || '');
}

async function extractText(filePath, mimetype, extension) {
  try {
    if (TEXT_EXTENSIONS.has(extension)) {
      const raw = await fs.readFile(filePath, 'utf8');
      return { textContent: truncateText(raw), note: null };
    }

    if (extension === '.pdf' || mimetype === 'application/pdf') {
      const textContent = await extractPdfText(filePath);
      if (!textContent) {
        return { textContent: null, note: 'PDF attached but no readable text was found.' };
      }
      return { textContent, note: null };
    }

    if (
      extension === '.docx'
      || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const textContent = await extractDocxText(filePath);
      if (!textContent) {
        return { textContent: null, note: 'DOCX attached but no readable text was found.' };
      }
      return { textContent, note: null };
    }

    if (mimetype.startsWith('image/')) {
      return { textContent: null, note: 'Image attached (visual analysis not enabled).' };
    }

    return { textContent: null, note: 'File attached but text extraction is not supported for this type.' };
  } catch (error) {
    return {
      textContent: null,
      note: `File attached but could not be read: ${error.message}`,
    };
  }
}

export async function saveAttachment(file, { sessionId = null, userId = null } = {}) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    const error = new Error(`File type not allowed: ${extension || 'unknown'}`);
    error.status = 400;
    throw error;
  }

  await ensureUploadDir();

  const id = crypto.randomUUID();
  const storedName = `${id}${extension}`;
  const storedPath = path.join(config.uploadPath, storedName);
  await fs.writeFile(storedPath, file.buffer);

  const { textContent, note } = await extractText(storedPath, file.mimetype, extension);

  const record = {
    id,
    originalName: file.originalname,
    storedName,
    mimetype: file.mimetype,
    size: file.size,
    extension,
    sessionId,
    userId,
    textContent,
    note,
    hasText: Boolean(textContent),
    createdAt: new Date().toISOString(),
    url: `/api/v1/attachments/${id}/file`,
  };

  const items = await readMetadata();
  items.unshift(record);
  await writeMetadata(items);

  return record;
}

export async function getAttachment(id) {
  const items = await readMetadata();
  return items.find((item) => item.id === id) ?? null;
}

export async function listAttachments({ sessionId, userId } = {}) {
  const items = await readMetadata();
  if (userId) {
    return items.filter((item) => item.userId === userId);
  }
  if (sessionId) {
    return items.filter((item) => item.sessionId === sessionId);
  }
  return [];
}

export async function deleteAttachment(id) {
  const items = await readMetadata();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;

  const [removed] = items.splice(index, 1);
  await writeMetadata(items);

  const filePath = path.join(config.uploadPath, removed.storedName);
  await fs.unlink(filePath).catch(() => {});

  return true;
}

export function buildPromptWithAttachments(prompt, attachments) {
  if (!attachments.length) return prompt;

  const blocks = attachments.map((file) => {
    const header = `--- Attachment: ${file.originalName} (${file.extension}) ---`;
    if (file.textContent) {
      return `${header}\n${file.textContent}`;
    }
    return `${header}\n${file.note || 'No extractable text.'}`;
  });

  return [
    'The user attached the following files. Use them as context when answering.',
    ...blocks,
    '',
    'User message:',
    prompt.trim(),
  ].join('\n\n');
}
