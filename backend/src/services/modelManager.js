import { config } from '../config/index.js';
import {
  loadModel,
  completion,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0,
} from '@qvac/sdk';
import path from 'path';
import { logger } from '../utils/logger.js';
import { isQvacOrRpcError } from './ollamaInference.js';

const BUILTIN_MODELS = {
  LLAMA_3_2_1B_INST_Q4_0,
};

class ModelManager {
  constructor() {
    this.cache = new Map();
    this.queue = [];
    this.processing = false;
    this.defaultModelKey = 'default';
    this.qvacDisabled = false;
  }

  isEnabled() {
    return config.inference?.enableQvac !== false && !this.qvacDisabled;
  }

  resolveModelSrc(modelSrc) {
    if (BUILTIN_MODELS[modelSrc]) {
      return BUILTIN_MODELS[modelSrc];
    }
    if (modelSrc.startsWith('http://') || modelSrc.startsWith('https://')) {
      return modelSrc;
    }
    if (modelSrc.startsWith('/') || modelSrc.startsWith('./')) {
      return path.resolve(modelSrc);
    }
    return path.join(config.modelPath, modelSrc);
  }

  async ensureLoaded(modelKey = this.defaultModelKey, modelSrc = config.defaultModelSrc) {
    if (!this.isEnabled()) {
      const err = new Error('QVAC local inference is disabled — use Anthropic or Ollama');
      err.code = 'qvac_disabled';
      throw err;
    }

    if (this.cache.has(modelKey)) {
      const entry = this.cache.get(modelKey);
      entry.lastUsed = Date.now();
      logger.info('[QVAC] model cache hit', { modelKey, modelId: entry.modelId });
      return entry.modelId;
    }

    const resolvedSrc = this.resolveModelSrc(modelSrc);
    logger.info('[QVAC] worker lifecycle: loadModel starting', { modelKey, modelSrc: resolvedSrc });
    logger.info('[QVAC] worker lifecycle: spawning Bare RPC worker via @qvac/sdk (30s init timeout)');

    const startTime = Date.now();
    try {
      const modelId = await loadModel({
        modelSrc: resolvedSrc,
        modelType: 'llm',
        modelConfig: { ctx_size: config.modelCtxSize },
        onProgress: (progress) => {
          if (progress.percentage !== undefined) {
            logger.debug('[QVAC] model download progress', { modelKey, percentage: progress.percentage });
          }
        },
      });

      this.cache.set(modelKey, {
        modelId,
        modelSrc: resolvedSrc,
        loadedAt: Date.now(),
        lastUsed: Date.now(),
        loadTimeMs: Date.now() - startTime,
      });

      logger.info('[QVAC] worker lifecycle: loadModel complete', {
        modelKey,
        modelId,
        loadTimeMs: Date.now() - startTime,
      });
      return modelId;
    } catch (error) {
      logger.error('[QVAC] worker lifecycle: loadModel failed', {
        modelKey,
        error: error.message,
        code: error.code,
      });
      if (isQvacOrRpcError(error)) {
        this.qvacDisabled = true;
        logger.warn('[QVAC] disabling QVAC for this process after RPC/worker failure');
      }
      throw error;
    }
  }

  async generate(prompt, options = {}) {
    const {
      modelKey = this.defaultModelKey,
      modelSrc = config.defaultModelSrc,
      max_tokens = 100,
      temperature = 0.7,
      stream = false,
      history: conversationHistory,
    } = options;

    return this.enqueue(async () => {
      const modelId = await this.ensureLoaded(modelKey, modelSrc);
      const history = conversationHistory?.length
        ? conversationHistory
        : [{ role: 'user', content: prompt }];

      logger.info('[QVAC] completion starting', { modelKey, stream, turns: history.length });

      const run = completion({
        modelId,
        history,
        stream,
        temperature,
        max_tokens,
      });

      if (stream) {
        let output = '';
        for await (const token of run.tokenStream) {
          output += token;
        }
        logger.info('[QVAC] completion stream finished', { chars: output.length });
        return output;
      }

      const result = await run.result;
      return result?.content ?? result?.text ?? String(result ?? '');
    });
  }

  async generateStream(prompt, options = {}) {
    const {
      modelKey = this.defaultModelKey,
      modelSrc = config.defaultModelSrc,
      max_tokens = 100,
      temperature = 0.7,
      history: conversationHistory,
    } = options;

    logger.info('[QVAC] generateStream starting', { modelKey });
    const modelId = await this.ensureLoaded(modelKey, modelSrc);
    const history = conversationHistory?.length
      ? conversationHistory
      : [{ role: 'user', content: prompt }];

    return completion({
      modelId,
      history,
      stream: true,
      temperature,
      max_tokens,
    });
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  getCacheStatus() {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      modelId: entry.modelId,
      modelSrc: entry.modelSrc,
      loadedAt: new Date(entry.loadedAt).toISOString(),
      lastUsed: new Date(entry.lastUsed).toISOString(),
      loadTimeMs: entry.loadTimeMs,
    }));
  }

  async unload(modelKey = this.defaultModelKey) {
    const entry = this.cache.get(modelKey);
    if (!entry) return false;

    logger.info('[QVAC] unloadModel', { modelKey, modelId: entry.modelId });
    await unloadModel({ modelId: entry.modelId });
    this.cache.delete(modelKey);
    return true;
  }

  async unloadAll() {
    const keys = Array.from(this.cache.keys());
    await Promise.all(keys.map((key) => this.unload(key)));
  }
}

export const modelManager = new ModelManager();
