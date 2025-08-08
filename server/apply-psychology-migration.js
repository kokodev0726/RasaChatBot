// Script to apply psychology questions migration

import { db } from './db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  }
}

// Run migration
(async () => {
  try {
    await applyPsychologyMigration();
  } catch (err) {
    console.error('Failed to apply psychology migration:', err);
  } finally {
    process.exit(0);
  }
})();
