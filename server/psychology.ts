import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { getPsychologyConfig } from './psychology.config';
import { storage } from './storage';

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
  predefinedQuestions: string[];
  personalizedQuestions: string[];
}

export class PsychologyAgent {
  private memoryStore: Map<string, BufferMemory> = new Map();
  private userSessions: Map<string, UserSession> = new Map();

  private async getOrCreateSession(userId: string): Promise<UserSession> {
    if (!this.userSessions.has(userId)) {
      // Load predefined questions from database
      const predefinedQuestions = await storage.getPsychologyQuestions();
      const questionTexts = predefinedQuestions.map(q => q.question);
      
      this.userSessions.set(userId, {
        userId,
        currentQuestionIndex: 0,
        askedQuestions: [],
        userResponses: [],
        sessionStartTime: new Date(),
        predefinedQuestions: questionTexts,
        personalizedQuestions: []
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

  private async getNextPredefinedQuestion(userId: string): Promise<string | null> {
    const session = await this.getOrCreateSession(userId);
    
    if (session.currentQuestionIndex < session.predefinedQuestions.length) {
      const question = session.predefinedQuestions[session.currentQuestionIndex];
      session.currentQuestionIndex++;
      session.askedQuestions.push(question);
      return question;
    }
    
    return null;
  }

  async* processMessage(userId: string, message: string): AsyncGenerator<string> {
    const session = await this.getOrCreateSession(userId);
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
    const nextQuestion = await this.determineNextQuestion(userId);
    
    if (nextQuestion) {
      yield '\n\n' + nextQuestion;
    }
  }

  private async determineNextQuestion(userId: string): Promise<string | null> {
    const session = await this.getOrCreateSession(userId);
    
    // Continue with predefined questions
    if (session.currentQuestionIndex < session.predefinedQuestions.length) {
      return await this.getNextPredefinedQuestion(userId);
    }
    
    // Check for unused personalized questions
    const unusedPersonalizedQuestions = await storage.getUnusedUserGeneratedQuestions(userId, 5);
    if (unusedPersonalizedQuestions.length > 0) {
      const question = unusedPersonalizedQuestions[0];
      await storage.markUserGeneratedQuestionAsUsed(question.id);
      session.askedQuestions.push(question.question);
      return question.question;
    }
    
    // Generate personalized question if we have enough responses
    if (session.userResponses.length >= 3) {
      return await this.generatePersonalizedQuestion(userId);
    }
    
    return null;
  }

  private async generatePersonalizedQuestion(userId: string): Promise<string> {
    const session = await this.getOrCreateSession(userId);
    
    const recentResponses = session.userResponses
      .slice(-3)
      .map(r => r.response)
      .join(' ');

    // Generate personalized question based on recent responses
    let personalizedQuestion = "¿Qué aspecto de tu vida te gustaría explorar más profundamente?";
    
    if (recentResponses.toLowerCase().includes('ansiedad') || recentResponses.toLowerCase().includes('estrés')) {
      personalizedQuestion = "¿Podrías contarme más sobre cómo manejas la ansiedad en tu día a día?";
    } else if (recentResponses.toLowerCase().includes('familia') || recentResponses.toLowerCase().includes('relación')) {
      personalizedQuestion = "¿Cómo te sientes con respecto a tus relaciones familiares en este momento?";
    } else if (recentResponses.toLowerCase().includes('trabajo') || recentResponses.toLowerCase().includes('profesional')) {
      personalizedQuestion = "¿Cómo afecta tu situación laboral a tu bienestar emocional?";
    }

    // Store the generated question in the database
    await storage.addUserGeneratedQuestion({
      userId,
      question: personalizedQuestion,
      category: 'personalized',
      isUsed: false
    });

    session.askedQuestions.push(personalizedQuestion);
    return personalizedQuestion;
  }

  private getUserContext(userId: string): string {
    const session = this.userSessions.get(userId);
    
    if (!session || session.userResponses.length === 0) {
      return "Esta es la primera sesión con el usuario.";
    }

    const recentResponses = session.userResponses
      .slice(-3)
      .map(r => `Pregunta: ${r.question}\nRespuesta: ${r.response}`)
      .join('\n\n');

    return `Información reciente del usuario:\n${recentResponses}`;
  }

  async getSessionStats(userId: string): Promise<{
    totalQuestions: number;
    totalResponses: number;
    sessionDuration: number;
  }> {
    const session = await this.getOrCreateSession(userId);
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

  async getAllPredefinedQuestions(): Promise<string[]> {
    const questions = await storage.getPsychologyQuestions();
    return questions.map(q => q.question);
  }

  async getQuestionsByCategory(category: string): Promise<string[]> {
    const questions = await storage.getPsychologyQuestionsByCategory(category);
    return questions.map(q => q.question);
  }
}
