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
  description: "Extract relationships between people, objects, locations, or any entities mentioned in text.",
  func: async (input: string) => {
    try {
      // Expected format: "userId:text"
      const [userId, text] = input.split(':', 2);
      const remainingText = input.substring(userId.length + 1);
      
      if (!userId || !remainingText) {
        return "Invalid format. Expected: userId:text containing relationships";
      }
      
      const relationshipPrompt = `Extrae TODAS las relaciones mencionadas en el siguiente texto, incluyendo relaciones familiares, personales, posesión, ubicación, pertenencia, y cualquier otra relación entre entidades.
      
      INSTRUCCIONES IMPORTANTES:
      - Si el texto menciona "mi esposa", "mi hermano", "mi casa", etc., considera "mi/yo" como entity1 con valor "yo"
      - Captura TODAS las relaciones: familiares, personales, propiedad, ubicación, pertenencia, uso, etc.
      - PRESTA ESPECIAL ATENCIÓN a menciones de hermanos/hermanas, especialmente indirectas
      - Infiere relaciones implícitas (ej: "Tengo hermanos" → relación hermano/hermana)
      - Recuerda que los posesivos (mi, tu, su) indican relaciones
      - Detecta relaciones entre personas y objetos/lugares (ej: "vivo en Madrid" → relación de residencia)
      - Sé muy exhaustivo y detecta TODAS las relaciones posibles, incluso las indirectas o sutiles
      - Normaliza los nombres (sin apodos ni diminutivos)
      - Si hay ambigüedad sobre el tipo de relación, usa una descripción general
      
      Responde en formato JSON con un array de objetos que contengan:
      - entity1: La primera entidad (usa "yo" para referencias al hablante)
      - relationship: La relación de entity1 hacia entity2 (esposo, esposa, hermano, hermana, hijo, hija, madre, padre, dueño, ubicado_en, etc.)
      - entity2: La segunda entidad
      - type: El tipo de relación (familiar, personal, posesión, ubicación, etc.)

      EJEMPLOS VARIADOS:
      - "Mi esposa se llama Isabel" → [{"entity1":"yo","relationship":"esposo","entity2":"Isabel","type":"familiar"}]
      - "Tengo dos hermanos. Óscar y Raúl" → [{"entity1":"yo","relationship":"hermano","entity2":"Óscar","type":"familiar"},{"entity1":"yo","relationship":"hermano","entity2":"Raúl","type":"familiar"}]
      - "Mi madre tiene 83 años y se llama Encarnación" → [{"entity1":"yo","relationship":"hijo","entity2":"Encarnación","type":"familiar"},{"entity1":"Encarnación","relationship":"madre","entity2":"yo","type":"familiar"}]
      - "Mi hermana se llama Laura" → [{"entity1":"yo","relationship":"hermano","entity2":"Laura","type":"familiar"},{"entity1":"Laura","relationship":"hermana","entity2":"yo","type":"familiar"}]
      - "Vivo en Madrid" → [{"entity1":"yo","relationship":"reside_en","entity2":"Madrid","type":"ubicación"}]
      - "Mi coche es un Toyota" → [{"entity1":"yo","relationship":"propietario","entity2":"coche","type":"posesión"},{"entity1":"coche","relationship":"marca","entity2":"Toyota","type":"propiedad"}]
      - "Mi empresa se dedica a la tecnología" → [{"entity1":"yo","relationship":"propietario","entity2":"empresa","type":"posesión"},{"entity1":"empresa","relationship":"dedicada_a","entity2":"tecnología","type":"actividad"}]
      - "Uso un iPhone" → [{"entity1":"yo","relationship":"usuario","entity2":"iPhone","type":"uso"}]
      - "He visitado París" → [{"entity1":"yo","relationship":"ha_visitado","entity2":"París","type":"experiencia"}]
      
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
        
        // Helper function to get inverse relationship
        const getInverseRelationship = (rel: string): string => {
          const inverseMap: Record<string, string> = {
            'esposo': 'esposa',
            'esposa': 'esposo',
            'marido': 'mujer',
            'mujer': 'marido',
            'padre': 'hijo',
            'madre': 'hijo',
            'hijo': 'padre',
            'hija': 'padre',
            'hermano': 'hermano',
            'hermana': 'hermano',
            'abuelo': 'nieto',
            'abuela': 'nieto',
            'nieto': 'abuelo',
            'nieta': 'abuelo',
            'tío': 'sobrino',
            'tía': 'sobrino',
            'sobrino': 'tío',
            'sobrina': 'tío',
            'primo': 'primo',
            'prima': 'primo',
            'amigo': 'amigo',
            'amiga': 'amigo',
            'jefe': 'empleado',
            'jefa': 'empleado',
            'empleado': 'jefe',
            'empleada': 'jefe',
            'propietario': 'pertenece_a',
            'pertenece_a': 'propietario',
          };
          
          return inverseMap[rel] || rel;
        };
        
        // Store relationships in database
        for (const rel of relationships) {
          // Normalize entity names and relationships
          const entity1 = rel.entity1.toLowerCase().trim();
          const relationship = rel.relationship.toLowerCase().trim();
          const entity2 = rel.entity2.toLowerCase().trim();
          
          // Skip empty relationships
          if (!entity1 || !relationship || !entity2) {
            continue;
          }
          
          console.log(`Storing relationship: ${entity1} ${relationship} ${entity2} (${rel.type || 'unknown'})`);
          
          try {
            await storage.addRelationship(
              userId,
              entity1,
              relationship,
              entity2
            );
          } catch (storeError) {
            console.error('Error storing individual relationship:', storeError);
            // Continue with other relationships even if one fails
          }
          
          // For family relationships, also store the inverse relationship for better recall
          if (rel.type === 'familiar' || !rel.type) {
            try {
              // Get the inverse relationship
              const inverseRel = getInverseRelationship(relationship);
              if (inverseRel && inverseRel !== relationship) {
                console.log(`Also storing inverse relationship: ${entity2} ${inverseRel} ${entity1}`);
                await storage.addRelationship(
                  userId,
                  entity2,
                  inverseRel,
                  entity1
                );
              }
            } catch (inverseError) {
              console.error('Error storing inverse relationship:', inverseError);
            }
          }
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