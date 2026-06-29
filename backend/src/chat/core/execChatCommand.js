import { processChatCommand } from './processChatCommand.js';

/**
 * Single entry for all chat commands (SimpleX execChatCommand).
 * Used by REST bridge, /generate alias, and CLI.
 */
export async function execChatCommand(req, res, command) {
  return processChatCommand(req, res, command);
}

export { processChatCommand } from './processChatCommand.js';
