import fs from 'fs/promises';
import path from 'path';
import { extractDocumentText } from '../services/documentExtractor.js';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.js', '.py', '.html', '.css']);

export async function loadDocument(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const mimetype = ext === '.pdf' ? 'application/pdf' : 'text/plain';

  if (TEXT_EXTENSIONS.has(ext)) {
    const text = await fs.readFile(filePath, 'utf-8');
    return { text, filename: path.basename(originalName || filePath) };
  }

  const { textContent, note } = await extractDocumentText(filePath, mimetype, ext);
  if (!textContent) {
    throw new Error(note || `Could not extract text from ${originalName || filePath}`);
  }
  return { text: textContent, filename: path.basename(originalName || filePath) };
}

export function chunkText(text, chunkSize = 500) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = [];
  const paragraphs = normalized.split(/\n{2,}/);
  let buffer = '';

  for (const para of paragraphs) {
    if ((buffer + para).length <= chunkSize) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      if (buffer) chunks.push(buffer);
      if (para.length <= chunkSize) {
        buffer = para;
      } else {
        for (let i = 0; i < para.length; i += chunkSize) {
          chunks.push(para.slice(i, i + chunkSize));
        }
        buffer = '';
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}
