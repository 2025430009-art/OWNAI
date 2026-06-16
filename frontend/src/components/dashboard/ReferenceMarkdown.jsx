import { useState, useCallback } from 'react';
import { sanitizeUrl } from '../../utils/sanitizeUrl.js';

function ToolbarButton({ children, onClick, tone = 'default' }) {
  const toneClass = tone === 'run'
    ? 'text-violet-300 hover:bg-violet-500/15 hover:text-violet-200'
    : 'text-slate-400 hover:bg-white/10 hover:text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${toneClass}`}
    >
      {children}
    </button>
  );
}

function RunModal({ open, onClose, lines }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-violet-400/30 bg-[#0f0f1a] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-violet-300">OWN AI Run Output</p>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close run output"
          >
            ×
          </button>
        </div>
        <pre className="max-h-[55vh] overflow-auto rounded-xl border border-white/10 bg-[#050508] p-4 font-mono text-xs leading-relaxed text-slate-200">
          {lines.length ? (
            lines.map((line, i) => (
              <div
                key={`${line.type}-${i}`}
                className={
                  line.type === 'err'
                    ? 'text-rose-400'
                    : line.type === 'info'
                      ? 'text-violet-300'
                      : 'text-slate-200'
                }
              >
                {line.text}
              </div>
            ))
          ) : (
            <div className="text-violet-300">// No output produced.</div>
          )}
        </pre>
      </div>
    </div>
  );
}

function CodeToolbar({ text, language }) {
  const [copied, setCopied] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [runLines, setRunLines] = useState([]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [text]);

  const download = useCallback(() => {
    const ext = language?.trim() || 'txt';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ownai-output.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [language, text]);

  const run = useCallback(() => {
    const normalized = (language || 'javascript').toLowerCase();
    if (!['js', 'javascript', 'mjs', 'cjs'].includes(normalized)) {
      setRunLines([{ type: 'info', text: `Run supports JavaScript only. Current language: ${normalized || 'plain'}` }]);
      setRunOpen(true);
      return;
    }

    const logs = [];
    const fakeConsole = {
      log: (...a) => logs.push({ type: 'out', text: a.map(String).join(' ') }),
      error: (...a) => logs.push({ type: 'err', text: a.map(String).join(' ') }),
      warn: (...a) => logs.push({ type: 'err', text: `[warn] ${a.map(String).join(' ')}` }),
      info: (...a) => logs.push({ type: 'info', text: a.map(String).join(' ') }),
    };

    try {
      const fn = new Function('console', text);
      fn(fakeConsole);
      setRunLines(logs.length ? logs : [{ type: 'info', text: '// No output produced.' }]);
    } catch (err) {
      setRunLines([{ type: 'err', text: `Error: ${err.message}` }]);
    }
    setRunOpen(true);
  }, [language, text]);

  return (
    <>
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#1a1a2e] p-1">
        <ToolbarButton onClick={copy}>{copied ? 'Copied!' : 'Copy'}</ToolbarButton>
        <ToolbarButton onClick={download}>Download</ToolbarButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton onClick={run} tone="run">Run</ToolbarButton>
      </div>
      <RunModal open={runOpen} onClose={() => setRunOpen(false)} lines={runLines} />
    </>
  );
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isTableSeparator(line) {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim());
}

function parseInline(text, keyPrefix = 'i') {
  const parts = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m;
  let idx = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${idx}`;
    idx += 1;
    if (m[2]) parts.push(<strong key={key} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={key}>{m[3]}</em>);
    else if (m[4]) {
      parts.push(
        <code key={key} className="rounded bg-stone-200/80 px-1.5 py-0.5 font-mono text-[0.88em] text-[#1A1A1A] dark:bg-slate-800 dark:text-slate-100">
          {m[4]}
        </code>,
      );
    } else if (m[5]) {
      const href = sanitizeUrl(m[6]);
      if (href) {
        parts.push(
          <a key={key} href={href} className="text-teal-600 underline hover:text-teal-700" target="_blank" rel="noopener noreferrer">
            {m[5]}
          </a>,
        );
      } else {
        parts.push(m[5]);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

/**
 * Full markdown renderer for OWN AI Reference answers (Claude-style).
 */
export default function ReferenceMarkdown({ content, className = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks = [];
  let i = 0;
  let bi = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      const code = codeLines.join('\n');
      blocks.push(
        <div key={`b-${bi}`} className="relative my-3 overflow-hidden rounded-lg bg-[#1E1E1E]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{lang || 'code'}</span>
            <CodeToolbar text={code} language={lang} />
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-100">
            <code>{code}</code>
          </pre>
        </div>,
      );
      bi += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`b-${bi}`}
          className="my-3 border-l-4 border-teal-500/60 pl-4 text-[#1A1A1A] dark:text-slate-200"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="mb-1 last:mb-0">{parseInline(ql, `q-${bi}-${qi}`)}</p>
          ))}
        </blockquote>,
      );
      bi += 1;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`b-${bi}`} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-slate-700">
                {header.map((cell, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold text-[#1A1A1A] dark:text-slate-100">
                    {parseInline(cell, `th-${bi}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-stone-50/80 dark:bg-slate-800/40' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-[#1A1A1A] dark:text-slate-200">
                      {parseInline(cell, `td-${bi}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      bi += 1;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`b-${bi}`} className="my-2 list-disc space-y-1 pl-6 text-[15px] text-[#1A1A1A] dark:text-slate-200">
          {items.map((item, ii) => (
            <li key={ii}>{parseInline(item, `ul-${bi}-${ii}`)}</li>
          ))}
        </ul>,
      );
      bi += 1;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`b-${bi}`} className="my-2 list-decimal space-y-1 pl-6 text-[15px] text-[#1A1A1A] dark:text-slate-200">
          {items.map((item, ii) => (
            <li key={ii}>{parseInline(item, `ol-${bi}-${ii}`)}</li>
          ))}
        </ol>,
      );
      bi += 1;
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)[1].length;
      const contentLine = line.replace(/^#{1,3}\s/, '');
      const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      blocks.push(
        <Tag key={`b-${bi}`} className="mb-2 mt-4 font-semibold text-[#1A1A1A] first:mt-0 dark:text-white">
          {parseInline(contentLine, `h-${bi}`)}
        </Tag>,
      );
      bi += 1;
      i += 1;
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paraLines = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !lines[i].startsWith('>') && !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i]) && !/^#{1,3}\s/.test(lines[i])) {
      if (lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`b-${bi}`} className="mb-2 text-[15px] leading-relaxed text-[#1A1A1A] last:mb-0 dark:text-slate-200">
        {paraLines.map((pl, pi) => (
          <span key={pi}>
            {parseInline(pl, `p-${bi}-${pi}`)}
            {pi < paraLines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>,
    );
    bi += 1;
  }

  return <div className={`reference-markdown ${className}`}>{blocks}</div>;
}
