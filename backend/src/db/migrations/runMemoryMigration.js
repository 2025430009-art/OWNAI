import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, initDatabase, isDatabaseAvailable } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMemoryMigration(client = null) {
  const sqlPath = path.join(__dirname, 'create_memory_tables.sql');
  const sql = await fs.readFile(sqlPath, 'utf-8');

  const owned = !client;
  const db = client || await getPool().connect();
  try {
    await db.query(sql);
    return verifyMemoryTables(db);
  } finally {
    if (owned) db.release();
  }
}

export async function verifyMemoryTables(client) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [['memories', 'knowledge_edges']],
  );

  const found = rows.map((r) => r.table_name);
  const required = ['memories', 'knowledge_edges'];
  const missing = required.filter((t) => !found.includes(t));

  return { tables: found, missing, ok: missing.length === 0 };
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
    const result = await runMemoryMigration(client);
    if (!result.ok) {
      console.error('Missing tables:', result.missing.join(', '));
      process.exit(1);
    }
    console.log('Memory migration OK — tables created:');
    for (const name of result.tables) {
      console.log(`  ✓ ${name}`);
    }
  } catch (error) {
    console.error('Memory migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await getPool().end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
