import fs from 'fs/promises';
import mammoth from 'mammoth';
import { config } from '../config/index.js';
import { parsePdfBuffer, PDF_ERROR_CORRUPT, PDF_ERROR_SCANNED } from '../utils/pdfParser.js';

function truncate(text, max = config.uploadTextMaxChars) {
  if (!text) return '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n\n[truncated]`;
}

async function extractPdfText(buffer) {
  const result = await parsePdfBuffer(buffer);
  if (!result.text) {
    return {
      textContent: null,
      note: result.error || PDF_ERROR_SCANNED,
    };
  }
  return { textContent: truncate(result.text), note: null };
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

/**
 * Extract text from a document file or buffer.
 * @param {string} filePath - path on disk (for docx / fallback read)
 * @param {string} mimetype
 * @param {string} extension
 * @param {Buffer} [buffer] - in-memory file buffer from multer memoryStorage()
 */
export async function extractDocumentText(filePath, mimetype, extension, buffer = null) {
  if (extension === '.pdf' || mimetype === 'application/pdf') {
    try {
      const pdfBuffer = buffer ?? await fs.readFile(filePath);
      return await extractPdfText(pdfBuffer);
    } catch (error) {
      return {
        textContent: null,
        note: error.message || PDF_ERROR_CORRUPT,
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
