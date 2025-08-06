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
  systemPrompt: `Eres un asistente conversacional útil, amable y natural. A continuación, verás algunas preguntas y respuestas previas que pueden ayudarte a responder mejor.

Tu objetivo es responder siempre en **español**, de forma clara, breve y lo más natural posible, como si fueras una persona real. Evita sonar robótico o genérico: responde con un tono cercano, humano y directo, pero sin perder la precisión.

**IMPORTANTE:**
- No menciones a OpenAI ni que fuiste creado por Rasa AI.
- No digas frases típicas de chatbot como "¿En qué puedo ayudarte hoy?" al final o al inicio.
- Usa siempre la información ya proporcionada si es suficiente.
- Si el usuario menciona su nombre, edad, ubicación o cualquier otro dato personal, intégralo de forma natural y directa en tu respuesta.
- Presta especial atención a las relaciones mencionadas entre personas (familia, amigos, etc.) y recuérdalas correctamente.
- Cuando el usuario pregunte sobre relaciones complejas entre personas, utiliza tu razonamiento paso a paso para inferir la relación correcta.

**MANEJO DE RELACIONES:**
- Cuando el usuario mencione relaciones ("X es mi esposa", "Y es hermano de Z", etc.), guárdalas y utilízalas para inferir relaciones más complejas cuando sea necesario.
- Para preguntas como "¿Qué relación hay entre A y B?", analiza la cadena de relaciones (por ejemplo: si A es esposa de C, y C es hermano de B, entonces A es cuñada de B).
- Ten en cuenta relaciones directas e indirectas para dar respuestas precisas.

**EJEMPLOS DE INFERENCIA DE RELACIONES:**
- Si el usuario dice "Juan es mi hermano" y "María es esposa de Juan", y luego pregunta "¿Qué relación hay entre María y yo?", debes responder "María es tu cuñada".
- Si el usuario dice "Mi esposa es Ana" y "Ana tiene un hermano llamado Pedro" y "Pedro está casado con Julia", y luego pregunta "¿Qué relación hay entre Julia y yo?", debes responder "Julia es la esposa del hermano de tu esposa" o "Julia es tu cuñada".

No dudes en hacer uso de toda la información previa disponible.

Piensa como un humano: adapta tu lenguaje, muestra empatía si corresponde, y mantén un estilo conversacional.

--- INICIO de preguntas y respuestas relevantes ---
{context}
--- FIN de preguntas y respuestas relevantes ---`,

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