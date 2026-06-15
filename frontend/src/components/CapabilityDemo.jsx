import { useState } from 'react';
import { executeCapability } from '../api/client.js';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CapabilityDemo({ capability, onClose }) {
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState('');
  const [fromLang, setFromLang] = useState('en');
  const [toLang, setToLang] = useState('es');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!capability) return null;

  const demoType = capability.demo?.type || 'text';

  const buildPayload = async () => {
    const payload = {};

    if (demoType === 'rag') {
      if (documents.trim()) {
        payload.action = 'ingest';
        payload.documents = documents.split('\n').filter(Boolean);
      } else {
        payload.action = 'query';
        payload.query = input;
      }
      return payload;
    }

    if (demoType === 'translate') {
      payload.text = input;
      payload.from = fromLang;
      payload.to = toLang;
      return payload;
    }

    if (demoType === 'text' || demoType === 'finetune') {
      if (demoType === 'finetune') {
        payload.action = 'info';
      } else {
        payload.prompt = input;
      }
      return payload;
    }

    if (demoType === 'audio' || demoType === 'image' || demoType === 'multimodal') {
      if (!file) throw new Error('Please select a file');
      const base64 = await fileToBase64(file);
      if (demoType === 'audio') {
        payload.audio_base64 = base64;
      } else {
        payload.image_base64 = base64;
        if (input) payload.prompt = input;
      }
      return payload;
    }

    payload.prompt = input;
    return payload;
  };

  const handleRun = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = await buildPayload();
      const data = await executeCapability(capability.slug, payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result?.result) return null;
    const r = result.result;

    if (r.audio_base64) {
      return (
        <audio controls className="w-full mt-2" src={`data:audio/wav;base64,${r.audio_base64}`} />
      );
    }

    if (r.images?.length) {
      return r.images.map((img) => (
        <img
          key={img.index}
          src={`data:${img.mime};base64,${img.base64}`}
          alt="Generated"
          className="mt-2 rounded-lg max-w-full"
        />
      ));
    }

    const text =
      r.output ||
      r.text ||
      r.answer ||
      r.translation ||
      r.transcript ||
      r.action ||
      (r.embeddings ? `Embedding dims: ${r.dimensions}` : null) ||
      (r.classifications ? JSON.stringify(r.classifications, null, 2) : null) ||
      (r.blocks ? r.text : null);

    if (r.response) {
      return (
        <div className="space-y-2 text-sm">
          <p><span className="text-slate-500">Transcript:</span> {r.transcript}</p>
          <p><span className="text-slate-500">Response:</span> {r.response}</p>
        </div>
      );
    }

    return (
      <pre className="mt-2 text-xs text-slate-300 whitespace-pre-wrap overflow-auto max-h-48">
        {typeof text === 'string' ? text : JSON.stringify(r, null, 2)}
      </pre>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-teal-400">{capability.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{capability.backend}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-400">{capability.description}</p>

        <div className="mt-5 space-y-3">
          {demoType === 'rag' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Documents to ingest (one per line, optional)
              </label>
              <textarea
                value={documents}
                onChange={(e) => setDocuments(e.target.value)}
                className="input-field text-sm h-20 resize-none"
                placeholder="Paste documents here to ingest before querying..."
              />
            </div>
          )}

          {demoType === 'translate' && (
            <div className="flex gap-2">
              <input value={fromLang} onChange={(e) => setFromLang(e.target.value)} className="input-field text-sm w-20" placeholder="from" />
              <span className="text-slate-500 self-center">→</span>
              <input value={toLang} onChange={(e) => setToLang(e.target.value)} className="input-field text-sm w-20" placeholder="to" />
            </div>
          )}

          {(demoType === 'audio' || demoType === 'image' || demoType === 'multimodal') && (
            <input
              type="file"
              accept={demoType === 'audio' ? 'audio/*' : 'image/*'}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-white"
            />
          )}

          {demoType !== 'finetune' && (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="input-field text-sm h-24 resize-none"
              placeholder={capability.demo?.placeholder || 'Enter input...'}
            />
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {result && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <p className="text-xs text-slate-500 mb-1">
              Result {result.meta?.duration_ms != null && `(${result.meta.duration_ms}ms)`}
            </p>
            {renderResult()}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={handleRun} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Running...' : 'Run capability'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        <p className="mt-3 text-[10px] text-slate-600 font-mono">
          {capability.endpoint || `/api/v1/capabilities/${capability.slug}`}/execute
        </p>
      </div>
    </div>
  );
}
