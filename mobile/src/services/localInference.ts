import {
  loadModel,
  completion,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0,
} from '@qvac/sdk';

let cachedModelId: string | null = null;

export async function ensureLocalModel(): Promise<string> {
  if (cachedModelId) return cachedModelId;

  cachedModelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: 'llm',
    modelConfig: { ctx_size: 2048 },
    onProgress: (progress) => {
      if (progress.percentage !== undefined) {
        console.log(`Model download: ${progress.percentage}%`);
      }
    },
  });

  return cachedModelId;
}

export async function generateOffline(
  prompt: string,
  options: { max_tokens?: number; temperature?: number } = {}
): Promise<string> {
  const modelId = await ensureLocalModel();
  const history = [{ role: 'user' as const, content: prompt }];

  const run = completion({
    modelId,
    history,
    stream: true,
    max_tokens: options.max_tokens ?? 100,
    temperature: options.temperature ?? 0.7,
  });

  let output = '';
  for await (const token of run.tokenStream) {
    output += token;
  }
  return output;
}

export async function unloadLocalModel(): Promise<void> {
  if (cachedModelId) {
    await unloadModel({ modelId: cachedModelId });
    cachedModelId = null;
  }
}
