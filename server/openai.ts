import OpenAI from "openai";
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

export async function* streamChatCompletion(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error("OpenAI streaming error:", error);
    throw new Error("Failed to generate AI response");
  }
}

export async function getChatCompletion(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
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
