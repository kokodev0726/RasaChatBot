import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain, LLMChain } from "langchain/chains";
import { PromptTemplate, ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { storage } from './storage';
import { getPsychologyConfig } from './psychology.config';

const config = getPsychologyConfig();

const psychologyLLM = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: config.modelName,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  streaming: true,
});

interface UserSession {
  userId: string;
  currentQuestionIndex: number;
  askedQuestions: string[];
  userResponses: Array<{
    question: string;
    response: string;
    timestamp: Date;
    emotions?: string[];
  }>;
  personalizedQuestions: string[];
  sessionStartTime: Date;
  lastActivity: Date;
}

export class PsychologyAgent {
  private memoryStore: Map<string, BufferMemory> = new Map();
  private userSessions: Map<string, UserSession> = new Map();

  private getOrCreateSession(userId: string): UserSession {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        userId,
        currentQuestionIndex: 0,
        askedQuestions: [],
        userResponses: [],
        personalizedQuestions: [],
        sessionStartTime: new Date(),
        lastActivity: new Date()
      });
    }
    return this.userSessions.get(userId)!;
  }

  private getMemory(userId: string): BufferMemory {
    if (!this.memoryStore.has(userId)) {
      this.memoryStore.set(userId, new BufferMemory({
        returnMessages: true,
        memoryKey: "history",
        inputKey: "input",
      }));
    }
    return this.memoryStore.get(userId)!;
  }

  private getNextPredefinedQuestion(userId: string): string | null {
    const session = this.getOrCreateSession(userId);
    
    if (session.currentQuestionIndex < config.predefinedQuestions.length) {
      const question = config.predefinedQuestions[session.currentQuestionIndex];
      session.currentQuestionIndex++;
      session.askedQuestions.push(question);
      session.lastActivity = new Date();
      return question;
    }
    
    return null;
  }

  async* processMessage(userId: string, message: string): AsyncGenerator<string> {
    const session = this.getOrCreateSession(userId);
    const memory = this.getMemory(userId);
    
    session.lastActivity = new Date();

    // Store user response if it's a response to a question
    if (session.askedQuestions.length > 0 && session.askedQuestions.length > session.userResponses.length) {
      const lastQuestion = session.askedQuestions[session.askedQuestions.length - 1];
      session.userResponses.push({
        question: lastQuestion,
        response: message,
        timestamp: new Date(),
        emotions: []
      });
    }

    // Create conversation chain
    const systemPrompt = config.systemPrompt.replace('{context}', await this.getUserContext(userId));
    
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemPrompt),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    const conversationChain = new ConversationChain({
      llm: psychologyLLM,
      memory,
      prompt,
    });

    // Generate response
    const responseStream = await conversationChain.stream({ input: message });
    
    let fullResponse = '';
    for await (const chunk of responseStream) {
      fullResponse += chunk.response;
      yield chunk.response;
    }

    // Determine next question
    const nextQuestion = await this.determineNextQuestion(userId);
    
    if (nextQuestion) {
      yield '\n\n' + nextQuestion;
    }
  }

  private async determineNextQuestion(userId: string): Promise<string | null> {
    const session = this.getOrCreateSession(userId);
    
    // Continue with predefined questions
    if (session.currentQuestionIndex < config.predefinedQuestions.length) {
      return this.getNextPredefinedQuestion(userId);
    }
    
    // Generate personalized questions if we have enough responses
    if (session.userResponses.length >= 3 && session.personalizedQuestions.length === 0) {
      session.personalizedQuestions = await this.generatePersonalizedQuestions(userId);
    }
    
    // Ask personalized questions
    if (session.personalizedQuestions.length > 0) {
      const question = session.personalizedQuestions.shift()!;
      session.askedQuestions.push(question);
      return question;
    }
    
    // Generate follow-up question
    return await this.generateFollowUpQuestion(userId);
  }

  private async generatePersonalizedQuestions(userId: string): Promise<string[]> {
    const session = this.getOrCreateSession(userId);
    
    const recentResponses = session.userResponses
      .slice(-5)
      .map(r => `${r.question}: ${r.response}`)
      .join('\n');

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(config.personalizedQuestionPrompt),
      HumanMessagePromptTemplate.fromTemplate(`Respuestas recientes:\n${recentResponses}`)
    ]);

    const chain = new LLMChain({
      llm: psychologyLLM,
      prompt
    });

    try {
      const result = await chain.invoke({});
      const response = result.text as string;
      
      const questions = response
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 0);

      return questions.slice(0, 3);
    } catch (error) {
      console.error('Error generating personalized questions:', error);
      return [];
    }
  }

  private async generateFollowUpQuestion(userId: string): Promise<string | null> {
    const session = this.getOrCreateSession(userId);
    
    if (session.userResponses.length === 0) return null;

    const recentResponses = session.userResponses
      .slice(-3)
      .map(r => r.response)
      .join('\n');

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`Basándote en las respuestas recientes del usuario, genera una pregunta de seguimiento que invite a una reflexión más profunda.

Respuestas recientes:
{responses}

Genera una pregunta de seguimiento:`),
      HumanMessagePromptTemplate.fromTemplate(`{responses}`)
    ]);

    const chain = new LLMChain({
      llm: psychologyLLM,
      prompt
    });

    try {
      const result = await chain.invoke({ responses: recentResponses });
      return result.text as string;
    } catch (error) {
      console.error('Error generating follow-up question:', error);
      return null;
    }
  }

  private async getUserContext(userId: string): Promise<string> {
    const session = this.getOrCreateSession(userId);
    
    if (session.userResponses.length === 0) {
      return "Esta es la primera sesión con el usuario.";
    }

    const recentResponses = session.userResponses
      .slice(-5)
      .map(r => `Pregunta: ${r.question}\nRespuesta: ${r.response}`)
      .join('\n\n');

    return `Información reciente del usuario:\n${recentResponses}`;
  }

  getSessionStats(userId: string): {
    totalQuestions: number;
    totalResponses: number;
    sessionDuration: number;
  } {
    const session = this.getOrCreateSession(userId);
    const now = new Date();
    const sessionDuration = (now.getTime() - session.sessionStartTime.getTime()) / (1000 * 60);
    
    return {
      totalQuestions: session.askedQuestions.length,
      totalResponses: session.userResponses.length,
      sessionDuration
    };
  }

  resetSession(userId: string): void {
    this.userSessions.delete(userId);
    this.memoryStore.delete(userId);
  }

  getAllPredefinedQuestions(): string[] {
    return config.predefinedQuestions;
  }

  getQuestionsByCategory(category: string): string[] {
    return config.questionCategories[category] || [];
  }
}
