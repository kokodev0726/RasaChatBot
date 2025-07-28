import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';
import * as schema from '@shared/schema';

dotenv.config();

const pool = new Pool({
  host: '187.33.153.208',
  port: 3003,
  user: 'rasaadmin',
  password: '81gm21x&1}e{',
  database: 'rasa1db',
  ssl: false,
});

pool.connect()
  .then(() => console.log('Database connection successful'))
  .catch((err) => console.error('Database connection failed:', err));

export const db = drizzle(pool, { schema });
