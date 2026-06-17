import fs from 'fs/promises';
import path from 'path';
import { config, ENABLE_QVAC } from '../config/index.js';
import { logger } from '../utils/logger.js';

let qvacSdkPromise = null;

async function getQvac() {
  if (!ENABLE_QVAC) {
    throw Object.assign(new Error('QVAC capabilities are disabled in this environment'), { status: 503 });
  }
  if (!qvacSdkPromise) {
    qvacSdkPromise = import('@qvac/sdk');
  }
  return qvacSdkPromise;
}

const MODEL_ENV_KEYS = {
  llm: 'LLM_MODEL_SRC',
  embeddings: 'EMBEDDINGS_MODEL_SRC',
  whisper: 'WHISPER_MODEL_SRC',
  tts: 'TTS_MODEL_SRC',
  diffusion: 'DIFFUSION_MODEL_SRC',
  nmt: 'NMT_MODEL_SRC',
  ocr: 'OCR_MODEL_SRC',
  classification: 'CLASSIFICATION_MODEL_SRC',
  vla: 'VLA_MODEL_SRC',
};

class CapabilityService {
  constructor() {
    this.models = new Map();
  }

  resolveSrc(modelSrc, BUILTIN) {
    if (!modelSrc) return null;
    if (BUILTIN[modelSrc]) return BUILTIN[modelSrc];
    if (modelSrc.startsWith('http')) return modelSrc;
    if (path.isAbsolute(modelSrc) || modelSrc.startsWith('./')) {
      return path.resolve(modelSrc);
    }
    return path.join(config.modelPath, modelSrc);
  }

  async getModelSrc(modelType, override) {
    const { LLAMA_3_2_1B_INST_Q4_0 } = await getQvac();
    const BUILTIN = { LLAMA_3_2_1B_INST_Q4_0 };
    if (override) return this.resolveSrc(override, BUILTIN);
    const envKey = MODEL_ENV_KEYS[modelType];
    const fromEnv = envKey ? process.env[envKey] : null;
    if (fromEnv) return this.resolveSrc(fromEnv, BUILTIN);
    if (modelType === 'llm') return BUILTIN.LLAMA_3_2_1B_INST_Q4_0;
    return null;
  }

  async ensureModel(modelType, modelSrcOverride) {
    const cacheKey = `${modelType}:${modelSrcOverride || 'default'}`;
    if (this.models.has(cacheKey)) {
      return this.models.get(cacheKey);
    }

    const modelSrc = await this.getModelSrc(modelType, modelSrcOverride);
    if (!modelSrc) {
      throw Object.assign(
        new Error(`No model configured for type "${modelType}". Set ${MODEL_ENV_KEYS[modelType]} in .env`),
        { status: 503 }
      );
    }

    logger.info('Loading capability model', { modelType, modelSrc });
    const { loadModel } = await getQvac();
    const modelId = await loadModel({ modelSrc, modelType });
    this.models.set(cacheKey, modelId);
    return modelId;
  }

  async textGeneration({ prompt, max_tokens = 256, temperature = 0.7, model_src }) {
    const modelId = await this.ensureModel('llm', model_src);
    const { completion } = await getQvac();
    const run = completion({
      modelId,
      history: [{ role: 'user', content: prompt }],
      max_tokens,
      temperature,
      stream: false,
    });
    const result = await run.result;
    return { output: result?.content ?? result?.text ?? String(result ?? '') };
  }

  async textEmbeddings({ text, model_src }) {
    const modelId = await this.ensureModel('embeddings', model_src);
    const { embed } = await getQvac();
    const inputs = Array.isArray(text) ? text : [text];
    const { embedding } = await embed({ modelId, text: inputs.length === 1 ? inputs[0] : inputs });
    return {
      embeddings: Array.isArray(text) ? embedding : [embedding],
      dimensions: Array.isArray(embedding[0]) ? embedding[0].length : embedding.length,
    };
  }

  async rag({ action = 'query', documents, query, workspace = 'default', top_k = 5, model_src }) {
    const modelId = await this.ensureModel('llm', model_src);
    const { ragIngest, ragSearch, completion } = await getQvac();

    if (action === 'ingest') {
      if (!documents?.length) throw Object.assign(new Error('documents array required'), { status: 400 });
      const result = await ragIngest({ modelId, documents, workspace });
      return { action: 'ingest', processed: result.processed?.length ?? 0, workspace };
    }

    if (!query) throw Object.assign(new Error('query required'), { status: 400 });
    const chunks = await ragSearch({ modelId, query, workspace, topK: top_k });

    if (!chunks.length) {
      return { action: 'query', answer: 'No relevant documents found. Ingest documents first.', sources: [] };
    }

    const context = chunks.map((c, i) => `[${i + 1}] ${c.content || c.text}`).join('\n\n');
    const run = completion({
      modelId,
      history: [
        {
          role: 'user',
          content: `Use the following context to answer the question.\n\nContext:\n${context}\n\nQuestion: ${query}`,
        },
      ],
      stream: false,
    });
    const result = await run.result;
    return {
      action: 'query',
      answer: result?.content ?? result?.text ?? String(result ?? ''),
      sources: chunks,
    };
  }

  async fineTuning({ action = 'status', dataset_path, config: ftConfig, model_src }) {
    if (action === 'start') {
      const modelId = await this.ensureModel('llm', model_src);
      const { finetune } = await getQvac();
      finetune({
        modelId,
        dataset: dataset_path,
        ...ftConfig,
      });
      return { action: 'started', message: 'Fine-tuning job started', handle: 'Use job_id to track progress' };
    }
    return {
      action: 'info',
      message: 'Fine-tuning uses LoRA via QVAC finetune(). Provide dataset_path and config to start.',
      docs: 'https://docs.qvac.tether.io/reference/api/#finetune',
    };
  }

  async multimodal({ prompt, image_path, image_base64, model_src }) {
    const modelId = await this.ensureModel('llm', model_src);
    const { completion } = await getQvac();
    const content = [{ type: 'text', text: prompt }];
    if (image_path) {
      content.push({ type: 'image', image: image_path });
    } else if (image_base64) {
      content.push({ type: 'image', image: Buffer.from(image_base64, 'base64') });
    }

    const run = completion({
      modelId,
      history: [{ role: 'user', content }],
      stream: false,
    });
    const result = await run.result;
    return { output: result?.content ?? result?.text ?? String(result ?? '') };
  }

  async imageGeneration({ prompt, init_image_path, strength, model_src }) {
    const modelId = await this.ensureModel('diffusion', model_src);
    const { diffusion } = await getQvac();
    const params = { modelId, prompt };
    if (init_image_path) {
      params.init_image = init_image_path;
      if (strength !== undefined) params.strength = strength;
    }
    const { outputs, stats } = diffusion(params);
    const images = await Promise.all(
      outputs.map(async (buf, i) => ({
        index: i,
        base64: Buffer.from(buf).toString('base64'),
        mime: 'image/png',
      }))
    );
    return { images, stats: await stats };
  }

  async videoGeneration({ prompt, model_src }) {
    const modelId = await this.ensureModel('diffusion', model_src);
    const { video } = await getQvac();
    const result = video({ modelId, prompt });
    const outputs = await result.outputs;
    return {
      videos: outputs.map((buf, i) => ({
        index: i,
        base64: Buffer.from(buf).toString('base64'),
        mime: 'video/mp4',
      })),
    };
  }

  async transcription({ audio_path, audio_base64, model_src }) {
    const modelId = await this.ensureModel('whisper', model_src);
    const { transcribe } = await getQvac();
    let audio = audio_path;
    if (!audio && audio_base64) {
      const tmpPath = path.join(config.modelPath, `upload-${Date.now()}.wav`);
      await fs.writeFile(tmpPath, Buffer.from(audio_base64, 'base64'));
      audio = tmpPath;
    }
    if (!audio) throw Object.assign(new Error('audio_path or audio_base64 required'), { status: 400 });
    const text = await transcribe({ modelId, audio });
    return { text };
  }

  async textToSpeechRun({ text, model_src }) {
    const modelId = await this.ensureModel('tts', model_src);
    const { textToSpeech } = await getQvac();
    const result = textToSpeech({ modelId, text, stream: false });
    const buffer = await result.buffer;
    return {
      audio_base64: Buffer.from(new Uint8Array(buffer)).toString('base64'),
      mime: 'audio/wav',
      sample_rate: 22050,
    };
  }

  async voiceAssistant({ audio_path, audio_base64, max_tokens = 150, model_src }) {
    const asr = await this.transcription({ audio_path, audio_base64, model_src: process.env.WHISPER_MODEL_SRC });
    const llm = await this.textGeneration({
      prompt: asr.text,
      max_tokens,
      model_src: model_src || process.env.LLM_MODEL_SRC,
    });
    let audio = null;
    try {
      const tts = await this.textToSpeechRun({
        text: llm.output,
        model_src: process.env.TTS_MODEL_SRC,
      });
      audio = tts;
    } catch (err) {
      logger.warn('TTS unavailable in voice pipeline', { error: err.message });
    }
    return { transcript: asr.text, response: llm.output, audio };
  }

  async translationRun({ text, from = 'en', to = 'es', model_src }) {
    const modelId = await this.ensureModel('nmt', model_src);
    const { translate } = await getQvac();
    const result = translate({ modelId, text, from, to, stream: false });
    return { translation: await result.text };
  }

  async vla({ prompt, image_path, image_base64, model_src }) {
    const modelId = await this.ensureModel('vla', model_src);
    const { completion } = await getQvac();
    const image = image_path || (image_base64 ? Buffer.from(image_base64, 'base64') : null);
    if (!image) throw Object.assign(new Error('image_path or image_base64 required'), { status: 400 });
    const run = completion({
      modelId,
      history: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image', image }] }],
      stream: false,
    });
    const result = await run.result;
    return { action: result?.content ?? result?.text ?? String(result ?? '') };
  }

  async ocrRun({ image_path, image_base64, model_src }) {
    const modelId = await this.ensureModel('ocr', model_src);
    const { ocr } = await getQvac();
    const image = image_path || (image_base64 ? Buffer.from(image_base64, 'base64') : null);
    if (!image) throw Object.assign(new Error('image_path or image_base64 required'), { status: 400 });
    const { blocks } = ocr({ modelId, image });
    const results = await blocks;
    const text = results.map((b) => b.text).join('\n');
    return { text, blocks: results };
  }

  async imageClassification({ image_path, image_base64, model_src }) {
    const modelId = await this.ensureModel('classification', model_src);
    const { classify } = await getQvac();
    const image = image_path || (image_base64 ? Buffer.from(image_base64, 'base64') : null);
    if (!image) throw Object.assign(new Error('image_path or image_base64 required'), { status: 400 });
    const results = await classify({ modelId, image });
    return { classifications: results };
  }

  async execute(slug, body) {
    const handlers = {
      'text-generation': () => this.textGeneration(body),
      'text-embeddings': () => this.textEmbeddings(body),
      rag: () => this.rag(body),
      'fine-tuning': () => this.fineTuning(body),
      multimodal: () => this.multimodal(body),
      'image-generation': () => this.imageGeneration(body),
      'video-generation': () => this.videoGeneration(body),
      transcription: () => this.transcription(body),
      'text-to-speech': () => this.textToSpeechRun(body),
      'voice-assistant': () => this.voiceAssistant(body),
      translation: () => this.translationRun(body),
      vla: () => this.vla(body),
      ocr: () => this.ocrRun(body),
      'image-classification': () => this.imageClassification(body),
    };

    const handler = handlers[slug];
    if (!handler) throw Object.assign(new Error(`Unknown capability: ${slug}`), { status: 404 });
    return handler();
  }
}

export const capabilityService = new CapabilityService();
