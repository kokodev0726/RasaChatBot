import dotenv from 'dotenv';

dotenv.config();

export interface LangChainConfig {
  // Model settings
  modelName: string;
  temperature: number;
  maxTokens: number;
  
  // Memory settings
  memoryKey: string;
  returnMessages: boolean;
  
  // Vector store settings
  similaritySearchK: number;
  
  // Agent settings
  enableAgent: boolean;
  enableMemory: boolean;
  enableVectorStore: boolean;
  
  // Prompt templates
  systemPrompt: string;
  titlePrompt: string;
  extractionPrompt: string;
}

export const langChainConfig: LangChainConfig = {
  // Model settings
  modelName: "gpt-4o",
  temperature: 0.7,
  maxTokens: 2000,
  
  // Memory settings
  memoryKey: "history",
  returnMessages: true,
  
  // Vector store settings
  similaritySearchK: 5,
  
  // Agent settings
  enableAgent: true,
  enableMemory: true,
  enableVectorStore: true,
  
  // Prompt templates
  systemPrompt: `Eres un asistente conversacional útil, amable y natural. 
Responde siempre en español de forma clara, breve y natural.

**IMPORTANTE:**
- No menciones a OpenAI ni que fuiste creado por Rasa AI.
- No digas frases típicas de chatbot como "¿En qué puedo ayudarte hoy?".
- Usa siempre la información ya proporcionada si es suficiente.
- Si el usuario menciona su nombre, edad, ubicación o cualquier otro dato personal, intégralo de forma natural.

Mantén un estilo conversacional y humano.`,

  titlePrompt: `Genera un título corto y descriptivo (máximo 6 palabras) para esta conversación basado en el primer mensaje del usuario. Devuelve solo el título, sin comillas ni texto adicional.

Mensaje: {message}`,

  extractionPrompt: `Extrae información personal del siguiente mensaje. 
Devuelve solo un JSON con las claves y valores encontrados.
Si no hay información personal, devuelve un objeto vacío.

Tipos de información a buscar:
- name: nombre del usuario
- age: edad
- location: ubicación
- job: trabajo/profesión
- interests: intereses/hobbies

Mensaje: {message}

Respuesta (solo JSON):`
};

// Environment-specific overrides
export function getLangChainConfig(): LangChainConfig {
  const config = { ...langChainConfig };
  
  // Override with environment variables if present
  if (process.env.LANGCHAIN_MODEL_NAME) {
    config.modelName = process.env.LANGCHAIN_MODEL_NAME;
  }
  
  if (process.env.LANGCHAIN_TEMPERATURE) {
    config.temperature = parseFloat(process.env.LANGCHAIN_TEMPERATURE);
  }
  
  if (process.env.LANGCHAIN_MAX_TOKENS) {
    config.maxTokens = parseInt(process.env.LANGCHAIN_MAX_TOKENS);
  }
  
  if (process.env.LANGCHAIN_SIMILARITY_SEARCH_K) {
    config.similaritySearchK = parseInt(process.env.LANGCHAIN_SIMILARITY_SEARCH_K);
  }
  
  return config;
} 