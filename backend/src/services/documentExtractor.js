import fs from 'fs/promises';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

function truncate(text, max = config.uploadTextMaxChars) {
  if (!text) return '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n\n[truncated]`;
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = truncate(data.text || '');
  if (!text) {
    return {
      textContent: null,
      note: 'PDF uploaded but no readable text was found (it may be scanned/image-only).',
    };
  }
  return { textContent: text, note: null };
}

async function extractDocxText(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = truncate(result.value || '');
  if (!text) {
    return { textContent: null, note: 'Document uploaded but no readable text was found.' };
  }
  return { textContent: text, note: null };
}

export async function extractDocumentText(filePath, mimetype, extension) {
  if (extension === '.pdf' || mimetype === 'application/pdf') {
    try {
      return await extractPdfText(filePath);
    } catch (error) {
      return {
        textContent: null,
        note: `PDF uploaded but text extraction failed: ${error.message}`,
      };
    }
  }

  if (
    extension === '.docx'
    || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      return await extractDocxText(filePath);
    } catch (error) {
      return {
        textContent: null,
        note: `Document uploaded but text extraction failed: ${error.message}`,
      };
    }
  }

  return null;
}
