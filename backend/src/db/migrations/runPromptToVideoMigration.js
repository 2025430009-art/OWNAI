import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, initDatabase } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  await initDatabase();
  const sql = await fs.readFile(
    path.join(__dirname, 'create_prompt_to_video.sql'),
    'utf8',
  );
  await getPool().query(sql);
  console.log('PromptToVideo migration complete');
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
