import ReferenceMarkdown from './dashboard/ReferenceMarkdown.jsx';

/** Lightweight markdown wrapper for chat bubbles */
export default function FormattedText({ text }) {
  if (!text) return null;
  return <ReferenceMarkdown content={text} />;
}
