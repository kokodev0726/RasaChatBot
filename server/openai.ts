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
  topK = 3
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
    const similar = await storage.getSimilarEmbeddings(userQuery, topK);

    const contextSnippets = similar
      .map(
        s =>
          `User: ${s.user_input}\nAssistant: ${s.bot_output}`
      )
      .join('\n\n');

    /* -------------------------------------------------
     * 3.  Get user context information
     * -------------------------------------------------*/
    const userContexts = await storage.getAllUserContext(userId);
    const userContextInfo = userContexts.length > 0 
      ? `\n--- USER CONTEXT ---\n${userContexts.map(ctx => `${ctx.key}: ${ctx.value}`).join('\n')}\n--- END USER CONTEXT ---\n`
      : '';

    /* -------------------------------------------------
     * 4.  Prepend system prompt with context
     * -------------------------------------------------*/
    const systemPrompt: ChatMessage = {
      role: 'system',
      content:
        'You are a helpful assistant. Below are some past Q&A pairs that might be relevant. ' +
        'If they help, use them. If not, ignore them. !IMPORTANT: Must be in spanish and short answers, and don\'t mention OpenAI, You are made by Rasa AI\n\n' +
        '--- BEGIN EXAMPLES ---\n' +
        contextSnippets +
        '\n--- END EXAMPLES ---' +
        userContextInfo +
        '\n\nIMPORTANTE: Si tienes información del usuario (nombre, edad, ubicación, profesión), úsala en tus respuestas. ' +
        'Si el usuario pregunta sobre su información personal y la tienes, responde con ella. ' +
        'Si no tienes la información que pregunta, pídele que te la proporcione.',
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
    // Spanish extraction patterns
    const spanishNamePattern = /(?:me llamo|mi nombre es|soy|me llaman)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s]+)/i;
    const spanishAgePattern = /(?:tengo|mi edad es|soy de)\s+(\d+)\s+(?:años|año)/i;
    const spanishLocationPattern = /(?:vivo en|soy de|estoy en)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s,]+)/i;
    const spanishProfessionPattern = /(?:soy|trabajo como|mi profesión es|me dedico a)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s]+)/i;

    // English extraction patterns
    const englishNamePattern = /(?:my name is|i'm|i am|call me|i'm called)\s+([A-Za-z\s]+)/i;
    const englishAgePattern = /(?:i'm|i am|my age is)\s+(\d+)\s+(?:years? old|years?)/i;
    const englishLocationPattern = /(?:i live in|i'm from|i'm in|i live at)\s+([A-Za-z\s,]+)/i;
    const englishProfessionPattern = /(?:i'm a|i am a|i work as|my job is|i work in)\s+([A-Za-z\s]+)/i;

    // Check Spanish patterns
    const spanishNameMatch = message.match(spanishNamePattern);
    const spanishAgeMatch = message.match(spanishAgePattern);
    const spanishLocationMatch = message.match(spanishLocationPattern);
    const spanishProfessionMatch = message.match(spanishProfessionPattern);

    // Check English patterns
    const englishNameMatch = message.match(englishNamePattern);
    const englishAgeMatch = message.match(englishAgePattern);
    const englishLocationMatch = message.match(englishLocationPattern);
    const englishProfessionMatch = message.match(englishProfessionPattern);

    // Store name (prioritize Spanish, then English)
    if (spanishNameMatch) {
      await storage.setUserContext(userId, 'name', spanishNameMatch[1].trim());
    } else if (englishNameMatch) {
      await storage.setUserContext(userId, 'name', englishNameMatch[1].trim());
    }

    // Store age
    if (spanishAgeMatch) {
      await storage.setUserContext(userId, 'age', spanishAgeMatch[1].trim());
    } else if (englishAgeMatch) {
      await storage.setUserContext(userId, 'age', englishAgeMatch[1].trim());
    }

    // Store location
    if (spanishLocationMatch) {
      await storage.setUserContext(userId, 'location', spanishLocationMatch[1].trim());
    } else if (englishLocationMatch) {
      await storage.setUserContext(userId, 'location', englishLocationMatch[1].trim());
    }

    // Store profession
    if (spanishProfessionMatch) {
      await storage.setUserContext(userId, 'profession', spanishProfessionMatch[1].trim());
    } else if (englishProfessionMatch) {
      await storage.setUserContext(userId, 'profession', englishProfessionMatch[1].trim());
    }
  } catch (error) {
    console.error('Error extracting user info:', error);
  }
}
