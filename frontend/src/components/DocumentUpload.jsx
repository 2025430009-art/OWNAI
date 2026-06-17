import { useRef, useState } from 'react';
import { ingestRagDocument, uploadDocument } from '../api/client.js';
import { getOwnaiSessionId } from '../utils/sessionId.js';

export default function DocumentUpload({ onUploaded, sessionId, className = '' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [loadedFile, setLoadedFile] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const sid = sessionId || getOwnaiSessionId();
    setUploading(true);
    setError('');
    try {
      let data;
      try {
        data = await uploadDocument(file, sid);
      } catch {
        data = await ingestRagDocument(file, sid);
      }
      const name = data.filename || file.name;
      setLoadedFile(name);
      onUploaded?.(name, data);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.docx,.json,.csv"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-stone-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
      >
        {uploading ? 'Uploading…' : '📎 Upload PDF'}
      </button>
      {loadedFile && (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          ✓ {loadedFile} loaded
        </span>
      )}
      {error && (
        <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
