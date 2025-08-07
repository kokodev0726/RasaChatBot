import { ChatOpenAI } from "@langchain/openai";
import { 
  ConversationChain, 
  LLMChain,
  SequentialChain,
  SimpleSequentialChain
} from "langchain/chains";
import { 
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { 
  BufferMemory,
  ConversationSummaryMemory,
  VectorStoreRetrieverMemory
} from "langchain/memory";
import { 
  OpenAIEmbeddings 
} from "@langchain/openai";
import { 
  MemoryVectorStore 
} from "langchain/vectorstores/memory";
import { 
  RunnableSequence,
  RunnablePassthrough
} from "@langchain/core/runnables";
import { 
  StringOutputParser 
} from "@langchain/core/output_parsers";
import { storage } from './storage';
import { getLangChainConfig } from './langchain.config';
import dotenv from 'dotenv';

dotenv.config();

const config = getLangChainConfig();

// Initialize LangChain components
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: config.modelName,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  streaming: true,
});

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Memory management
export class LangChainMemory {
  private memoryStore: Map<string, BufferMemory> = new Map();

  getMemory(userId: string): BufferMemory {
    if (!this.memoryStore.has(userId)) {
      this.memoryStore.set(userId, new BufferMemory({
        returnMessages: config.returnMessages,
        memoryKey: config.memoryKey,
        inputKey: "input",
      }));
    }
    return this.memoryStore.get(userId)!;
  }

  async clearMemory(userId: string): Promise<void> {
    this.memoryStore.delete(userId);
  }
}

// Conversation chain with memory
export class LangChainConversation {
  private memoryManager: LangChainMemory;

  constructor() {
    this.memoryManager = new LangChainMemory();
  }

  async createConversationChain(userId: string): Promise<ConversationChain> {
    const memory = this.memoryManager.getMemory(userId);
    
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(config.systemPrompt),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    return new ConversationChain({
      llm,
      memory,
      prompt,
    });
  }

  async createConversationChainWithContext(userId: string, contextSnippets: string): Promise<ConversationChain> {
    const memory = this.memoryManager.getMemory(userId);
    
    // Replace the context placeholder with actual context
    const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
    
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    return new ConversationChain({
      llm,
      memory,
      prompt,
    });
  }

  async* streamConversation(userId: string, message: string): AsyncGenerator<string> {
    try {
      // Get user chat history for context
      const agent = langChainAgent;
      const contextSnippets = await agent.getUserChatHistory(userId, 0);

      // Use the same prompt as OpenAI with context
      const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
      
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());

      // Stream the response
      const stream = await chain.stream({
        input: message,
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      console.error('LangChain conversation error:', error);
      throw new Error('Failed to generate conversation response');
    }
  }
}

// Advanced chains for specific tasks
export class LangChainChains {
  // Chain for generating chat titles
  async generateChatTitle(messages: string[]): Promise<string> {
    const titlePrompt = PromptTemplate.fromTemplate(config.titlePrompt);

    const titleChain = new LLMChain({
      llm,
      prompt: titlePrompt,
    });

    const firstMessage = messages[0] || "";
    const result = await titleChain.invoke({ message: firstMessage });
    return result.text.trim() || "Nueva Conversación";
  }

  // Chain for extracting user information
  async extractUserInfo(message: string): Promise<Record<string, string>> {
    const extractionPrompt = PromptTemplate.fromTemplate(config.extractionPrompt);

    const extractionChain = new LLMChain({
      llm,
      prompt: extractionPrompt,
    });

    try {
      const result = await extractionChain.invoke({ message });
      const jsonMatch = result.text.match(/\{.*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('Error extracting user info:', error);
      return {};
    }
  }

  // Sequential chain for processing user input
  async processUserInput(userId: string, message: string): Promise<{
    response: string;
    extractedInfo: Record<string, string>;
    title?: string;
  }> {
    // First chain: Extract user information
    const infoPrompt = PromptTemplate.fromTemplate(
      "Extrae información personal del mensaje: {message}\n\nRespuesta en formato JSON:"
    );
    const infoChain = new LLMChain({
      llm,
      prompt: infoPrompt,
      outputKey: "extracted_info",
    });

    // Second chain: Generate response
    const responsePrompt = PromptTemplate.fromTemplate(
      `Responde al siguiente mensaje de forma natural y útil en español.
      
      Información del usuario: {extracted_info}
      Mensaje: {message}
      
      Respuesta:`
    );
    const responseChain = new LLMChain({
      llm,
      prompt: responsePrompt,
      outputKey: "response",
    });

    // Create sequential chain
    const fullChain = new SequentialChain({
      chains: [infoChain, responseChain],
      inputVariables: ["message"],
      outputVariables: ["extracted_info", "response"],
    });

    const result = await fullChain.invoke({ message });
    
    let extractedInfo = {};
    try {
      const jsonMatch = result.extracted_info.match(/\{.*\}/);
      if (jsonMatch) {
        extractedInfo = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parsing extracted info:', error);
    }

    return {
      response: result.response,
      extractedInfo,
    };
  }
}

// Vector store for semantic search
export class LangChainVectorStore {
  private vectorStore: MemoryVectorStore;

  constructor() {
    this.vectorStore = new MemoryVectorStore(embeddings);
  }

  async addDocuments(documents: string[], metadata?: Record<string, any>[]): Promise<void> {
    await this.vectorStore.addDocuments(
      documents.map((doc, i) => ({
        pageContent: doc,
        metadata: metadata?.[i] || {},
      }))
    );
  }

  async similaritySearch(query: string, k: number = 5): Promise<string[]> {
    const results = await this.vectorStore.similaritySearch(query, k);
    return results.map(doc => doc.pageContent);
  }

  async similaritySearchWithScore(query: string, k: number = 5): Promise<Array<{ content: string; score: number }>> {
    const results = await this.vectorStore.similaritySearchWithScore(query, k);
    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      score,
    }));
  }
}

// Agent for complex reasoning
export class LangChainAgent {
  private conversation: LangChainConversation;
  private chains: LangChainChains;
  private vectorStore: LangChainVectorStore;

  constructor() {
    this.conversation = new LangChainConversation();
    this.chains = new LangChainChains();
    this.vectorStore = new LangChainVectorStore();
  }

  async* processMessage(userId: string, message: string, chatId?: number): AsyncGenerator<string> {
    // Check if the message contains a question about relationships or family members
    // This pattern looks for direct relationship questions
    const relationshipQuestionPattern = /(?:qué|cuál|cual)\s+(?:es|sería|seria)\s+(?:la\s+)?relaci[oó]n\s+(?:entre|de)\s+(\w+)\s+(?:y|con)\s+(\w+)/i;
    
    // This pattern looks for questions about specific relationships like "who is my sister?"
    const specificRelationshipPattern = /(?:quién|quien|quiénes|quienes|donde|dónde|cuál|cual)\s+(?:es|son|está|esta)\s+(?:mi|mis|tu|tus|su|sus)\s+(\w+)/i;
    
    // Match on either pattern
    const directMatch = message.match(relationshipQuestionPattern);
    const specificMatch = message.match(specificRelationshipPattern);
    
    try {
      // Import tool executor only once
      const { toolExecutor } = await import('./langchain.tools');
      
      // Handle direct relationship questions (e.g., "what is the relationship between X and Y?")
      if (directMatch) {
        const entity1 = directMatch[1];
        const entity2 = directMatch[2];
        
        try {
          const relationshipResult = await toolExecutor.executeTool(
            "infer_relationship",
            `${userId}:${entity1}:${entity2}`
          );
          
          // If we found a relationship, use it in the response
          if (!relationshipResult.includes("No relationship found")) {
            const relationshipParts = relationshipResult.split(': ');
            if (relationshipParts.length > 1) {
              const relationship = relationshipParts[1];
              
              // Create a natural language response
              const response = `${entity2} es ${relationship} de ${entity1}.`;
              
              // Stream the response as a whole, not character by character
              yield response;
              return;
            }
          }
        } catch (error) {
          console.error('Error inferring direct relationship:', error);
        }
      }
      
      // Handle specific relationship questions (e.g., "who is my sister?")
      else if (specificMatch) {
        const relationshipType = specificMatch[1].toLowerCase();
        
        try {
          // Get all relationships for this user
          const relationships = await storage.getRelationships(userId);
          
          // Filter relationships to find matches for the requested relationship type
          const matchingRelationships = relationships.filter(rel => {
            // Check if this is a relationship where "yo" or "me" is entity1 and the relationship matches
            return (
              (rel.entity1.toLowerCase() === 'yo' || rel.entity1.toLowerCase() === 'me') &&
              rel.relationship.toLowerCase().includes(relationshipType.toLowerCase())
            );
          });
          
          if (matchingRelationships.length > 0) {
            // Format a response with all matching relationships
            const familyMembers = matchingRelationships.map(rel => rel.entity2).join(', ');
            const response = `Tu ${relationshipType} es ${familyMembers}.`;
            
            // Stream the response
            yield response;
            return;
          }
          
          // Also check inverse relationships (e.g., if someone is looking for "sister" but it's stored as "hermana")
          const inverseMatches = relationships.filter(rel => {
            return (
              (rel.entity2.toLowerCase() === 'yo' || rel.entity2.toLowerCase() === 'me') &&
              rel.relationship.toLowerCase().includes(relationshipType.toLowerCase())
            );
          });
          
          if (inverseMatches.length > 0) {
            const familyMembers = inverseMatches.map(rel => rel.entity1).join(', ');
            const response = `Tu ${relationshipType} es ${familyMembers}.`;
            
            // Stream the response
            yield response;
            return;
          }
        } catch (error) {
          console.error('Error processing specific relationship query:', error);
        }
      }
      
      // Get both similar conversations and recent chat history for context
      const similarEmbeddings = await storage.getSimilarEmbeddings(userId, message, 3);
      const recentHistory = await this.getUserEmbeddingsHistory(userId, 5);
      
      // Combine both for better context
      let contextSnippets = await this.getUserChatHistory(userId, 0);
      
      // First add recent history (more important)
      // if (recentHistory && !recentHistory.startsWith("No conversation")) {
      //   contextSnippets += "--- Conversación reciente ---\n" + recentHistory + "\n\n";
      // }
      
      // Then add similar conversations
      // if (similarEmbeddings.length > 0) {
      //   const similarConversations = similarEmbeddings
      //     .map(s => `Usuario: ${s.user_input}\nAsistente: ${s.bot_output}`)
      //     .join('\n\n');
          
      //   if (similarConversations) {
      //     contextSnippets += "--- Conversaciones similares ---\n" + similarConversations;
      //   }
      // }

      // Create enhanced prompt with context using the same prompt as OpenAI
      const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
      
      const enhancedPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      const chain = enhancedPrompt.pipe(llm).pipe(new StringOutputParser());

      // Stream the response
      const stream = await chain.stream({
        input: message,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk;
        yield chunk;
      }

      // Store the interaction for future reference
      if (chatId) {
        await storage.createEmbedding(userId, message, fullResponse);
      }

      // Extract and store user information
      const extractedInfo = await this.chains.extractUserInfo(message);
      for (const [key, value] of Object.entries(extractedInfo)) {
        if (value && value.trim()) {
          await storage.setUserContext(userId, key, value);
        }
      }
      
      // Extract and store relationship information - this should be done for EVERY message
      try {
        const { toolExecutor } = await import('./langchain.tools');
        
        // Always try to extract and store relationships from every message
        const relationshipResult = await toolExecutor.executeTool(
          "extract_relationships",
          `${userId}:${message}`
        );
        console.log('Relationship extraction result:', relationshipResult);
        
        // After extracting relationships, get existing ones to enrich the context for the next interaction
        const relationships = await storage.getRelationships(userId);
        if (relationships.length > 0) {
          console.log(`Found ${relationships.length} stored relationships for user ${userId}`);
        }
        
        // Check if the message contains a request for listing family members or relationships
        const familyRelatedTerms = [
          'familiares', 'familia', 'parientes', 'relación', 'relacion',
          'conoces', 'sabes', 'sobre', 'listado', 'dame', 'dime', 'mostrar',
          'quienes son'
        ];
        
        const containsFamilyRequest = familyRelatedTerms.some(term =>
          message.toLowerCase().includes(term)
        );
        
        if (containsFamilyRequest && relationships.length > 0) {
          
          // Get all relationships for the user, filtering out duplicates by creating a unique key for each relationship
          const relationships = await storage.getRelationships(userId);
          
          // Group relationships by type to organize the display
          const groupedRelationships = this.groupRelationshipsByType(relationships);
          
          // Format relationships into a readable list
          if (relationships.length > 0) {
            try {
              // Get all user context information too
              const userContexts = await storage.getAllUserContext(userId);
              
              // Generate a complete response with the family information
              const familyInfoPrompt = `El usuario ha solicitado información sobre sus familiares.
              Según la información almacenada, estos son sus familiares:
              
              ${Object.entries(groupedRelationships).map(([type, rels]) =>
                `${type}:\n${rels.map(r => `- ${r.entity1} es ${r.relationship} de ${r.entity2}`).join('\n')}`
              ).join('\n\n')}
              
              Información adicional del usuario:
              ${userContexts.map(ctx => `- ${ctx.key}: ${ctx.value}`).join('\n')}
              
              Genera una respuesta natural y amigable en español que liste todos sus familiares de forma organizada.`;
              
              // Use a direct response instead of modifying the prompt
              const familyResponse = await llm.invoke(familyInfoPrompt);
              fullResponse = familyResponse.content as string;
              
              // Replace the streamed response with our custom response
              yield fullResponse;
              return;
            } catch (error) {
              console.error('Error generating family information response:', error);
              // Continue with normal flow if this fails
            }
          }
        }
      } catch (error) {
        console.error('Error processing relationships:', error);
        // Don't throw the error, just log it to avoid breaking the conversation flow
      }

    } catch (error) {
      console.error('LangChain agent error:', error);
      throw new Error('Failed to process message with LangChain agent');
    }
  }

  /**
   * Group relationships by their types for better organization
   */
  private groupRelationshipsByType(relationships: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'Familia': [],
      'Amistades': [],
      'Profesional': [],
      'Ubicaciones': [],
      'Posesiones': [],
      'Otros': []
    };
    
    // Helper function to determine relationship type
    const getRelationshipType = (rel: string): string => {
      const familyTerms = [
        'esposo', 'esposa', 'marido', 'mujer', 'hermano', 'hermana',
        'padre', 'madre', 'hijo', 'hija', 'abuelo', 'abuela', 'nieto', 'nieta',
        'tío', 'tía', 'sobrino', 'sobrina', 'primo', 'prima', 'cuñado', 'cuñada',
        'suegro', 'suegra', 'yerno', 'nuera', 'padrino', 'madrina'
      ];
      
      const friendshipTerms = ['amigo', 'amiga', 'novio', 'novia', 'pareja'];
      
      const professionalTerms = ['jefe', 'jefa', 'empleado', 'empleada', 'colega', 'compañero', 'compañera'];
      
      const locationTerms = ['vive_en', 'reside_en', 'ubicado_en', 'ubicación'];
      
      const possessionTerms = ['propietario', 'dueño', 'tiene', 'posee', 'pertenece'];
      
      rel = rel.toLowerCase();
      
      if (familyTerms.some(term => rel.includes(term))) return 'Familia';
      if (friendshipTerms.some(term => rel.includes(term))) return 'Amistades';
      if (professionalTerms.some(term => rel.includes(term))) return 'Profesional';
      if (locationTerms.some(term => rel.includes(term))) return 'Ubicaciones';
      if (possessionTerms.some(term => rel.includes(term))) return 'Posesiones';
      
      return 'Otros';
    };
    
    // Group the relationships
    for (const rel of relationships) {
      const type = getRelationshipType(rel.relationship);
      groups[type].push(rel);
    }
    
    // Remove empty categories
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });
    
    return groups;
  }
  
  /**
   * Get complete chat history for a specific user from all messages formatted for context
   * @param userId The ID of the user
   * @param limit Optional maximum number of messages to return
   * @returns Formatted chat history string
   */
  async getUserChatHistory(userId: string, limit?: number): Promise<string> {
    try {
      // Get all messages for the user directly (this will include messages from deleted chats)
      const userMessages = await storage.getUserMessages(userId, limit);
      
      if (userMessages.length === 0) {
        return "No chat history found for this user.";
      }
      
      // Reverse the messages to get chronological order (getUserMessages returns newest first)
      const chronologicalMessages = userMessages.reverse();
      
      // Format messages in the specified format
      const formattedHistory = chronologicalMessages.map(msg => {
        const role = msg.role === 'user' ? 'Usuario' : 'Asistente';
        return `${role}: ${msg.content}`;
      }).join('\n\n');
      
      return formattedHistory;
    } catch (error) {
      console.error('Error getting user chat history:', error);
      return "Error retrieving chat history.";
    }
  }
  
  /**
   * Get all embeddings history for a user formatted for context
   * @param userId The ID of the user
   * @param limit Optional maximum number of embeddings to return
   * @returns Formatted embeddings history string
   */
  async getUserEmbeddingsHistory(userId: string, limit: number = 10): Promise<string> {
    try {
      // Get raw embeddings without similarity search - this will get actual conversation history
      const embeddings = await storage.getUserEmbeddings(userId, limit);
      
      if (embeddings.length === 0) {
        return "No conversation history found for this user.";
      }
      
      // Format embeddings in the required format
      const formattedHistory = embeddings.map((e: { user_input: string; bot_output: string }) =>
        `Usuario: ${e.user_input}\nAsistente: ${e.bot_output}`
      ).join('\n\n');
      
      return formattedHistory;
    } catch (error) {
      console.error('Error getting user embeddings history:', error);
      return "Error retrieving conversation history.";
    }
  }
  
  async generateTitle(messages: string[]): Promise<string> {
    return await this.chains.generateChatTitle(messages);
  }
}

// Export instances
export const langChainConversation = new LangChainConversation();
export const langChainChains = new LangChainChains();
export const langChainVectorStore = new LangChainVectorStore();
export const langChainAgent = new LangChainAgent(); 