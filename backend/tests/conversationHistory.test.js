import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationHistory } from '../src/utils/conversationHistory.js';
import { OWNAI_SYSTEM_PROMPT } from '../src/config/personality.js';

describe('buildConversationHistory', () => {
  it('includes OWNAI system prompt', () => {
    const history = buildConversationHistory([], 'Hello');
    assert.deepEqual(history[0], { role: 'system', content: OWNAI_SYSTEM_PROMPT });
    assert.deepEqual(history[history.length - 1], { role: 'user', content: 'Hello' });
  });

  it('carries prior turns and appends latest user message', () => {
    const prior = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply' },
    ];
    const history = buildConversationHistory(prior, 'Second');
    assert.equal(history.length, 4);
    assert.equal(history[1].content, 'First');
    assert.equal(history[2].content, 'Reply');
    assert.equal(history[3].content, 'Second');
  });

  it('does not duplicate user message when already last turn', () => {
    const prior = [{ role: 'user', content: 'Same' }];
    const history = buildConversationHistory(prior, 'Same');
    assert.equal(history.filter((m) => m.role === 'user').length, 1);
  });
});
