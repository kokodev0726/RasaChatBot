import { ChatOpenAI } from "@langchain/openai";
import { 
  DynamicTool,
  Tool
} from "@langchain/core/tools";
import { 
  CallbackManager
} from "@langchain/core/callbacks/manager";
import { getLangChainConfig } from './langchain.config';
import { storage } from './storage';

const config = getLangChainConfig();

// Initialize LLM for tools
const toolLLM = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: config.modelName,
  temperature: 0.1, // Lower temperature for tools
  streaming: false,
});

// Callback manager for logging
export const callbackManager = new CallbackManager();

// Tool for getting user context
export const getUserContextTool = new DynamicTool({
  name: "get_user_context",
  description: "Get stored user context information like name, age, location, preferences, etc.",
  func: async (userId: string) => {
    try {
      const userContexts = await storage.getAllUserContext(userId);
      if (userContexts.length === 0) {
        return "No user context information found.";
      }
      
      const contextString = userContexts
        .map(ctx => `${ctx.key}: ${ctx.value}`)
        .join(', ');
      
      return `User context: ${contextString}`;
    } catch (error) {
      console.error('Error getting user context:', error);
      return "Error retrieving user context.";
    }
  },
});

// Tool for setting user context
export const setUserContextTool = new DynamicTool({
  name: "set_user_context",
  description: "Store user context information like name, age, location, preferences, etc.",
  func: async (input: string) => {
    try {
      // Expected format: "userId:key:value"
      const [userId, key, value] = input.split(':');
      if (!userId || !key || !value) {
        return "Invalid format. Expected: userId:key:value";
      }
      
      await storage.setUserContext(userId, key, value);
      return `Successfully stored ${key}: ${value} for user ${userId}`;
    } catch (error) {
      console.error('Error setting user context:', error);
      return "Error storing user context.";
    }
  },
});

// Tool for searching similar conversations
export const searchSimilarConversationsTool = new DynamicTool({
  name: "search_similar_conversations",
  description: "Search for similar conversations based on user input to provide context-aware responses.",
  func: async (input: string) => {
    try {
      // Expected format: "userId:query:limit"
      const [userId, query, limitStr] = input.split(':');
      const limit = parseInt(limitStr) || 3;
      
      if (!userId || !query) {
        return "Invalid format. Expected: userId:query:limit";
      }
      
      const similarEmbeddings = await storage.getSimilarEmbeddings(userId, query, limit);
      if (similarEmbeddings.length === 0) {
        return "No similar conversations found.";
      }
      
      const contextSnippets = similarEmbeddings
        .map(s => `User: ${s.user_input}\nAssistant: ${s.bot_output}`)
        .join('\n\n');
      
      return `Similar conversations:\n${contextSnippets}`;
    } catch (error) {
      console.error('Error searching similar conversations:', error);
      return "Error searching similar conversations.";
    }
  },
});

// Tool for getting chat history
export const getChatHistoryTool = new DynamicTool({
  name: "get_chat_history",
  description: "Get the conversation history for a specific chat.",
  func: async (chatId: string) => {
    try {
      const chat = await storage.getChatWithMessages(parseInt(chatId));
      if (!chat) {
        return "Chat not found.";
      }
      
      const history = chat.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      return `Chat history:\n${history}`;
    } catch (error) {
      console.error('Error getting chat history:', error);
      return "Error retrieving chat history.";
    }
  },
});

// Tool for generating summaries
export const generateSummaryTool = new DynamicTool({
  name: "generate_summary",
  description: "Generate a summary of the conversation or text content.",
  func: async (content: string) => {
    try {
      const summaryPrompt = `Genera un resumen breve y conciso del siguiente contenido en español:

${content}

Resumen:`;

      const response = await toolLLM.invoke(summaryPrompt);
      return response.content as string;
    } catch (error) {
      console.error('Error generating summary:', error);
      return "Error generating summary.";
    }
  },
});

// Tool for language detection and translation
export const languageTool = new DynamicTool({
  name: "language_detection",
  description: "Detect the language of the input text and provide translation if needed.",
  func: async (text: string) => {
    try {
      const languagePrompt = `Analiza el siguiente texto y responde en formato JSON:
- Detecta el idioma
- Si no es español, proporciona una traducción al español
- Si es español, indica que no necesita traducción

Texto: "${text}"

Respuesta en formato JSON:`;

      const response = await toolLLM.invoke(languagePrompt);
      return response.content as string;
    } catch (error) {
      console.error('Error in language detection:', error);
      return "Error detecting language.";
    }
  },
});

// Tool for sentiment analysis
export const sentimentAnalysisTool = new DynamicTool({
  name: "sentiment_analysis",
  description: "Analyze the sentiment of the user's message to provide more empathetic responses.",
  func: async (text: string) => {
    try {
      const sentimentPrompt = `Analiza el sentimiento del siguiente texto y responde en formato JSON:
- Determina si es positivo, negativo, neutral, o mixto
- Identifica la emoción principal (alegría, tristeza, enojo, miedo, sorpresa, etc.)
- Proporciona una puntuación de -1 (muy negativo) a 1 (muy positivo)

Texto: "${text}"

Respuesta en formato JSON:`;

      const response = await toolLLM.invoke(sentimentPrompt);
      return response.content as string;
    } catch (error) {
      console.error('Error in sentiment analysis:', error);
      return "Error analyzing sentiment.";
    }
  },
});

// Tool for extracting relationships from text
export const extractRelationshipsTool = new DynamicTool({
  name: "extract_relationships",
  description: "Extract relationships between people or entities mentioned in text.",
  func: async (input: string) => {
    try {
      // Expected format: "userId:text"
      const [userId, text] = input.split(':', 2);
      const remainingText = input.substring(userId.length + 1);
      
      if (!userId || !remainingText) {
        return "Invalid format. Expected: userId:text containing relationships";
      }
      
      const relationshipPrompt = `Extrae todas las relaciones familiares o personales mencionadas en el siguiente texto.
      
      INSTRUCCIONES IMPORTANTES:
      - Si el texto menciona "mi esposa", "mi hermano", etc., considera "mi/yo" como entity1 con valor "me" o "yo"
      - Captura cualquier información sobre nombres, relaciones familiares, amistades, etc.
      - Sé exhaustivo y detecta todas las relaciones posibles, incluso las indirectas o sutiles
      - Normaliza los nombres (sin apodos ni diminutivos)
      
      Responde en formato JSON con un array de objetos que contengan:
      - entity1: La primera entidad (usa "me" o "yo" para referencias al hablante)
      - relationship: La relación de entity1 hacia entity2 (esposo, esposa, hermano, hermana, hijo, hija, madre, padre, etc.)
      - entity2: La segunda entidad

      EJEMPLOS:
      - "Mi esposa se llama Isabel" → [{"entity1":"yo","relationship":"esposo","entity2":"Isabel"}]
      - "Tengo dos hermanos. Óscar y Raúl" → [{"entity1":"yo","relationship":"hermano","entity2":"Óscar"},{"entity1":"yo","relationship":"hermano","entity2":"Raúl"}]
      - "Mi madre tiene 83 años y se llama Encarnación" → [{"entity1":"yo","relationship":"hijo","entity2":"Encarnación"},{"entity1":"Encarnación","relationship":"madre","entity2":"yo"}]
      
      Texto: "${remainingText}"
      
      Respuesta SOLO en formato JSON:`;
      
      const response = await toolLLM.invoke(relationshipPrompt);
      const content = response.content as string;
      
      // Extract JSON from the response - using a more compatible regex
      const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) {
        return "No relationships found or could not parse response.";
      }
      
      try {
        const relationships = JSON.parse(jsonMatch[0]);
        
        // Store relationships in database
        for (const rel of relationships) {
          await storage.addRelationship(
            userId,
            rel.entity1,
            rel.relationship,
            rel.entity2
          );
        }
        
        return `Successfully extracted and stored ${relationships.length} relationships.`;
      } catch (jsonError) {
        console.error('Error parsing JSON from relationship extraction:', jsonError);
        return "Error parsing extracted relationships.";
      }
    } catch (error) {
      console.error('Error extracting relationships:', error);
      return "Error extracting relationships.";
    }
  },
});

// Tool for inferring relationships between entities
export const inferRelationshipTool = new DynamicTool({
  name: "infer_relationship",
  description: "Infer the relationship between two entities based on stored relationship data.",
  func: async (input: string) => {
    try {
      // Expected format: "userId:entity1:entity2"
      const [userId, entity1, entity2] = input.split(':');
      
      if (!userId || !entity1 || !entity2) {
        return "Invalid format. Expected: userId:entity1:entity2";
      }
      
      const relationship = await storage.inferRelationship(userId, entity1, entity2);
      
      if (relationship) {
        return `Relationship from ${entity1} to ${entity2}: ${relationship}`;
      } else {
        return `No relationship found between ${entity1} and ${entity2}.`;
      }
    } catch (error) {
      console.error('Error inferring relationship:', error);
      return "Error inferring relationship.";
    }
  },
});

// Tool for getting all relationships for a user
export const getRelationshipsTool = new DynamicTool({
  name: "get_relationships",
  description: "Get all stored relationships for a user.",
  func: async (userId: string) => {
    try {
      const relationships = await storage.getRelationships(userId);
      
      if (relationships.length === 0) {
        return "No relationships stored for this user.";
      }
      
      const relationshipsText = relationships
        .map(r => `${r.entity1} ${r.relationship} ${r.entity2}`)
        .join('\n');
      
      return `Stored relationships:\n${relationshipsText}`;
    } catch (error) {
      console.error('Error getting relationships:', error);
      return "Error retrieving relationships.";
    }
  },
});

// Export all tools
export const langChainTools: Tool[] = [
  getUserContextTool,
  setUserContextTool,
  searchSimilarConversationsTool,
  getChatHistoryTool,
  generateSummaryTool,
  languageTool,
  sentimentAnalysisTool,
  extractRelationshipsTool,
  inferRelationshipTool,
  getRelationshipsTool,
];

// Tool executor utility
export class ToolExecutor {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
    langChainTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  async executeTool(toolName: string, input: string): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    try {
      return await tool.invoke(input);
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {};
    this.tools.forEach((tool, name) => {
      descriptions[name] = tool.description;
    });
    return descriptions;
  }
}

export const toolExecutor = new ToolExecutor(); 