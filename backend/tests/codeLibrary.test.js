import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.resolve(__dirname, '../../data/code-library-store.json');
let backup = null;

describe('codeLibraryService', () => {
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

  it('creates, lists, updates, searches, and deletes entries', async () => {
    const {
      createCodeEntry,
      listCodeEntries,
      updateCodeEntry,
      searchCodeEntries,
      filterCodeEntries,
      deleteCodeEntry,
    } = await import('../src/services/codeLibraryService.js');

    const entry = await createCodeEntry({
      title: 'Binary Search',
      description: 'Classic divide and conquer search',
      code: 'def search(arr, x):\n    pass',
      language: 'python',
      category: 'Searching',
      tags: ['binary', 'recursion'],
      complexity: { time: 'O(log n)', space: 'O(1)' },
    });

    assert.ok(entry.id);
    assert.equal(entry.language, 'python');

    const all = await listCodeEntries();
    assert.equal(all.length, 1);

    const found = await searchCodeEntries('Binary');
    assert.equal(found.length, 1);

    const filtered = await filterCodeEntries({ lang: 'python' });
    assert.equal(filtered.length, 1);

    const updated = await updateCodeEntry(entry.id, { title: 'Binary Search in Python' });
    assert.equal(updated.title, 'Binary Search in Python');

    await deleteCodeEntry(entry.id);
    const after = await listCodeEntries();
    assert.equal(after.length, 0);
  });
});
