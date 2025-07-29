import {
  users,
  chats,
  messages,
  userContext,
  type User,
  type UpsertUser,
  type Chat,
  type InsertChat,
  type Message,
  type InsertMessage,
  type ChatWithMessages,
  type InsertUserContext,
  type UserContext,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { OpenAIEmbeddings } from '@langchain/openai';
import { embeddings } from '@shared/schema';
import { sql } from 'drizzle-orm';

const openai = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
});


// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string; password: string; firstName?: string | null; lastName?: string | null }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Chat operations
  getUserChats(userId: string): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  getChat(chatId: number): Promise<ChatWithMessages | undefined>;
  getChatWithMessages(chatId: number): Promise<ChatWithMessages | undefined>;
  deleteChat(chatId: number, userId: string): Promise<void>;
  updateChatTitle(chatId: number, title: string): Promise<void>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getChatMessages(chatId: number): Promise<Message[]>;
  createEmbedding(userId: string, userInput: string, bot_output: string): Promise<any>;
  getSimilarEmbeddings(userId: string, query: string, topN?: number): Promise<
    { id: number; user_input: string; bot_output: string; distance: number }[]
  >;
  
  // User context operations
  setUserContext(userId: string, key: string, value: string): Promise<void>;
  getUserContext(userId: string, key: string): Promise<string | null>;
  getAllUserContext(userId: string): Promise<{ key: string; value: string }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: { email: string; password: string; firstName?: string | null; lastName?: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Chat operations
  async getUserChats(userId: string): Promise<Chat[]> {
    return await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.updatedAt));
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db
      .insert(chats)
      .values(chat)
      .returning();
    return newChat;
  }

  async getChat(chatId: number): Promise<ChatWithMessages | undefined> {
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId));
    
    if (!chat) return undefined;

    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    return {
      ...chat,
      messages: chatMessages,
    };
  }

  async getChatWithMessages(chatId: number): Promise<ChatWithMessages | undefined> {
    return this.getChat(chatId);
  }

  async deleteChat(chatId: number, userId: string): Promise<void> {
    // First delete all messages in the chat
    await db.delete(messages).where(eq(messages.chatId, chatId));
    
    // Then delete the chat (only if it belongs to the user)
    await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  }

  async updateChatTitle(chatId: number, title: string): Promise<void> {
    await db
      .update(chats)
      .set({ title })
      .where(eq(chats.id, chatId));
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getChatMessages(chatId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  }

  async createEmbedding(userId: string, userInput: string, bot_output: string): Promise<any> {
    const embedding = await openai.embedQuery(userInput) as number[]; // ensure number[]
    const [newEmbedding] = await db
      .insert(embeddings)
      .values({
        user_input: userInput,
        bot_output: bot_output,
        embedding: embedding, // Store as number[] for pgvector
        userId: userId, // Store userId
      })
      .returning();
    return newEmbedding;
  }

  async getSimilarEmbeddings(userId: string, query: string, topN = 10): Promise<{ id: number; user_input: string; bot_output: string; distance: number }[]> {
    const queryEmbedding = await openai.embedQuery(query);
    // Convert embedding array to Postgres vector literal string
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const { rows } = await db.execute<{
      id: number;
      user_input: string;
      bot_output: string;
      distance: number;
    }>(sql`
      SELECT id,
             user_input,
             bot_output,
             embedding <-> ${embeddingStr}::vector AS distance
      FROM   embeddings
      WHERE  user_id = ${userId}
      ORDER  BY embedding <-> ${embeddingStr}::vector ASC
      LIMIT  ${topN}
    `);

    return rows;
  }

  // User context operations
  async setUserContext(userId: string, key: string, value: string): Promise<void> {
    await db
      .insert(userContext)
      .values({ userId, contextKey: key, contextValue: value })
      .onConflictDoUpdate({
        target: [userContext.userId, userContext.contextKey],
        set: { contextValue: value, updatedAt: new Date() },
      });
  }

  async getUserContext(userId: string, key: string): Promise<string | null> {
    const [context] = await db
      .select()
      .from(userContext)
      .where(and(eq(userContext.userId, userId), eq(userContext.contextKey, key)));
    return context?.contextValue || null;
  }

  async getAllUserContext(userId: string): Promise<{ key: string; value: string }[]> {
    const contexts = await db
      .select()
      .from(userContext)
      .where(eq(userContext.userId, userId));
    return contexts.map(ctx => ({ key: ctx.contextKey, value: ctx.contextValue }));
  }
}


export const storage = new DatabaseStorage();
