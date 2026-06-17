import {
  config,
  ENABLE_QVAC,
} from '../config/index.js';
import path from 'path';
import { logger } from '../utils/logger.js';
import { isQvacOrRpcError } from './ollamaInference.js';

let QVAC_DISABLED_THIS_PROCESS = false;
let qvacSdkPromise = null;

async function loadQvacSdk() {
  if (!qvacSdkPromise) {
    qvacSdkPromise = import('@qvac/sdk');
  }
  return qvacSdkPromise;
}

class ModelManager {
  constructor() {
    this.cache = new Map();
    this.queue = [];
    this.processing = false;
    this.defaultModelKey = 'default';
  }

  isEnabled() {
    return ENABLE_QVAC && !QVAC_DISABLED_THIS_PROCESS;
  }

  resolveModelSrc(modelSrc, BUILTIN_MODELS) {
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
    if (!ENABLE_QVAC || QVAC_DISABLED_THIS_PROCESS) {
      console.log('[QVAC] Skipped — disabled for this environment');
      return null;
    }

    if (this.cache.has(modelKey)) {
      const entry = this.cache.get(modelKey);
      entry.lastUsed = Date.now();
      logger.info('[QVAC] model cache hit', { modelKey, modelId: entry.modelId });
      return entry.modelId;
    }

    console.log('[QVAC] worker lifecycle: loadModel starting', { modelKey });

    const startTime = Date.now();
    try {
      const { loadModel, LLAMA_3_2_1B_INST_Q4_0 } = await loadQvacSdk();
      const BUILTIN_MODELS = { LLAMA_3_2_1B_INST_Q4_0 };
      const resolvedSrc = this.resolveModelSrc(modelSrc, BUILTIN_MODELS);

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

      console.log('[QVAC] worker lifecycle: complete', { modelKey, modelId });
      return modelId;
    } catch (error) {
      console.error('[QVAC] worker lifecycle: failed —', error.message);
      QVAC_DISABLED_THIS_PROCESS = true;
      if (isQvacOrRpcError(error)) {
        logger.warn('[QVAC] disabling QVAC for this process after RPC/worker failure');
      }
      return null;
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
      if (!modelId) return null;

      const { completion } = await loadQvacSdk();
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

    const modelId = await this.ensureLoaded(modelKey, modelSrc);
    if (!modelId) return null;

    const { completion } = await loadQvacSdk();
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
    const { unloadModel } = await loadQvacSdk();
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
