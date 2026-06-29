import { PluginRegistry } from './registry/plugin-registry.js';
import { CommandExecutor } from './executor/command-executor.js';
import { CapabilityBridge } from './bridge/capability-bridge.js';
import { ChatBridge } from './bridge/chat-bridge.js';

export { PluginRegistry, CommandExecutor, CapabilityBridge, ChatBridge };

export async function createRuntime(options = {}) {
  const registry = new PluginRegistry(options.root);
  await registry.load();
  const bridge = new CapabilityBridge(options.apiUrl);
  const chatBridge = new ChatBridge(options.apiUrl, options.chat || {});
  const executor = new CommandExecutor({ registry, bridge });
  return { registry, bridge, chatBridge, executor };
}
