import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
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
  userResponses: Array<{ question: string; response: string; timestamp: Date }>;
  sessionStartTime: Date;
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
        sessionStartTime: new Date()
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
      return question;
    }
    
    return null;
  }

  async* processMessage(userId: string, message: string): AsyncGenerator<string> {
    const session = this.getOrCreateSession(userId);
    const memory = this.getMemory(userId);
    
    // Store user response if it's a response to a question
    if (session.askedQuestions.length > 0 && session.askedQuestions.length > session.userResponses.length) {
      const lastQuestion = session.askedQuestions[session.askedQuestions.length - 1];
      session.userResponses.push({
        question: lastQuestion,
        response: message,
        timestamp: new Date()
      });
    }

    // Create conversation chain
    const systemPrompt = config.systemPrompt.replace('{context}', this.getUserContext(userId));
    
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
    
    for await (const chunk of responseStream) {
      yield chunk.response;
    }

    // Determine next question
    const nextQuestion = this.determineNextQuestion(userId);
    
    if (nextQuestion) {
      yield '\n\n' + nextQuestion;
    }
  }

  private determineNextQuestion(userId: string): string | null {
    const session = this.getOrCreateSession(userId);
    
    // Continue with predefined questions
    if (session.currentQuestionIndex < config.predefinedQuestions.length) {
      return this.getNextPredefinedQuestion(userId);
    }
    
    // Generate personalized question if we have enough responses
    if (session.userResponses.length >= 3) {
      return this.generatePersonalizedQuestion(userId);
    }
    
    return null;
  }

  private generatePersonalizedQuestion(userId: string): string {
    const session = this.getOrCreateSession(userId);
    
    const recentResponses = session.userResponses
      .slice(-3)
      .map(r => r.response)
      .join(' ');

    // Simple personalized question based on recent responses
    if (recentResponses.toLowerCase().includes('ansiedad') || recentResponses.toLowerCase().includes('estrés')) {
      return "¿Podrías contarme más sobre cómo manejas la ansiedad en tu día a día?";
    } else if (recentResponses.toLowerCase().includes('familia') || recentResponses.toLowerCase().includes('relación')) {
      return "¿Cómo te sientes con respecto a tus relaciones familiares en este momento?";
    } else if (recentResponses.toLowerCase().includes('trabajo') || recentResponses.toLowerCase().includes('profesional')) {
      return "¿Cómo afecta tu situación laboral a tu bienestar emocional?";
    } else {
      return "¿Qué aspecto de tu vida te gustaría explorar más profundamente?";
    }
  }

  private getUserContext(userId: string): string {
    const session = this.getOrCreateSession(userId);
    
    if (session.userResponses.length === 0) {
      return "Esta es la primera sesión con el usuario.";
    }

    const recentResponses = session.userResponses
      .slice(-3)
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
