import { PRISM_LANG_MAP } from '../data/codeLibraryMeta.js';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const KEYWORDS = {
  javascript: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|typeof)\b/g,
  typescript: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|interface|type|enum|readonly)\b/g,
  python: /\b(def|class|return|if|elif|else|for|while|import|from|as|with|lambda|pass|None|True|False|yield)\b/g,
  java: /\b(public|private|protected|class|static|void|return|if|else|for|while|new|import|package|extends)\b/g,
  cpp: /\b(int|void|return|if|else|for|while|class|struct|namespace|include|using|std|template|auto)\b/g,
  c: /\b(int|void|return|if|else|for|while|struct|include|char|float|double)\b/g,
  csharp: /\b(public|private|class|static|void|return|if|else|for|while|using|namespace|var|async|await)\b/g,
  rust: /\b(fn|let|mut|return|if|else|for|while|struct|impl|use|pub|match|enum)\b/g,
  go: /\b(func|return|if|else|for|var|package|import|struct|defer|go)\b/g,
  php: /\b(function|class|public|private|return|if|else|foreach|echo|new)\b/g,
  ruby: /\b(def|class|end|if|else|elsif|return|module|require)\b/g,
  sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|JOIN|ON|ORDER|BY|GROUP|HAVING|VALUES|SET)\b/gi,
  bash: /\b(if|then|else|fi|for|do|done|echo|function|in)\b/g,
  html: /\b(html|head|body|div|span|script|style|class|id)\b/gi,
  css: /\b(color|background|margin|padding|display|flex|grid|font-size|border)\b/g,
  json: /"(true|false|null)"/g,
};

function highlightKeywords(html, language) {
  const lang = PRISM_LANG_MAP[language] || language;
  const kw = KEYWORDS[language] || KEYWORDS[lang] || KEYWORDS.javascript;
  return html.replace(kw, '<span class="text-sky-400">$&</span>');
}

function highlightStrings(html) {
  return html.replace(/(&#39;[^&#]*&#39;|&quot;[^&]*&quot;)/g, '<span class="text-amber-300">$1</span>');
}

function highlightComments(html) {
  return html
    .replace(/(\/\/[^\n]*)/g, '<span class="text-stone-500">$1</span>')
    .replace(/(#[^\n]*)/g, '<span class="text-stone-500">$1</span>');
}

function highlightNumbers(html) {
  return html.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-violet-300">$1</span>');
}

/**
 * Lightweight syntax highlighter (no external deps).
 * Returns HTML safe for dangerouslySetInnerHTML.
 */
export function highlightCode(code, language = 'javascript') {
  let html = escapeHtml(code);
  html = highlightComments(html);
  html = highlightStrings(html);
  html = highlightKeywords(html, language);
  html = highlightNumbers(html);
  return html;
}
