import path from 'path';
import { readJson, readText, listFiles, fileExists, getProjectRoot, slugify } from '../utils/fs.js';
import { parseMarkdownDocument } from '../parser/markdown.js';

export class PluginRegistry {
  constructor(rootDir) {
    this.root = rootDir || getProjectRoot();
    this.marketplacePath = path.join(this.root, '.ownai-plugin', 'marketplace.json');
    this.plugins = new Map();
  }

  async load() {
    const marketplace = await readJson(this.marketplacePath);
    for (const entry of marketplace.plugins) {
      const pluginDir = path.resolve(this.root, entry.source);
      const manifestPath = path.join(pluginDir, '.ownai-plugin', 'plugin.json');
      const manifest = await readJson(manifestPath);
      const plugin = await this.loadPlugin(pluginDir, { ...entry, ...manifest });
      this.plugins.set(entry.name, plugin);
    }
    return this;
  }

  async loadPlugin(pluginDir, meta) {
    const commandsDir = path.join(pluginDir, 'commands');
    const agentsDir = path.join(pluginDir, 'agents');
    const skillsDir = path.join(pluginDir, 'skills');
    const hooksPath = path.join(pluginDir, 'hooks', 'hooks.json');

    const commands = await this.loadCommands(commandsDir, meta.name);
    const agents = await this.loadAgents(agentsDir);
    const skills = await this.loadSkills(skillsDir);
    const hooks = (await fileExists(hooksPath)) ? await readJson(hooksPath) : null;

    return {
      ...meta,
      dir: pluginDir,
      commands,
      agents,
      skills,
      hooks,
    };
  }

  async loadCommands(commandsDir, pluginName) {
    const files = await listFiles(commandsDir, '.md');
    const commands = [];
    for (const file of files) {
      const raw = await readText(file);
      const { meta, body } = parseMarkdownDocument(raw);
      const base = path.basename(file, '.md');
      const slashName = base.includes(':') ? base : `${pluginName}:${base}`;
      commands.push({
        plugin: pluginName,
        name: slashName,
        file,
        meta,
        body,
      });
    }
    return commands;
  }

  async loadAgents(agentsDir) {
    const files = await listFiles(agentsDir, '.md');
    const agents = [];
    for (const file of files) {
      const raw = await readText(file);
      const { meta, body } = parseMarkdownDocument(raw);
      agents.push({
        name: meta.name || slugify(path.basename(file)),
        file,
        meta,
        body,
      });
    }
    return agents;
  }

  async loadSkills(skillsDir) {
    if (!(await fileExists(skillsDir))) return [];
    const { readdir } = await import('fs/promises');
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      let skillFile;
      if (entry.isDirectory()) {
        skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      } else if (entry.name === 'SKILL.md') {
        skillFile = path.join(skillsDir, 'SKILL.md');
      } else {
        continue;
      }
      if (!(await fileExists(skillFile))) continue;
      const raw = await readText(skillFile);
      const { meta, body } = parseMarkdownDocument(raw);
      skills.push({ name: meta.name, dir: path.dirname(skillFile), meta, body });
    }
    return skills;
  }

  listPlugins() {
    return Array.from(this.plugins.values());
  }

  findCommand(slashName) {
    for (const plugin of this.plugins.values()) {
      const cmd = plugin.commands.find((c) => c.name === slashName || c.name.endsWith(`:${slashName}`));
      if (cmd) return { plugin, command: cmd };
    }
    return null;
  }

  findAgent(agentName) {
    for (const plugin of this.plugins.values()) {
      const agent = plugin.agents.find((a) => a.name === agentName);
      if (agent) return { plugin, agent };
    }
    return null;
  }
}
