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
  psychologyQuestions,
  userGeneratedQuestions,
  type PsychologyQuestion,
  type InsertPsychologyQuestion,
  type UserGeneratedQuestion,
  type InsertUserGeneratedQuestion,
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
  getUserMessages(userId: string, limit?: number): Promise<Message[]>;
  createEmbedding(userId: string, userInput: string, bot_output: string): Promise<any>;
  getSimilarEmbeddings(userId: string, query: string, topN?: number): Promise<
    { id: number; user_input: string; bot_output: string; distance: number }[]
  >;
  getUserEmbeddings(userId: string, limit?: number): Promise<
    { id: number; user_input: string; bot_output: string; created_at: Date }[]
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

  // Psychology questions operations
  addPsychologyQuestion(question: InsertPsychologyQuestion): Promise<PsychologyQuestion>;
  getPsychologyQuestions(limit?: number): Promise<PsychologyQuestion[]>;
  getPsychologyQuestionsByCategory(category: string): Promise<PsychologyQuestion[]>;
  getPsychologyQuestionById(id: number): Promise<PsychologyQuestion | undefined>;
  updatePsychologyQuestion(id: number, update: Partial<PsychologyQuestion>): Promise<PsychologyQuestion>;
  deletePsychologyQuestion(id: number): Promise<void>;

  // User generated questions operations
  addUserGeneratedQuestion(question: InsertUserGeneratedQuestion): Promise<UserGeneratedQuestion>;
  getUserGeneratedQuestions(userId?: string, limit?: number): Promise<UserGeneratedQuestion[]>;
  getUserGeneratedQuestionsByCategory(userId: string, category: string): Promise<UserGeneratedQuestion[]>;
  getUnusedUserGeneratedQuestions(userId: string, limit?: number): Promise<UserGeneratedQuestion[]>;
  getUserGeneratedQuestionById(id: number): Promise<UserGeneratedQuestion | undefined>;
  updateUserGeneratedQuestion(id: number, update: Partial<UserGeneratedQuestion>): Promise<UserGeneratedQuestion>;
  markUserGeneratedQuestionAsUsed(id: number): Promise<UserGeneratedQuestion>;
  deleteUserGeneratedQuestion(id: number): Promise<void>;
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
    // Only delete the chat, preserve messages for context
    // Messages now have userId so they can be retrieved even after chat deletion
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

  async getUserMessages(userId: string, limit?: number): Promise<Message[]> {
    const query = db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
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

  async getUserEmbeddings(userId: string, limit = 10): Promise<{ id: number; user_input: string; bot_output: string; created_at: Date }[]> {
    try {
      const { rows } = await db.execute<{
        id: number;
        user_input: string;
        bot_output: string;
        created_at: Date;
      }>(sql`
        SELECT id,
               user_input,
               bot_output,
               created_at
        FROM   embeddings
        WHERE  user_id = ${userId}
        ORDER  BY created_at DESC
        LIMIT  ${limit}
      `);

      return rows;
    } catch (error) {
      console.error('Error getting user embeddings:', error);
      return [];
    }
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
    // Normalize entity names for comparison
    const normalizedEntity1 = entity1.toLowerCase().trim();
    const normalizedEntity2 = entity2.toLowerCase().trim();
    
    // Special case for "me", "yo", "mi" - replace with common representation
    const entity1Norm = ['me', 'yo', 'mi', 'mis'].includes(normalizedEntity1) ? 'yo' : normalizedEntity1;
    const entity2Norm = ['me', 'yo', 'mi', 'mis'].includes(normalizedEntity2) ? 'yo' : normalizedEntity2;
    
    console.log(`Inferring relationship between: ${entity1Norm} and ${entity2Norm}`);
    
    // First, try to find direct relationships
    const directRelations = await this.findRelationship(userId, entity1Norm, entity2Norm);
    console.log(`Found ${directRelations.length} direct relationships`);
    
    if (directRelations.length > 0) {
      const relation = directRelations[0];
      if (relation.entity1.toLowerCase() === entity1Norm) {
        console.log(`Returning direct relationship: ${relation.relationship}`);
        return relation.relationship;
      } else {
        // Need to invert the relationship if entities are reversed
        const invertedRel = this.invertRelationship(relation.relationship);
        console.log(`Returning inverted relationship: ${invertedRel}`);
        return invertedRel;
      }
    }

    // If no direct relationship, try to find indirect relationships (with one intermediary)
    // Get all relationships involving entity1
    const entity1Relations = await this.getRelationshipsForEntity(userId, entity1Norm);
    // Get all relationships involving entity2
    const entity2Relations = await this.getRelationshipsForEntity(userId, entity2Norm);
    
    console.log(`Found ${entity1Relations.length} relationships for ${entity1Norm}`);
    console.log(`Found ${entity2Relations.length} relationships for ${entity2Norm}`);

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
      // Family relationships
      'esposa': 'esposo',
      'esposo': 'esposa',
      'wife': 'husband',
      'husband': 'wife',
      'mujer': 'marido',
      'marido': 'mujer',
      'hermano': 'hermano',
      'hermana': 'hermana',
      'brother': 'brother',
      'sister': 'sister',
      'padre': 'hijo',
      'madre': 'hija',
      'father': 'son',
      'mother': 'daughter',
      'hijo': 'padre',
      'hija': 'madre',
      'son': 'father',
      'daughter': 'mother',
      'abuelo': 'nieto',
      'abuela': 'nieta',
      'grandfather': 'grandson',
      'grandmother': 'granddaughter',
      'nieto': 'abuelo',
      'nieta': 'abuela',
      'grandson': 'grandfather',
      'granddaughter': 'grandmother',
      'tío': 'sobrino',
      'tía': 'sobrina',
      'uncle': 'nephew',
      'aunt': 'niece',
      'sobrino': 'tío',
      'sobrina': 'tía',
      'nephew': 'uncle',
      'niece': 'aunt',
      'primo': 'primo',
      'prima': 'prima',
      'cousin': 'cousin',
      'cuñado': 'cuñado',
      'cuñada': 'cuñada',
      'brother-in-law': 'sibling-in-law',
      'sister-in-law': 'sibling-in-law',
      'suegro': 'yerno',
      'suegra': 'nuera',
      'father-in-law': 'son-in-law',
      'mother-in-law': 'daughter-in-law',
      'yerno': 'suegro',
      'nuera': 'suegra',
      'son-in-law': 'father-in-law',
      'daughter-in-law': 'mother-in-law',
      
      // Possession relationships
      'propietario': 'pertenece_a',
      'propietaria': 'pertenece_a',
      'dueño': 'pertenece_a',
      'dueña': 'pertenece_a',
      'owner': 'belongs_to',
      'pertenece_a': 'propietario',
      'belongs_to': 'owner',
      'has': 'belongs_to',
      'tiene': 'pertenece_a',
      
      // Social relationships
      'amigo': 'amigo',
      'amiga': 'amiga',
      'friend': 'friend',
      'partner': 'partner',
      'pareja': 'pareja',
      'novio': 'novia',
      'novia': 'novio',
      'boyfriend': 'girlfriend',
      'girlfriend': 'boyfriend',
      'colega': 'colega',
      'colleague': 'colleague',
      'jefe': 'empleado',
      'jefa': 'empleada',
      'boss': 'employee',
      'empleado': 'jefe',
      'empleada': 'jefa',
      'employee': 'boss',
      
      // Location relationships
      'residente_de': 'ubicación_de',
      'resident_of': 'location_of',
      'ubicación_de': 'residente_de',
      'location_of': 'resident_of',
      'vive_en': 'hogar_de',
      'lives_in': 'home_of',
      'hogar_de': 'vive_en',
      'home_of': 'lives_in'
    };

    // If the relationship is not found in the map, return the original
    return relationshipInverses[relationship.toLowerCase()] || relationship;
  }

  private combineRelationships(rel1: string, intermediary: string, rel2: string): string {
    console.log(`Combining relationships: ${rel1} -> ${intermediary} -> ${rel2}`);
    
    // Convert to lowercase for easier comparison
    const r1 = rel1.toLowerCase();
    const r2 = rel2.toLowerCase();
    
    // Special cases for complex relationship combinations
    
    // In-law relationships
    if ((r1 === 'wife' || r1 === 'esposa' || r1 === 'mujer') &&
        (r2 === 'brother' || r2 === 'hermano')) {
      return 'brother-in-law';
    }
    if ((r1 === 'husband' || r1 === 'esposo' || r1 === 'marido') &&
        (r2 === 'brother' || r2 === 'hermano')) {
      return 'brother-in-law';
    }
    if ((r1 === 'wife' || r1 === 'esposa' || r1 === 'mujer') &&
        (r2 === 'sister' || r2 === 'hermana')) {
      return 'sister-in-law';
    }
    if ((r1 === 'husband' || r1 === 'esposo' || r1 === 'marido') &&
        (r2 === 'sister' || r2 === 'hermana')) {
      return 'sister-in-law';
    }
    
    // Sibling's spouse
    if ((r1 === 'brother' || r1 === 'hermano') &&
        (r2 === 'wife' || r2 === 'esposa' || r2 === 'mujer')) {
      return "brother's wife";
    }
    if ((r1 === 'sister' || r1 === 'hermana') &&
        (r2 === 'husband' || r2 === 'esposo' || r2 === 'marido')) {
      return "sister's husband";
    }
    
    // Parent's sibling (aunt/uncle)
    if ((r1 === 'father' || r1 === 'madre' || r1 === 'padre' || r1 === 'mother') &&
        (r2 === 'brother' || r2 === 'hermano')) {
      return 'uncle';
    }
    if ((r1 === 'father' || r1 === 'madre' || r1 === 'padre' || r1 === 'mother') &&
        (r2 === 'sister' || r2 === 'hermana')) {
      return 'aunt';
    }
    
    // Sibling's child (niece/nephew)
    if ((r1 === 'brother' || r1 === 'hermano' || r1 === 'sister' || r1 === 'hermana') &&
        (r2 === 'son' || r2 === 'hijo')) {
      return 'nephew';
    }
    if ((r1 === 'brother' || r1 === 'hermano' || r1 === 'sister' || r1 === 'hermana') &&
        (r2 === 'daughter' || r2 === 'hija')) {
      return 'niece';
    }
    
    // Default format if no special case matches
    return `${rel1}'s ${rel2}`;
  }

  // Psychology questions operations
  async addPsychologyQuestion(question: InsertPsychologyQuestion): Promise<PsychologyQuestion> {
    const [newQuestion] = await db
      .insert(psychologyQuestions)
      .values(question)
      .returning();
    return newQuestion;
  }

  async getPsychologyQuestions(limit?: number): Promise<PsychologyQuestion[]> {
    const query = db
      .select()
      .from(psychologyQuestions)
      .where(eq(psychologyQuestions.isActive, true))
      .orderBy(psychologyQuestions.orderIndex, psychologyQuestions.createdAt);
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
  }

  async getPsychologyQuestionsByCategory(category: string): Promise<PsychologyQuestion[]> {
    return await db
      .select()
      .from(psychologyQuestions)
      .where(and(eq(psychologyQuestions.category, category), eq(psychologyQuestions.isActive, true)))
      .orderBy(psychologyQuestions.orderIndex, psychologyQuestions.createdAt);
  }

  async getPsychologyQuestionById(id: number): Promise<PsychologyQuestion | undefined> {
    const [question] = await db
      .select()
      .from(psychologyQuestions)
      .where(eq(psychologyQuestions.id, id));
    return question;
  }

  async updatePsychologyQuestion(id: number, update: Partial<PsychologyQuestion>): Promise<PsychologyQuestion> {
    const [updatedQuestion] = await db
      .update(psychologyQuestions)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(psychologyQuestions.id, id))
      .returning();
    return updatedQuestion;
  }

  async deletePsychologyQuestion(id: number): Promise<void> {
    await db
      .delete(psychologyQuestions)
      .where(eq(psychologyQuestions.id, id));
  }

  // User generated questions operations
  async addUserGeneratedQuestion(question: InsertUserGeneratedQuestion): Promise<UserGeneratedQuestion> {
    const [newQuestion] = await db
      .insert(userGeneratedQuestions)
      .values(question)
      .returning();
    return newQuestion;
  }

  async getUserGeneratedQuestions(userId?: string, limit?: number): Promise<UserGeneratedQuestion[]> {
    if (userId) {
      const query = db
        .select()
        .from(userGeneratedQuestions)
        .where(eq(userGeneratedQuestions.userId, userId))
        .orderBy(desc(userGeneratedQuestions.createdAt));
      
      if (limit) {
        return await query.limit(limit);
      }
      
      return await query;
    } else {
      const query = db
        .select()
        .from(userGeneratedQuestions)
        .orderBy(desc(userGeneratedQuestions.createdAt));
      
      if (limit) {
        return await query.limit(limit);
      }
      
      return await query;
    }
  }

  async getUserGeneratedQuestionsByCategory(userId: string, category: string): Promise<UserGeneratedQuestion[]> {
    return await db
      .select()
      .from(userGeneratedQuestions)
      .where(and(eq(userGeneratedQuestions.userId, userId), eq(userGeneratedQuestions.category, category)))
      .orderBy(desc(userGeneratedQuestions.createdAt));
  }

  async getUnusedUserGeneratedQuestions(userId: string, limit?: number): Promise<UserGeneratedQuestion[]> {
    const query = db
      .select()
      .from(userGeneratedQuestions)
      .where(and(eq(userGeneratedQuestions.userId, userId), eq(userGeneratedQuestions.isUsed, false)))
      .orderBy(userGeneratedQuestions.createdAt);
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
  }

  async getUserGeneratedQuestionById(id: number): Promise<UserGeneratedQuestion | undefined> {
    const [question] = await db
      .select()
      .from(userGeneratedQuestions)
      .where(eq(userGeneratedQuestions.id, id));
    return question;
  }

  async updateUserGeneratedQuestion(id: number, update: Partial<UserGeneratedQuestion>): Promise<UserGeneratedQuestion> {
    const [updatedQuestion] = await db
      .update(userGeneratedQuestions)
      .set(update)
      .where(eq(userGeneratedQuestions.id, id))
      .returning();
    return updatedQuestion;
  }

  async markUserGeneratedQuestionAsUsed(id: number): Promise<UserGeneratedQuestion> {
    const [updatedQuestion] = await db
      .update(userGeneratedQuestions)
      .set({ isUsed: true, usedAt: new Date() })
      .where(eq(userGeneratedQuestions.id, id))
      .returning();
    return updatedQuestion;
  }

  async deleteUserGeneratedQuestion(id: number): Promise<void> {
    await db
      .delete(userGeneratedQuestions)
      .where(eq(userGeneratedQuestions.id, id));
  }
}

export const storage = new DatabaseStorage();
