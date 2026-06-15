import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.resolve(__dirname, '../../data/ownai-qa-store.json');
let backup = null;

describe('ownaiQaService', () => {
  before(async () => {
    try {
      backup = await fs.readFile(STORE, 'utf8');
    } catch {
      backup = '[]';
    }
    await fs.writeFile(STORE, '[]', 'utf8');
  });

  after(async () => {
    await fs.writeFile(STORE, backup, 'utf8');
  });

  it('creates, lists, searches, and deletes Q&A entries', async () => {
    const { createQaEntry, listQaEntries, searchQaEntries, deleteQaEntry } = await import('../src/services/ownaiQaService.js');

    const entry = await createQaEntry({
      question: 'What is Newton-Raphson?',
      answer: 'A root-finding iterative method.',
      topic: 'Math',
    });

    assert.ok(entry.id);
    assert.equal(entry.source, 'OWN AI');

    const all = await listQaEntries();
    assert.equal(all.length, 1);

    const found = await searchQaEntries('Newton');
    assert.equal(found.length, 1);

    await deleteQaEntry(entry.id);
    const after = await listQaEntries();
    assert.equal(after.length, 0);
  });
});
