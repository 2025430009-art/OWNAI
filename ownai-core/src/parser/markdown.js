const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseSimpleYaml(text) {
  const meta = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^([\w-]+):\s*(.*)$/);
    if (match) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      meta[match[1]] = value;
    }
  }
  return meta;
}

export function parseMarkdownDocument(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }
  return { meta: parseSimpleYaml(match[1]), body: match[2].trim() };
}

export function interpolateArguments(template, args = '') {
  return template
    .replace(/\$ARGUMENTS/g, args)
    .replace(/\$0/g, args.split(/\s+/)[0] || '')
    .replace(/\$1/g, args.split(/\s+/)[1] || '')
    .replace(/\$2/g, args.split(/\s+/)[2] || '');
}

export function extractPhases(body) {
  const phases = [];
  const sections = body.split(/^---\s*$/m);
  for (const section of sections) {
    const heading = section.match(/^##\s+Phase\s+(\d+):\s*(.+)$/m);
    if (heading) {
      phases.push({
        number: parseInt(heading[1], 10),
        title: heading[2].trim(),
        content: section.trim(),
      });
    }
  }
  return phases;
}
