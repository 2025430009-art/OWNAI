/**
 * QVAC SDK smoke test — Week 1 Day 4-5
 * Run: npm run test:qvac
 */
import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk';

async function main() {
  console.log('🔄 Loading model...');
  const modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: 'llm',
    modelConfig: { ctx_size: 2048 },
    onProgress: (progress) => {
      if (progress.percentage !== undefined) {
        process.stdout.write(`\rDownload: ${progress.percentage}%`);
      }
    },
  });
  console.log('\n✅ Model loaded:', modelId);

  const history = [{ role: 'user', content: 'Hello AI platform!' }];
  const run = completion({ modelId, history, stream: true, max_tokens: 50 });

  process.stdout.write('Response: ');
  for await (const token of run.tokenStream) {
    process.stdout.write(token);
  }
  console.log('\n');

  await unloadModel({ modelId });
  console.log('✅ Model unloaded. QVAC test passed!');
}

main().catch((error) => {
  console.error('❌ QVAC test failed:', error.message);
  process.exit(1);
});
