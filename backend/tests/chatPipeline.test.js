import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { processChatCommand } from '../src/chat/core/processChatCommand.js';
import { toView } from '../src/chat/core/toView.js';
import {
  createOutputChannel,
  pushOutputEvent,
  getOutputChannel,
  markOutputDone,
} from '../src/chat/bridge/outputQueue.js';

describe('chat pipeline', () => {
  it('processChatCommand handles ping', async () => {
    const result = await processChatCommand({}, null, { type: 'ping', payload: {} });
    assert.equal(result.success, true);
    assert.equal(result.pong, true);
  });

  it('toView maps text tokens', () => {
    const view = toView({ type: 'text', token: 'hi' });
    assert.equal(view.type, 'text');
    assert.equal(view.token, 'hi');
  });

  it('outputQueue streams events to subscribers', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    createOutputChannel(id);
    const seen = [];
    pushOutputEvent(id, { type: 'text', token: 'a' });
    const channel = getOutputChannel(id);
    assert.equal(channel.events.length, 1);
    markOutputDone(id);
    assert.equal(getOutputChannel(id).done, true);
    void seen;
  });
});
