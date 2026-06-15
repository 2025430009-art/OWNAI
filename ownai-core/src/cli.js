import { createRuntime } from './index.js';

function printHelp(plugins) {
  console.log(`
OWNAI — Local-first AI CLI

Usage:
  ownai <command> [args]
  ownai plugin list
  ownai health

Commands:`);
  for (const plugin of plugins) {
    for (const cmd of plugin.commands) {
      console.log(`  /${cmd.name.padEnd(28)} ${cmd.meta.description || ''}`);
    }
  }
  console.log(`
Examples:
  ownai inference:run "Explain quantum computing"
  ownai rag-pipeline:query "What is in my docs?"
  ownai model-ops:status
`);
}

export async function runCli(argv) {
  const [, , sub, ...rest] = argv;
  const { registry, bridge, executor } = await createRuntime();
  const plugins = registry.listPlugins();

  if (!sub || sub === 'help' || sub === '--help') {
    printHelp(plugins);
    return;
  }

  if (sub === 'plugin' && rest[0] === 'list') {
    for (const p of plugins) {
      console.log(`${p.name} v${p.version} — ${p.description}`);
      console.log(`  commands: ${p.commands.length}  agents: ${p.agents.length}  skills: ${p.skills.length}`);
    }
    return;
  }

  if (sub === 'health') {
    const status = await bridge.health();
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const slashName = sub.includes(':') ? sub : null;
  if (!slashName) {
    console.error(`Unknown subcommand: ${sub}`);
    printHelp(plugins);
    process.exit(1);
  }

  const args = rest.join(' ');
  const result = await executor.run(slashName, args);
  console.log(JSON.stringify(result.output, null, 2));
}
