import { generateFileName } from './codeParser.js';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32(n) {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function strBytes(s) {
  return new TextEncoder().encode(s);
}

function concat(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/**
 * Create a minimal ZIP (store, no compression) from files.
 * @param {{ name: string, content: string }[]} files
 */
export function createZipBlob(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = strBytes(file.name);
    const dataBytes = strBytes(file.content);
    const crc = crc32(dataBytes);

    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(dataBytes.length),
      u32(dataBytes.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      dataBytes,
    ]);
    localParts.push(localHeader);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(dataBytes.length),
      u32(dataBytes.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length;
  }

  const centralDir = concat(centralParts);
  const centralOffset = offset;
  const endRecord = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(centralOffset),
    u16(0),
  ]);

  return new Blob([...localParts, centralDir, endRecord], { type: 'application/zip' });
}

/**
 * Export code library entries as a ZIP download.
 * @param {object[]} entries
 */
export function exportLibraryZip(entries) {
  const files = entries.map((e) => ({
    name: generateFileName(e.title, e.language),
    content: e.code,
  }));

  const readme = [
    '# OWNAI Code Library Export',
    '',
    `Exported ${entries.length} snippet(s) from OWN AI.`,
    '',
    '## Entries',
    '',
    ...entries.map((e) => `- **${e.title}** (${e.language}) — ${e.category || 'General'}`),
    '',
  ].join('\n');

  files.unshift({ name: 'README.md', content: readme });

  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ownai-code-library.zip';
  a.click();
  URL.revokeObjectURL(url);
}
