import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';
import * as schema from '@shared/schema';

dotenv.config();

const pool = new Pool({
  host: '34.90.16.92',
  port: 5432,
  user: 'uy16jhvehgydq',
  password: '81gm21x&1}e{',
  database: 'dbwdverp4wjdfu',
  ssl: false,
});

pool.connect()
  .then(() => console.log('Database connection successful'))
  .catch((err) => console.error('Database connection failed:', err));

export const db = drizzle(pool, { schema });
