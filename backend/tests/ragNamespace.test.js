import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRagNamespace, isRagAdmin } from '../src/rag/namespace.js';
import { isValidSessionId } from '../src/utils/sessionId.js';

const VALID_SESSION = '550e8400-e29b-41d4-a716-446655440000';

describe('session id validation', () => {
  it('accepts UUID v4', () => {
    assert.equal(isValidSessionId(VALID_SESSION), true);
  });

  it('rejects non-uuid values', () => {
    assert.equal(isValidSessionId('abc-123'), false);
    assert.equal(isValidSessionId(''), false);
  });
});

describe('rag namespace', () => {
  it('uses user id when authenticated', () => {
    const req = { user: { id: 'user-42' }, headers: {} };
    assert.equal(resolveRagNamespace(req), 'user-42');
  });

  it('uses valid session header when unauthenticated', () => {
    const req = { headers: { 'x-session-id': VALID_SESSION } };
    assert.equal(resolveRagNamespace(req), `session:${VALID_SESSION}`);
  });

  it('ignores invalid session ids', () => {
    const req = { headers: { 'x-session-id': 'abc-123' } };
    assert.equal(resolveRagNamespace(req), 'global');
  });

  it('prefers session over public guest identity', () => {
    const req = {
      user: { id: 'public', public: true },
      headers: { 'x-session-id': VALID_SESSION },
    };
    assert.equal(resolveRagNamespace(req), `session:${VALID_SESSION}`);
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
