import { useEffect, useState } from 'react';
import { highlightCode } from '../../utils/prismLoader.js';

export default function CodeBlock({ code, language, maxHeight = 400, showExpand = true }) {
  const [html, setHtml] = useState('');
  const [expanded, setExpanded] = useState(false);
  const lines = (code || '').split('\n');

  useEffect(() => {
    setHtml(highlightCode(code || '', language));
  }, [code, language]);

  const needsExpand = lines.length > 20;

  return (
    <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]">
      <div className="flex">
        <div className="select-none border-r border-stone-700 bg-[#252526] py-3 pr-2 text-right font-mono text-xs leading-[1.5] text-stone-500">
          {lines.map((_, i) => (
            <div key={i} className="px-2">{i + 1}</div>
          ))}
        </div>
        <pre
          className={`m-0 flex-1 overflow-auto p-3 font-mono text-[13px] leading-[1.5] text-slate-100 ${!expanded && needsExpand ? 'max-h-[400px]' : ''}`}
          style={!expanded && needsExpand ? { maxHeight } : undefined}
        >
          <code
            className={`language-${language}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      </div>
      {showExpand && needsExpand && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full border-t border-stone-700 py-1.5 text-xs text-slate-400 hover:bg-stone-800 hover:text-white"
        >
          {expanded ? 'Collapse' : 'Show full code'}
        </button>
      )}
    </div>
  );
}
