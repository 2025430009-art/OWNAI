import { useRef, useEffect, useState } from 'react';
import { highlightCode } from '../../utils/prismLoader.js';

export default function CodeEditor({ value, onChange, language, rows = 14, className = '' }) {
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const [highlighted, setHighlighted] = useState('');

  const lineCount = Math.max((value || '').split('\n').length, rows);

  useEffect(() => {
    setHighlighted(highlightCode(value || '', language));
  }, [value, language]);

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
      });
    }
  };

  const syncScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-stone-700 bg-[#1E1E1E] ${className}`}>
      <div className="flex">
        <div
          className="select-none border-r border-stone-700 bg-[#252526] py-3 pr-2 text-right font-mono text-xs leading-[1.5] text-stone-500"
          style={{ minWidth: '2.5rem' }}
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="px-2">{i + 1}</div>
          ))}
        </div>
        <div className="relative min-h-0 flex-1">
          <pre
            ref={preRef}
            className="pointer-events-none absolute inset-0 m-0 overflow-auto p-3 font-mono text-[13px] leading-[1.5] text-slate-100"
            aria-hidden="true"
          >
            <code
              className={`language-${language}`}
              dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
            />
          </pre>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            className="relative z-10 min-h-[200px] w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-[1.5] text-transparent caret-white outline-none"
            style={{ WebkitTextFillColor: 'transparent' }}
            rows={rows}
          />
        </div>
      </div>
    </div>
  );
}
