import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import dotenv from 'dotenv';
import * as schema from "@shared/schema";

dotenv.config();


neonConfig.webSocketConstructor = ws;

console.log("sfdafasf");
console.log( "Connecting to database at", process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
pool.connect().then(() => {
  console.log("Database connection successful");
}).catch((err) => {
  console.error("Database connection failed:", err);
});
export const db = drizzle({ client: pool, schema });
