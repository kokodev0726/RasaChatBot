-- Add userId column to messages table (nullable first)
ALTER TABLE messages ADD COLUMN user_id VARCHAR;

-- Populate userId from the chat's userId for existing messages
UPDATE messages 
SET user_id = (
    SELECT chats.user_id 
    FROM chats 
    WHERE chats.id = messages.chat_id
);

-- Make the column NOT NULL after populating data
ALTER TABLE messages ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE messages ADD CONSTRAINT messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);

-- Add index for better performance when querying by userId
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- Create other missing tables and constraints
CREATE TABLE IF NOT EXISTS "embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_input" text NOT NULL,
	"bot_output" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"user_id" varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS "relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"entity1" varchar NOT NULL,
	"relationship" varchar NOT NULL,
	"entity2" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_context" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"context_key" varchar NOT NULL,
	"context_value" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints for other tables
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'embeddings_user_id_users_id_fk') THEN
        ALTER TABLE embeddings ADD CONSTRAINT embeddings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'relationships_user_id_users_id_fk') THEN
        ALTER TABLE relationships ADD CONSTRAINT relationships_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_context_user_id_users_id_fk') THEN
        ALTER TABLE user_context ADD CONSTRAINT user_context_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_entity1 ON relationships(entity1);
CREATE INDEX IF NOT EXISTS idx_relationships_entity2 ON relationships(entity2);