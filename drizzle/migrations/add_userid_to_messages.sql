-- Add userId column to messages table
ALTER TABLE messages ADD COLUMN user_id VARCHAR;

-- Populate userId from the chat's userId
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