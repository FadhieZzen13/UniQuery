import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for migrations');
}

const pool = new Pool({ connectionString: databaseUrl });

const run = async () => {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    if (!sql.trim()) {
      continue;
    }
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }

  await pool.end();
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
