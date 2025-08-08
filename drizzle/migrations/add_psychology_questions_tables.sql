-- Migration: Add psychology questions tables
-- Created: 2025-01-08

-- Create psychology_questions table
CREATE TABLE IF NOT EXISTS "psychology_questions" (
  "id" serial PRIMARY KEY,
  "question" text NOT NULL,
  "category" varchar NOT NULL,
  "is_active" boolean DEFAULT true,
  "order_index" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for psychology_questions
CREATE INDEX IF NOT EXISTS "idx_psychology_questions_category" ON "psychology_questions" ("category");
CREATE INDEX IF NOT EXISTS "idx_psychology_questions_active" ON "psychology_questions" ("is_active");

-- Create user_generated_questions table
CREATE TABLE IF NOT EXISTS "user_generated_questions" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "category" varchar NOT NULL,
  "is_used" boolean DEFAULT false,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- Create indexes for user_generated_questions
CREATE INDEX IF NOT EXISTS "idx_user_generated_questions_user_id" ON "user_generated_questions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_generated_questions_category" ON "user_generated_questions" ("category");
CREATE INDEX IF NOT EXISTS "idx_user_generated_questions_used" ON "user_generated_questions" ("is_used");
