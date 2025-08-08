// Script to apply psychology questions migration

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database connection
const pool = new Pool({
  host: '187.33.153.208',
  port: 3003,
  user: 'rasaadmin',
  password: '81gm21x&1}e{',
  database: 'rasa1db',
  ssl: false,
});

const db = drizzle(pool);

async function applyPsychologyMigration() {
  try {
    console.log('Applying psychology questions migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'drizzle', 'migrations', 'add_psychology_questions_tables.sql');
    console.log(`Reading migration from: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found');
      return;
    }
    
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL migration
    console.log('Executing migration...');
    await db.execute(sql.raw(migration));
    
    console.log('Psychology questions migration applied successfully');
  } catch (error) {
    console.error('Error applying psychology migration:', error);
  } finally {
    await pool.end();
  }
}

// Run migration
applyPsychologyMigration()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to apply psychology migration:', err);
    process.exit(1);
  });
