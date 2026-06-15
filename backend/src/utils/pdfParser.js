import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export const PDF_ERROR_CORRUPT =
  'Could not read the PDF. Please make sure it is not password-protected or corrupted.';

export const PDF_ERROR_SCANNED =
  'This PDF appears to be scanned. Text extraction is not supported for image-based PDFs.';

/** Strip pdf-parse v2 page footer markers from extracted text */
function cleanPdfText(raw) {
  return (raw || '')
    .replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Parse a PDF buffer into plain text using pdf-parse v2 (PDFParse class).
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<{ text: string|null, scanned: boolean, error: string|null }>}
 */
export async function parsePdfBuffer(buffer) {
  if (!buffer?.length) {
    throw Object.assign(new Error(PDF_ERROR_CORRUPT), { code: 'PDF_EMPTY' });
  }

  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = cleanPdfText(result?.text);

    if (!text) {
      return { text: null, scanned: true, error: PDF_ERROR_SCANNED };
    }

    return { text, scanned: false, error: null };
  } catch (error) {
    const message = error?.message || '';
    if (error?.name === 'PasswordException' || /password/i.test(message)) {
      throw Object.assign(new Error(PDF_ERROR_CORRUPT), { code: 'PDF_PASSWORD', cause: error });
    }
    throw Object.assign(new Error(PDF_ERROR_CORRUPT), { code: 'PDF_PARSE_FAILED', cause: error });
  } finally {
    try {
      await parser?.destroy?.();
    } catch {
      // ignore cleanup errors
    }
  }
}
