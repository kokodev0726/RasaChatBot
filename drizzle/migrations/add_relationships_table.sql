-- Create relationships table
CREATE TABLE IF NOT EXISTS "relationships" (
  "id" SERIAL PRIMARY KEY,
  "user_id" VARCHAR NOT NULL REFERENCES "users"("id"),
  "entity1" VARCHAR NOT NULL,
  "relationship" VARCHAR NOT NULL,
  "entity2" VARCHAR NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_relationships_user_id" ON "relationships"("user_id");

-- Create indices for entity lookups
CREATE INDEX IF NOT EXISTS "idx_relationships_entity1" ON "relationships"("entity1");
CREATE INDEX IF NOT EXISTS "idx_relationships_entity2" ON "relationships"("entity2");