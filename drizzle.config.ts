// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: '187.33.153.208',
    port: 3003,
    user: 'rasaadmin',
    password: '81gm21x&1}e{',
    database: 'rasa1db',
    ssl: false,
  },
} satisfies Config;
