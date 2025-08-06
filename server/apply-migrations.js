// Script to apply database migrations

import { db } from './db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigrations() {
  try {
    console.log('Applying migrations...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'drizzle', 'migrations', 'add_relationships_table.sql');
    console.log(`Reading migration from: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found');
      return;
    }
    
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL migration
    console.log('Executing migration...');
    await db.execute(sql.raw(migration));
    
    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
  }
}

// Run migrations
(async () => {
  try {
    await applyMigrations();
  } catch (err) {
    console.error('Failed to apply migrations:', err);
  } finally {
    process.exit(0);
  }
})();