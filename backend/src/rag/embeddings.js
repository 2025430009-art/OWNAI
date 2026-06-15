import { pipeline } from '@xenova/transformers';
import { logger } from '../utils/logger.js';

let embedder = null;
let embedderLoading = null;

async function getEmbedder() {
  if (embedder) return embedder;
  if (embedderLoading) return embedderLoading;

  embedderLoading = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    .then((pipe) => {
      embedder = pipe;
      logger.info('RAG embedder loaded');
      return pipe;
    })
    .catch((err) => {
      embedderLoading = null;
      throw err;
    });

  return embedderLoading;
}

export async function embedText(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export async function embedBatch(texts) {
  const results = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
}
