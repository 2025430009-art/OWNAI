import path from 'path';

/** Document types supported by RAG ingest (text extraction). */
export const RAG_DOCUMENT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.pdf', '.docx',
  '.html', '.xml', '.rtf', '.yml', '.yaml',
]);

export function isAllowedRagUpload(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return RAG_DOCUMENT_EXTENSIONS.has(ext);
}

export function ragUploadFilter(_req, file, cb) {
  if (isAllowedRagUpload(file.originalname)) {
    cb(null, true);
    return;
  }
  const ext = path.extname(file.originalname || '').toLowerCase() || 'unknown';
  cb(new Error(`Unsupported file type: ${ext}. Allowed: ${[...RAG_DOCUMENT_EXTENSIONS].sort().join(', ')}`));
}
