import { CODE_GENERATORS, getCodeGenerator } from '../data/codeGenerators.js';
import { modelManager } from './modelManager.js';

export function listGenerators() {
  return CODE_GENERATORS;
}

function buildCodePrompt(generator, userPrompt) {
  return [
    `You are OWNAI Code Generator (${generator.name}).`,
    `Target language: ${generator.language}`,
    'Rules:',
    '1. Return production-ready code only.',
    '2. Prefer one complete solution block in a fenced code block.',
    '3. Add brief comments only where logic is non-obvious.',
    '4. Include minimal usage example when helpful.',
    '5. Do not include unrelated prose before or after code.',
    '',
    'Task:',
    userPrompt.trim(),
  ].join('\n');
}

export async function generateCode({
  generatorId,
  prompt,
  max_tokens = 768,
  temperature,
  model_key,
  model_src,
  stream = false,
}) {
  const generator = getCodeGenerator(generatorId);
  if (!generator) {
    const error = new Error(`Unknown code generator: ${generatorId}`);
    error.status = 404;
    throw error;
  }

  const fullPrompt = buildCodePrompt(generator, prompt);
  const resolvedTemperature = temperature ?? generator.temperature;

  if (stream) {
    const run = await modelManager.generateStream(fullPrompt, {
      max_tokens,
      temperature: resolvedTemperature,
      modelKey: model_key,
      modelSrc: model_src,
    });
    return { generator, run, prompt: fullPrompt };
  }

  const output = await modelManager.generate(fullPrompt, {
    max_tokens,
    temperature: resolvedTemperature,
    modelKey: model_key,
    modelSrc: model_src,
  });

  return {
    generator,
    output,
    prompt: fullPrompt,
    meta: {
      generator_id: generator.id,
      language: generator.language,
      extension: generator.extension,
      temperature: resolvedTemperature,
    },
  };
}
