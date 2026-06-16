import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, initDatabase, isDatabaseAvailable } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runThinkingMigration(client = null) {
  const sqlPath = path.join(__dirname, 'create_thinking_logs.sql');
  const sql = await fs.readFile(sqlPath, 'utf-8');

  const owned = !client;
  const db = client || await getPool().connect();
  try {
    await db.query(sql);
    return verifyThinkingTables(db);
  } finally {
    if (owned) db.release();
  }
}

export async function verifyThinkingTables(client) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'thinking_logs'`,
  );

  const ok = rows.some((r) => r.table_name === 'thinking_logs');
  return { tables: ok ? ['thinking_logs'] : [], missing: ok ? [] : ['thinking_logs'], ok };
}

async function main() {
  try {
    await initDatabase();
  } catch (error) {
    console.error('Base schema init failed:', error.message);
    process.exit(1);
  }

  if (!isDatabaseAvailable()) {
    console.error('PostgreSQL is not available. Start Postgres and set DATABASE_URL in .env');
    process.exit(1);
  }

  const client = await getPool().connect();
  try {
    const result = await runThinkingMigration(client);
    if (!result.ok) {
      console.error('Missing tables:', result.missing.join(', '));
      process.exit(1);
    }
    console.log('Thinking migration OK — tables created:');
    for (const name of result.tables) {
      console.log(`  ✓ ${name}`);
    }
  } catch (error) {
    console.error('Thinking migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await getPool().end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
