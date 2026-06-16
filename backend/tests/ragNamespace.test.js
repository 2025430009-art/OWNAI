import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRagNamespace, isRagAdmin } from '../src/rag/namespace.js';

describe('rag namespace', () => {
  it('uses user id when authenticated', () => {
    const req = { user: { id: 'user-42' }, headers: {} };
    assert.equal(resolveRagNamespace(req), 'user-42');
  });

  it('uses session header when unauthenticated', () => {
    const req = { headers: { 'x-session-id': 'abc-123' } };
    assert.equal(resolveRagNamespace(req), 'session:abc-123');
  });

  it('falls back to global for local dev', () => {
    const req = { headers: {} };
    assert.equal(resolveRagNamespace(req), 'global');
  });

  it('detects admin users from isAdmin flag', () => {
    assert.equal(isRagAdmin({ id: 'user-1', isAdmin: true }), true);
    assert.equal(isRagAdmin({ id: 'user-1' }), false);
    assert.equal(isRagAdmin(null), false);
  });
});
