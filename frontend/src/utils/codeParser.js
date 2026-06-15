import { EXTENSION_MAP } from '../data/codeLibraryMeta.js';

const LANG_PATTERNS = [
  { lang: 'python', patterns: [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w+/m, /print\s*\(/, /:\s*$/m] },
  { lang: 'javascript', patterns: [/const\s+\w+\s*=/, /function\s+\w+\s*\(/, /=>\s*{/, /console\.log/] },
  { lang: 'typescript', patterns: [/:\s*(string|number|boolean|void)\b/, /interface\s+\w+/, /type\s+\w+\s*=/] },
  { lang: 'java', patterns: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.println/] },
  { lang: 'cpp', patterns: [/#include\s*<[\w.]+>/, /std::/, /using\s+namespace\s+std/] },
  { lang: 'c', patterns: [/#include\s*<stdio\.h>/, /printf\s*\(/, /int\s+main\s*\(/] },
  { lang: 'csharp', patterns: [/using\s+System/, /namespace\s+\w+/, /Console\.WriteLine/] },
  { lang: 'rust', patterns: [/fn\s+main\s*\(\)/, /let\s+mut\s+/, /println!\s*\(/] },
  { lang: 'go', patterns: [/package\s+main/, /func\s+main\s*\(/, /fmt\.Println/] },
  { lang: 'php', patterns: [/<\?php/, /\$\w+\s*=/, /echo\s+/] },
  { lang: 'ruby', patterns: [/def\s+\w+/, /puts\s+/, /end\s*$/m] },
  { lang: 'swift', patterns: [/import\s+Foundation/, /func\s+\w+/, /var\s+\w+/] },
  { lang: 'kotlin', patterns: [/fun\s+main/, /val\s+\w+/, /println\s*\(/] },
  { lang: 'dart', patterns: [/void\s+main\s*\(/, /print\s*\(/] },
  { lang: 'r', patterns: [/<-\s*/, /library\s*\(/, /function\s*\(/] },
  { lang: 'matlab', patterns: [/function\s+\w+/, /end\s*$/m, /disp\s*\(/] },
  { lang: 'bash', patterns: [/^#!\/bin\/bash/m, /echo\s+/, /\$\{/] },
  { lang: 'powershell', patterns: [/\$env:/, /Write-Host/, /Get-/] },
  { lang: 'sql', patterns: [/\bSELECT\b/i, /\bFROM\b/i, /\bINSERT\s+INTO\b/i, /\bCREATE\s+TABLE\b/i] },
  { lang: 'html', patterns: [/<html/i, /<div/i, /<\/\w+>/] },
  { lang: 'css', patterns: [/\.\w+\s*\{/, /#\w+\s*\{/, /@media/] },
  { lang: 'scss', patterns: [/\$\w+:/, /@mixin/, /@include/] },
  { lang: 'json', patterns: [/^\s*\{[\s\S]*"[\w]+"\s*:/m] },
  { lang: 'yaml', patterns: [/^[\w-]+:\s*$/m, /^---\s*$/m] },
  { lang: 'xml', patterns: [/<\?xml/,/<\w+[^>]*>/] },
  { lang: 'markdown', patterns: [/^#{1,6}\s/m, /\*\*[^*]+\*\*/, /```/] },
];

/**
 * Auto-detect language from code content.
 * @param {string} codeString
 * @returns {string}
 */
export function detectLanguage(codeString) {
  if (!codeString?.trim()) return 'javascript';
  let best = 'javascript';
  let bestScore = 0;
  for (const { lang, patterns } of LANG_PATTERNS) {
    let score = 0;
    for (const p of patterns) {
      if (p.test(codeString)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  return best;
}

/**
 * Scan description for O() notation.
 * @param {string} description
 * @returns {{ time: string, space: string }}
 */
export function extractComplexity(description) {
  if (!description) return { time: '', space: '' };
  const timeMatch = description.match(/time\s*:?\s*(O\([^)]+\))/i) || description.match(/(O\([^)]+\))/);
  const spaceMatch = description.match(/space\s*:?\s*(O\([^)]+\))/i);
  const allMatches = description.match(/O\([^)]+\)/g) || [];
  return {
    time: timeMatch?.[1] || allMatches[0] || '',
    space: spaceMatch?.[1] || allMatches[1] || '',
  };
}

/**
 * Generate valid filename with extension.
 * @param {string} title
 * @param {string} language
 */
export function generateFileName(title, language) {
  const slug = (title || 'snippet')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'snippet';
  const ext = EXTENSION_MAP[language] || 'txt';
  return `${slug}.${ext}`;
}
