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
  relationships,
  type Relationship,
  type InsertRelationship,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { OpenAIEmbeddings } from '@langchain/openai';
import { embeddings } from '@shared/schema';

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
  
  // Relationship operations
  addRelationship(userId: string, entity1: string, relationship: string, entity2: string): Promise<Relationship>;
  getRelationships(userId: string): Promise<Relationship[]>;
  getRelationshipsForEntity(userId: string, entity: string): Promise<Relationship[]>;
  findRelationship(userId: string, entity1: string, entity2: string): Promise<Relationship[]>;
  inferRelationship(userId: string, entity1: string, entity2: string): Promise<string | null>;
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

  // Relationship operations
  async addRelationship(userId: string, entity1: string, relationship: string, entity2: string): Promise<Relationship> {
    const [newRelationship] = await db
      .insert(relationships)
      .values({
        userId,
        entity1: entity1.toLowerCase().trim(),
        relationship: relationship.toLowerCase().trim(),
        entity2: entity2.toLowerCase().trim()
      })
      .returning();
    return newRelationship;
  }

  async getRelationships(userId: string): Promise<Relationship[]> {
    return await db
      .select()
      .from(relationships)
      .where(eq(relationships.userId, userId))
      .orderBy(relationships.createdAt);
  }

  async getRelationshipsForEntity(userId: string, entity: string): Promise<Relationship[]> {
    const normalizedEntity = entity.toLowerCase().trim();
    return await db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.userId, userId),
          or(
            eq(relationships.entity1, normalizedEntity),
            eq(relationships.entity2, normalizedEntity)
          )
        )
      );
  }

  async findRelationship(userId: string, entity1: string, entity2: string): Promise<Relationship[]> {
    const normalizedEntity1 = entity1.toLowerCase().trim();
    const normalizedEntity2 = entity2.toLowerCase().trim();
    
    // Direct relationships between entity1 and entity2
    return await db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.userId, userId),
          or(
            and(
              eq(relationships.entity1, normalizedEntity1),
              eq(relationships.entity2, normalizedEntity2)
            ),
            and(
              eq(relationships.entity1, normalizedEntity2),
              eq(relationships.entity2, normalizedEntity1)
            )
          )
        )
      );
  }

  async inferRelationship(userId: string, entity1: string, entity2: string): Promise<string | null> {
    // First, try to find direct relationships
    const directRelations = await this.findRelationship(userId, entity1, entity2);
    if (directRelations.length > 0) {
      const relation = directRelations[0];
      if (relation.entity1.toLowerCase() === entity1.toLowerCase()) {
        return relation.relationship;
      } else {
        // Need to invert the relationship if entities are reversed
        return this.invertRelationship(relation.relationship);
      }
    }

    // If no direct relationship, try to find indirect relationships (with one intermediary)
    // Get all relationships involving entity1
    const entity1Relations = await this.getRelationshipsForEntity(userId, entity1);
    // Get all relationships involving entity2
    const entity2Relations = await this.getRelationshipsForEntity(userId, entity2);

    // Look for a common entity connecting entity1 and entity2
    for (const rel1 of entity1Relations) {
      const intermediary = rel1.entity1.toLowerCase() === entity1.toLowerCase() ? rel1.entity2 : rel1.entity1;
      
      for (const rel2 of entity2Relations) {
        const rel2Entity = rel2.entity1.toLowerCase() === entity2.toLowerCase() ? rel2.entity2 : rel2.entity1;
        
        if (intermediary.toLowerCase() === rel2Entity.toLowerCase()) {
          // Found a path: entity1 -> intermediary -> entity2
          const rel1Name = rel1.entity1.toLowerCase() === entity1.toLowerCase() ?
                           rel1.relationship :
                           this.invertRelationship(rel1.relationship);
                           
          const rel2Name = rel2.entity1.toLowerCase() === intermediary.toLowerCase() ?
                           rel2.relationship :
                           this.invertRelationship(rel2.relationship);
          
          return this.combineRelationships(rel1Name, intermediary, rel2Name);
        }
      }
    }

    return null; // No relationship found
  }

  private invertRelationship(relationship: string): string {
    // Map of relationships and their inverses
    const relationshipInverses: Record<string, string> = {
      'wife': 'husband',
      'husband': 'wife',
      'brother': 'sibling',
      'sister': 'sibling',
      'father': 'son',
      'mother': 'daughter',
      'son': 'father',
      'daughter': 'mother',
      'brother-in-law': 'sibling-in-law',
      'sister-in-law': 'sibling-in-law',
      'has': 'belongs to',
      'belongs to': 'has',
      'friend': 'friend',
      'partner': 'partner',
      'cousin': 'cousin',
      'aunt': 'niece/nephew',
      'uncle': 'niece/nephew',
      'niece': 'aunt/uncle',
      'nephew': 'aunt/uncle'
    };

    return relationshipInverses[relationship] || relationship;
  }

  private combineRelationships(rel1: string, intermediary: string, rel2: string): string {
    // Special cases for complex relationship combinations
    if (rel1 === 'wife' && rel2 === 'brother') {
      return 'brother-in-law';
    }
    if (rel1 === 'husband' && rel2 === 'brother') {
      return 'brother-in-law';
    }
    if (rel1 === 'wife' && rel2 === 'sister') {
      return 'sister-in-law';
    }
    if (rel1 === 'husband' && rel2 === 'sister') {
      return 'sister-in-law';
    }
    if (rel1 === 'brother' && rel2 === 'wife') {
      return "brother's wife";
    }
    if (rel1 === 'sister' && rel2 === 'husband') {
      return "sister's husband";
    }
    
    // Default format if no special case matches
    return `${rel1}'s ${rel2}`;
  }
}

export const storage = new DatabaseStorage();
