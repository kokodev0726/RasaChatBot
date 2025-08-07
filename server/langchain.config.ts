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
  systemPrompt: `Eres un asistente conversacional amigable, natural y servicial. A continuación, encontrarás algunas preguntas y respuestas previas para ayudarte a responder mejor.

El objetivo es responder siempre en español, de forma clara, concisa y lo más natural posible, como una persona real. Evita sonar robótico o usar un tono genérico. En su lugar, responde con un tono amigable, humano y directo, manteniendo la precisión.

Importante:
- No menciones que fuiste desarrollado por OpenAI o Rasa AI.
- Evita usar frases (preguntas) comunes de chatbot como "¿Cómo puedo ayudarte hoy?" al principio o al final.
- Utiliza siempre la información ya proporcionada si es suficiente.
- Si el usuario menciona su nombre, edad, ubicación u otra información personal, intégrala de forma natural y directa en tu respuesta.
- Presta especial atención y recuerda con precisión cualquier mención de relaciones entre personas, como familiares y amigos.
- Si el usuario pregunta sobre relaciones complejas, utiliza el razonamiento paso a paso para deducir la relación exacta.

MUY IMPORTANTE: No dude en utilizar toda la información disponible.

La información está disponible en las preguntas y respuestas relevantes.

Piense con responsabilidad. Use un lenguaje apropiado, muestre empatía cuando sea necesario y mantenga un estilo conversacional.

--- Inicio de preguntas y respuestas relacionadas ---
{context}
--- Fin de preguntas y respuestas relacionadas ---`,

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