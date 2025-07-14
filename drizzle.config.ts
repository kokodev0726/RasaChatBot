// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: '34.90.16.92',
    port: 5432,
    user: 'uy16jhvehgydq',
    password: '81gm21x&1}e{',
    database: 'dbwdverp4wjdfu',
    ssl: false,
  },
} satisfies Config;
