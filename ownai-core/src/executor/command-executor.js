import { spawn } from 'child_process';
import path from 'path';
import { interpolateArguments, extractPhases } from '../parser/markdown.js';

export class CommandExecutor {
  constructor({ registry, bridge }) {
    this.registry = registry;
    this.bridge = bridge;
  }

  async run(slashName, args = '') {
    const found = this.registry.findCommand(slashName);
    if (!found) {
      throw new Error(`Unknown command: /${slashName}`);
    }

    const { plugin, command } = found;
    const body = interpolateArguments(command.body, args);
    const phases = extractPhases(body);

    const context = {
      plugin: plugin.name,
      command: command.name,
      args,
      phases,
      bridge: this.bridge,
      results: [],
    };

    await this.runHooks(plugin, 'PreCommand', context);

    const output = await this.executeWorkflow(command, context);

    await this.runHooks(plugin, 'PostCommand', context);

    return { plugin: plugin.name, command: command.name, output, context };
  }

  async executeWorkflow(command, context) {
    const name = command.name.split(':').pop();

    switch (name) {
      case 'run':
        return this.handleInferenceRun(context);
      case 'embed':
        return this.handleEmbed(context);
      case 'ingest':
        return this.handleRagIngest(context);
      case 'query':
        return this.handleRagQuery(context);
      case 'loop':
        return this.handleVoiceLoop(context);
      case 'load':
        return this.handleModelLoad(context);
      case 'status':
        return this.handleModelStatus(context);
      case 'unload':
        return this.handleModelUnload(context);
      case 'up':
        return this.handleDeployUp(context);
      case 'scaffold':
        return this.handleScaffold(context);
      default:
        return this.renderGuidance(command, context);
    }
  }

  async handleInferenceRun(ctx) {
    const prompt = ctx.args || 'Hello from OWNAI';
    const result = await ctx.bridge.generate(prompt, { max_tokens: 256 });
    return { type: 'inference', prompt, output: result.output };
  }

  async handleEmbed(ctx) {
    const text = ctx.args || 'sample text for embedding';
    const result = await ctx.bridge.execute('text-embeddings', { text });
    return { type: 'embeddings', dimensions: result.result?.dimensions };
  }

  async handleRagIngest(ctx) {
    const docs = ctx.args.split('|').map((d) => d.trim()).filter(Boolean);
    const result = await ctx.bridge.execute('rag', { action: 'ingest', documents: docs });
    return { type: 'rag-ingest', processed: result.result?.processed };
  }

  async handleRagQuery(ctx) {
    const query = ctx.args || 'What documents are indexed?';
    const result = await ctx.bridge.execute('rag', { action: 'query', query });
    return { type: 'rag-query', answer: result.result?.answer };
  }

  async handleVoiceLoop(ctx) {
    return {
      type: 'voice-loop',
      message: 'Voice loop requires audio input. Use the mobile app or POST /api/v1/capabilities/voice-assistant/execute with audio_base64.',
      phases: ctx.phases.map((p) => p.title),
    };
  }

  async handleModelLoad(ctx) {
    const result = await ctx.bridge.generate('ping', { max_tokens: 5 });
    return { type: 'model-warmup', status: 'loaded', sample: result.output };
  }

  async handleModelStatus(ctx) {
    return ctx.bridge.listModels();
  }

  async handleModelUnload(ctx) {
    const key = ctx.args || 'default';
    return ctx.bridge.unloadModel(key);
  }

  async handleDeployUp(ctx) {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', ['compose', 'up', '-d'], {
        cwd: path.resolve(process.cwd()),
        stdio: 'inherit',
      });
      child.on('close', (code) => {
        if (code === 0) resolve({ type: 'deploy', status: 'running' });
        else reject(new Error(`docker compose exited with code ${code}`));
      });
    });
  }

  async handleScaffold(ctx) {
    const slug = ctx.args || 'my-capability';
    return {
      type: 'scaffold',
      slug,
      steps: [
        `Add entry to backend/src/data/capabilities.js`,
        `Implement handler in backend/src/services/capabilityService.js`,
        `Add route in backend/src/routes/capabilities.js`,
        `Add card to frontend/src/data/capabilities.js`,
      ],
    };
  }

  renderGuidance(command, ctx) {
    return {
      type: 'guidance',
      description: command.meta.description,
      phases: ctx.phases.map((p) => ({ phase: p.number, title: p.title })),
      bodyPreview: command.body.slice(0, 500),
    };
  }

  async runHooks(plugin, event, context) {
    if (!plugin.hooks?.hooks?.[event]) return;
    for (const group of plugin.hooks.hooks[event]) {
      for (const hook of group.hooks || []) {
        if (hook.type === 'command' && hook.command) {
          const script = hook.command.replace('${OWNAI_PLUGIN_ROOT}', plugin.dir);
          await this.runShell(script, context);
        }
      }
    }
  }

  runShell(script, context) {
    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', script], {
        env: { ...process.env, OWNAI_ARGS: context.args || '' },
        stdio: 'pipe',
      });
      let out = '';
      child.stdout?.on('data', (d) => { out += d; });
      child.on('close', () => resolve(out));
    });
  }
}
