import OpenAI from "openai";
import { storage } from './storage'; 
import { Readable } from "stream";
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  userId: string,
  topK = 7
): AsyncGenerator<string, void, unknown> {
  try {
    /* -------------------------------------------------
     * 1.  Build the user query from the last message
     * -------------------------------------------------*/
    const userQuery = messages.filter(m => m.role === 'user').pop()?.content ?? '';
    if (!userQuery.trim()) throw new Error('No user message found');

    /* -------------------------------------------------
     * 2.  Retrieve semantically similar examples
     * -------------------------------------------------*/
    const similar = await storage.getSimilarEmbeddings(userId, userQuery, topK);

    const contextSnippets = similar
      .map(
        s =>
          `User: ${s.user_input}\nAssistant: ${s.bot_output}`
      )
      .join('\n\n');

    console.log(contextSnippets);

    /* -------------------------------------------------
     * 3.  Get user context information
     * -------------------------------------------------*/
    // const userContexts = await storage.getAllUserContext(userId);
    // const userContextInfo = userContexts.length > 0 
    //   ? `\n--- USER CONTEXT ---\n${userContexts.map(ctx => `${ctx.key}: ${ctx.value}`).join('\n')}\n--- END USER CONTEXT ---\n`
    //   : '';
    
    // console.log(`🔍 Retrieved user context for ${userId}:`, userContexts.length > 0 ? userContexts.map(ctx => `${ctx.key}: ${ctx.value}`).join(', ') : 'No context found');
    // console.log(`📝 User context info length: ${userContextInfo.length} characters`);
    // console.log(`📝 User context info: ${userContextInfo}`);

    /* -------------------------------------------------
     * 4.  Prepend system prompt with context
     * -------------------------------------------------*/
    const systemPrompt: ChatMessage = {
      role: 'system',
      content:
        'Eres un asistente útil. A continuación, hay algunas preguntas y respuestas previas que podrían ser relevantes. ' +
        'Encuentra la información necesaria en las Q&A y utilízala para responder de manera precisa. ¡IMPORTANTE! Debes responder siempre en español con respuestas cortas, ' +
        'y nunca mencionar OpenAI, ni que fuiste creado por Rasa AI. Además, no debes preguntar "¿En qué puedo ayudarte hoy?" al final de la conversación.\n\n' +
        'Si la información ya ha sido proporcionada, úsala directamente para una respuesta precisa. Si el usuario menciona datos como su nombre, edad, ubicación o cualquier otra ' +
        'información relevante, responde directamente con esos detalles de forma clara y concisa. No dudes en hacer uso de toda la información previa disponible.\n\n' +
        '--- INICIO de preguntas y respuestas relevantes ---\n' +
        contextSnippets +
        '\n--- FIN de preguntas y respuestas relevantes ---'
    };

    const messagesWithContext = [systemPrompt, ...messages];

    /* -------------------------------------------------
     * 5.  Stream the completion
     * -------------------------------------------------*/
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messagesWithContext,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  } catch (error) {
    console.error('OpenAI streaming error:', error);
    throw new Error('Failed to generate AI response');
  }
}

export async function getChatCompletion(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Response shortly, but smartly, must in spanish"
        },
        ...messages
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("OpenAI completion error:", error);
    throw new Error("Failed to generate AI response");
  }
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    // Create a readable stream from the buffer
    const audioStream = new Readable({
      read() {
        this.push(audioBuffer);
        this.push(null);
      }
    });

    // Add required properties for OpenAI API
    (audioStream as any).path = "audio.webm";

    const transcription = await openai.audio.transcriptions.create({
      file: audioStream as any,
      model: "gpt-4o-mini-transcribe", // Note: gpt-4o-mini-transcribe is not available, using whisper-1 which is the standard transcription model
      language: "es",
      response_format: "text",
    });

    return transcription;
  } catch (error) {
    console.error("OpenAI transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function generateChatTitle(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Generate a short, descriptive title (max 6 words) for this conversation based on the first user message. Return only the title, no quotes or extra text."
        },
        ...messages.slice(0, 2), // Only use first user message and first AI response
      ],
      max_tokens: 20,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || "New Chat";
  } catch (error) {
    console.error("OpenAI title generation error:", error);
    return "New Chat";
  }
}

export async function extractAndStoreUserInfo(message: string, userId: string): Promise<void> {
  try {
    console.log(`🔍 Analyzing message for personal info: "${message}"`);
    
    // First, try specific patterns for common information
    const specificPatterns = {
      // Name patterns
      name: [
        /(?:my name is|i'm|i am|call me|i'm called)\s+([A-Za-z\s]+)/i,
        /(?:me llamo|mi nombre es|soy|me llaman)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s]+)/i
      ],
      // Age patterns
      age: [
        /(?:i'm|i am|my age is)\s+(\d+)\s*(?:years? old|years?|y\.?o\.?)/i,
        /(?:tengo|mi edad es|soy de)\s+(\d+)\s+(?:años|año)/i,
        /(?:i am|i'm)\s+(\d+)/i
      ],
      // Location patterns
      location: [
        /(?:i live in|i'm from|i'm in|i live at)\s+([A-Za-z\s,]+)/i,
        /(?:vivo en|soy de|estoy en)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s,]+)/i
      ],
      // Job/Profession patterns
      job: [
        /(?:i'm a|i am a|i work as|my job is|i work in)\s+([A-Za-z\s]+)/i,
        /(?:soy|trabajo como|mi profesión es|me dedico a)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s]+)/i,
        /(?:job|work|profession|occupation):\s*([A-Za-z\s]+)/i
      ]
    };

    let extractedInfo = [];

    // Try specific patterns first
    for (const [key, patterns] of Object.entries(specificPatterns)) {
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
          const value = match[1].trim();
          await storage.setUserContext(userId, key, value);
          extractedInfo.push(`${key}: ${value}`);
          console.log(`✅ Extracted ${key}: ${value} for user ${userId}`);
          break; // Use first match for each key
        }
      }
    }

    // Now extract any other personal information using a more flexible approach
    // Look for key-value pairs like "age: 25", "hobby: football", etc.
    const keyValuePattern = /(\w+):\s*([^,\n]+)/gi;
    let keyValueMatch;
    
    while ((keyValueMatch = keyValuePattern.exec(message)) !== null) {
      const key = keyValueMatch[1].toLowerCase().trim();
      const value = keyValueMatch[2].trim();
      
      // Skip if we already extracted this key with specific patterns
      if (!extractedInfo.some(info => info.startsWith(`${key}:`))) {
        await storage.setUserContext(userId, key, value);
        extractedInfo.push(`${key}: ${value}`);
        console.log(`✅ Extracted key-value: ${key}: ${value} for user ${userId}`);
      }
    }

    // Also look for natural language statements about personal information
    const naturalLanguagePatterns = [
      // "I am X years old" -> age
      { pattern: /(?:i am|i'm)\s+(\d+)\s*(?:years? old|years?)/i, key: 'age' },
      // "I have X children" -> family
      { pattern: /(?:i have|i've got)\s+(\d+)\s*(?:children|kids|sons|daughters)/i, key: 'family' },
      // "I like X" -> hobby
      { pattern: /(?:i like|i love|i enjoy)\s+([A-Za-z\s]+)/i, key: 'hobby' },
      // "I am X" (personality traits)
      { pattern: /(?:i am|i'm)\s+(?:a\s+)?([A-Za-z\s]+)(?:\s+person|$)/i, key: 'personality' }
    ];

    for (const { pattern, key } of naturalLanguagePatterns) {
      const match = message.match(pattern);
      if (match) {
        const value = match[1].trim();
        // Only store if we don't already have this key
        if (!extractedInfo.some(info => info.startsWith(`${key}:`))) {
          await storage.setUserContext(userId, key, value);
          extractedInfo.push(`${key}: ${value}`);
          console.log(`✅ Extracted natural language ${key}: ${value} for user ${userId}`);
        }
      }
    }

    if (extractedInfo.length > 0) {
      console.log(`📝 Stored user context for ${userId}: ${extractedInfo.join(', ')}`);
    } else {
      console.log(`📝 No personal information extracted from message`);
    }
  } catch (error) {
    console.error('❌ Error extracting user info:', error);
  }
}
