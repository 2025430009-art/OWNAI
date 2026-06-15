/**
 * Renders common inline markdown (**, *, `) as styled text instead of raw symbols.
 */
function parseInline(line, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;
  let partIndex = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${partIndex}`;
    partIndex += 1;
    if (match[2]) {
      parts.push(<strong key={key} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts.length ? parts : [line];
}

export default function FormattedText({ text, className = '' }) {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('```')) {
      const lang = lines[i].slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`block-${blockIndex}`}
          className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100 dark:bg-slate-950"
        >
          {lang && <span className="mb-2 block text-[10px] uppercase text-slate-400">{lang}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      blockIndex += 1;
      continue;
    }

    const line = lines[i];
    if (/^#{1,3}\s/.test(line)) {
      const content = line.replace(/^#{1,3}\s/, '');
      blocks.push(
        <p key={`block-${blockIndex}`} className="mt-2 font-semibold first:mt-0">
          {parseInline(content, `h-${blockIndex}`)}
        </p>,
      );
    } else {
      blocks.push(
        <span key={`block-${blockIndex}`}>
          {parseInline(line, `l-${blockIndex}`)}
          {i < lines.length - 1 ? '\n' : ''}
        </span>,
      );
    }
    blockIndex += 1;
    i += 1;
  }

  return <span className={className}>{blocks}</span>;
}
