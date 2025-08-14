import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { getPsychologyConfig } from './psychology.config';
import { storage } from './storage';
import { langChainAgent, langChainChains } from './langchain';
import { toolExecutor } from './langchain.tools';

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
    nestedQuestionsAsked: number;
    nestedQuestionsAnswered: number;
  }>;
  sessionStartTime: Date;
  predefinedQuestions: string[];
  personalizedQuestions: string[];
  hasGreeted: boolean;
  patientName: string | null;
  isNewSession: boolean;
  currentMainQuestion: string | null;
  nestedQuestionCount: number;
  sessionNumber: number;
}

export class PsychologyAgent {
  private memoryStore: Map<string, BufferMemory> = new Map();
  private userSessions: Map<string, UserSession> = new Map();

  private async getOrCreateSession(userId: string): Promise<UserSession> {
    if (!this.userSessions.has(userId)) {
      // Load predefined questions from database
      const predefinedQuestions = await storage.getPsychologyQuestions();
      const questionTexts = predefinedQuestions.map(q => q.question);
      
      // Check if this is a new session or continuing
      const userContexts = await storage.getAllUserContext(userId);
      const patientName = userContexts.find(ctx => ctx.key === 'name')?.value || null;
      
      // Get current session number from storage
      const currentSessionNumber = await toolExecutor.executeTool('session_management', `${userId}:get_session_number:`);
      const sessionNumber = parseInt(currentSessionNumber);
      
      this.userSessions.set(userId, {
        userId,
        currentQuestionIndex: 0,
        askedQuestions: [],
        userResponses: [],
        sessionStartTime: new Date(),
        predefinedQuestions: questionTexts,
        personalizedQuestions: [],
        hasGreeted: false,
        patientName,
        isNewSession: true,
        currentMainQuestion: null,
        nestedQuestionCount: 0,
        sessionNumber: sessionNumber
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
      session.currentMainQuestion = question;
      session.nestedQuestionCount = 0;
      return question;
    }
    
    return null;
  }

  async* processMessage(userId: string, message: string, chatId?: number): AsyncGenerator<string> {
    const session = await this.getOrCreateSession(userId);
    
    // Extract user information using LangChain
    try {
      const extractedInfo = await langChainChains.extractUserInfo(message);
      for (const [key, value] of Object.entries(extractedInfo)) {
        if (value && value.trim()) {
          await storage.setUserContext(userId, key, value);
          if (key === 'name' && !session.patientName) {
            session.patientName = value;
          }
        }
      }
    } catch (error) {
      console.error('Error extracting user info:', error);
    }

    // Handle greetings and session initialization
    if (session.isNewSession) {
      yield* this.handleNewSession(userId, message);
      return;
    }

    // Store user response if it's a response to a question
    if (session.askedQuestions.length > 0 && session.askedQuestions.length > session.userResponses.length) {
      const lastQuestion = session.askedQuestions[session.askedQuestions.length - 1];
      session.userResponses.push({
        question: lastQuestion,
        response: message,
        timestamp: new Date(),
        nestedQuestionsAsked: session.nestedQuestionCount,
        nestedQuestionsAnswered: 0
      });
    }

    // Check for relationship questions first (integrate LangChain agent capabilities)
    const relationshipQuestionPattern = /(?:qué|cuál|cual)\s+(?:es|sería|seria)\s+(?:la\s+)?relaci[oó]n\s+(?:entre|de)\s+(\w+)\s+(?:y|con)\s+(\w+)/i;
    const specificRelationshipPattern = /(?:quién|quien|quiénes|quienes|donde|dónde|cuál|cual)\s+(?:es|son|está|esta)\s+(?:mi|mis|tu|tus|su|sus)\s+(\w+)/i;
    
    const directMatch = message.match(relationshipQuestionPattern);
    const specificMatch = message.match(specificRelationshipPattern);
    
    // Handle relationship questions using LangChain tools
    if (directMatch) {
      const entity1 = directMatch[1];
      const entity2 = directMatch[2];
      
      try {
        const relationshipResult = await toolExecutor.executeTool(
          "infer_relationship",
          `${userId}:${entity1}:${entity2}`
        );
        
        if (!relationshipResult.includes("No relationship found")) {
          const relationshipParts = relationshipResult.split(': ');
          if (relationshipParts.length > 1) {
            const relationship = relationshipParts[1];
            const response = `Desde una perspectiva psicológica, entiendo que ${entity2} es ${relationship} de ${entity1}. ¿Cómo te sientes acerca de esta relación? ¿Hay algo específico que te gustaría explorar sobre esta dinámica familiar?`;
            yield response;
            return;
          }
        }
      } catch (error) {
        console.error('Error inferring relationship:', error);
      }
    }
    
    if (specificMatch) {
      const relationshipType = specificMatch[1].toLowerCase();
      
      try {
        const relationships = await storage.getRelationships(userId);
        const matchingRelationships = relationships.filter(rel => {
          return (
            (rel.entity1.toLowerCase() === 'yo' || rel.entity1.toLowerCase() === 'me') &&
            rel.relationship.toLowerCase().includes(relationshipType.toLowerCase())
          );
        });
        
        if (matchingRelationships.length > 0) {
          const familyMembers = matchingRelationships.map(rel => rel.entity2).join(', ');
          const response = `Entiendo que tu ${relationshipType} es ${familyMembers}. Desde una perspectiva terapéutica, me gustaría saber más sobre esta relación. ¿Cómo describirías tu vínculo con ${familyMembers}?`;
          yield response;
          return;
        }
      } catch (error) {
        console.error('Error processing relationship query:', error);
      }
    }

    // Get context from LangChain agent for better understanding
    let contextSnippets = '';
    try {
      contextSnippets = await langChainAgent.getUserChatHistory(userId, 0);
      
      // Get similar conversations for additional context
      const similarEmbeddings = await storage.getSimilarEmbeddings(userId, message, 3);
      if (similarEmbeddings.length > 0) {
        const similarConversations = similarEmbeddings
          .map(s => `Usuario: ${s.user_input}\nAsistente: ${s.bot_output}`)
          .join('\n\n');
        contextSnippets += '\n\nConversaciones similares:\n' + similarConversations;
      }
    } catch (error) {
      console.error('Error getting context:', error);
    }

    // Create enhanced psychology prompt with context
    const enhancedContext = this.getUserContext(userId) + '\n\n' + contextSnippets;
    const systemPrompt = config.systemPrompt.replace('{context}', enhancedContext);
    
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemPrompt),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // Use LangChain memory system for better continuity
    const memory = this.getMemory(userId);
    
    const conversationChain = new ConversationChain({
      llm: psychologyLLM,
      memory,
      prompt,
    });

    // Generate response with error handling
    try {
      const responseStream = await conversationChain.stream({ input: message });
      
      for await (const chunk of responseStream) {
        yield chunk.response;
      }

      // Mark that initial greeting/response has been sent
      session.hasGreeted = true;

      // Determine next question based on nested questioning strategy
      if (session.userResponses.length > 0) {
        const nextQuestion = await this.determineNextQuestion(userId);
        if (nextQuestion) {
          yield '\n\n' + nextQuestion;
        }
      }

      // Create embedding for future reference (integrate with LangChain system)
      try {
        const fullResponse = session.userResponses.length > 0 ? 
          session.userResponses[session.userResponses.length - 1].response : '';
        if (fullResponse) {
          await storage.createEmbedding(userId, message, fullResponse);
        }
      } catch (error) {
        console.error('Error creating embedding:', error);
      }
    } catch (error) {
      console.error('Psychology streaming error:', error);
      
      // Check if it's a geographic restriction error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('unsupported_country_region_territory')) {
        yield this.getFallbackResponse(message, session);
      } else {
        yield "Lo siento, estoy teniendo dificultades técnicas en este momento. ¿Podrías intentar de nuevo en unos momentos?";
      }
    }
  }

  private async* handleNewSession(userId: string, message: string): AsyncGenerator<string> {
    const session = await this.getOrCreateSession(userId);
    
    // Increment session number for returning users
    if (session.sessionNumber > 1) {
      await toolExecutor.executeTool('session_management', `${userId}:increment_session:`);
    }
    
    // Check if user has a name stored
    if (session.patientName) {
      // Greet by name and provide session summary
      const greeting = await this.generateSessionGreeting(userId);
      yield greeting;
    } else {
      // Ask for name if not known
      const nameRequest = "¡Hola! Soy tu psicólogo virtual. Antes de comenzar, ¿podrías decirme tu nombre?";
      yield nameRequest;
      
      // Extract name from response
      const nameMatch = message.match(/(?:me llamo|soy|mi nombre es)\s+(\w+)/i);
      if (nameMatch) {
        const name = nameMatch[1];
        await storage.setUserContext(userId, 'name', name);
        session.patientName = name;
        
        // Now provide proper greeting
        const greeting = await this.generateSessionGreeting(userId);
        yield '\n\n' + greeting;
      }
    }
    
    session.isNewSession = false;
  }

  private async generateSessionGreeting(userId: string): Promise<string> {
    const session = await this.getOrCreateSession(userId);
    
    // Get current session number
    const currentSessionNumber = await toolExecutor.executeTool('session_management', `${userId}:get_session_number:`);
    const sessionNumber = parseInt(currentSessionNumber);
    
    // Get previous session summary
    const previousSessions = await this.getPreviousSessionSummary(userId);
    
    let greeting = `¡Hola ${session.patientName || 'amigo/a'}! Me alegra verte de nuevo. `;
    
    if (previousSessions && sessionNumber > 1) {
      greeting += `En nuestra sesión anterior hablamos sobre ${previousSessions}. ¿Te gustaría agregar algo relevante sobre esa conversación o hay algo nuevo que te gustaría explorar hoy?`;
    } else {
      greeting += `¿Cómo te sientes hoy? ¿Hay algo específico en lo que te gustaría que trabajemos juntos?`;
    }
    
    return greeting;
  }

  private async getPreviousSessionSummary(userId: string): Promise<string | null> {
    try {
      // Get recent chat history
      const userChats = await storage.getUserChats(userId);
      if (userChats.length < 2) return null;
      
      // Get the most recent chat
      const recentChat = await storage.getChatWithMessages(userChats[0].id);
      if (!recentChat || recentChat.messages.length === 0) return null;
      
      // Generate summary of the last session
      const lastSessionMessages = recentChat.messages
        .slice(-10) // Last 10 messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      const summaryPrompt = `Genera un resumen breve (2-3 frases) de la siguiente conversación terapéutica, enfocándote en los temas principales discutidos:

${lastSessionMessages}

Resumen:`;
      
      const response = await psychologyLLM.invoke(summaryPrompt);
      return response.content as string;
    } catch (error) {
      console.error('Error generating session summary:', error);
      return null;
    }
  }

  private getFallbackResponse(message: string, session: UserSession): string {
    // Simple fallback responses when OpenAI is not available
    const lowerMessage = message.toLowerCase();
    
    // Check for common patterns and provide appropriate responses
    if (lowerMessage.includes('hola') || lowerMessage.includes('buenos días') || lowerMessage.includes('buenas')) {
      return "¡Hola! Me alegra verte. ¿Cómo te sientes hoy?";
    }
    
    if (lowerMessage.includes('estrés') || lowerMessage.includes('ansiedad') || lowerMessage.includes('preocupado')) {
      return "Entiendo que te sientes estresado/a. Es una sensación muy común. ¿Puedes contarme más sobre qué está causando este estrés en tu vida?";
    }
    
    if (lowerMessage.includes('triste') || lowerMessage.includes('deprimido') || lowerMessage.includes('mal')) {
      return "Es completamente normal sentirse así a veces. ¿Desde cuándo te has estado sintiendo de esta manera?";
    }
    
    if (lowerMessage.includes('familia') || lowerMessage.includes('pareja') || lowerMessage.includes('amigos')) {
      return "Las relaciones son fundamentales en nuestras vidas. ¿Cómo te sientes con respecto a tus relaciones en este momento?";
    }
    
    if (lowerMessage.includes('trabajo') || lowerMessage.includes('estudio') || lowerMessage.includes('responsabilidades')) {
      return "El trabajo y las responsabilidades pueden ser muy demandantes. ¿Cómo te está afectando esto en tu día a día?";
    }
    
    // Default empathetic response
    return "Gracias por compartir eso conmigo. Es importante poder expresar lo que sentimos. ¿Te gustaría contarme más sobre cómo te sientes?";
  }

  private async determineNextQuestion(userId: string): Promise<string | null> {
    const session = await this.getOrCreateSession(userId);
    
    // Check if we need to ask nested questions for the current main question
    if (session.currentMainQuestion && session.nestedQuestionCount < 2) {
      const nestedQuestion = await this.generateNestedQuestion(userId, session.currentMainQuestion, session.userResponses[session.userResponses.length - 1]);
      if (nestedQuestion) {
        session.nestedQuestionCount++;
        session.askedQuestions.push(nestedQuestion);
        return nestedQuestion;
      }
    }
    
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
      session.currentMainQuestion = question.question;
      session.nestedQuestionCount = 0;
      return question.question;
    }
    
    // Generate personalized question if we have enough responses
    if (session.userResponses.length >= 3) {
      return await this.generatePersonalizedQuestion(userId);
    }
    
    return null;
  }

  private async generateNestedQuestion(userId: string, mainQuestion: string, lastResponse: any): Promise<string | null> {
    try {
      const nestedQuestionPrompt = `Basándote en la pregunta principal y la respuesta del usuario, genera una pregunta de seguimiento específica que profundice en el tema.

Pregunta principal: "${mainQuestion}"
Respuesta del usuario: "${lastResponse.response}"

Genera una pregunta de seguimiento que:
1. Se relacione directamente con lo que el usuario compartió
2. Invite a reflexionar más profundamente
3. Explore emociones, pensamientos o experiencias específicas
4. Sea natural y fluida en la conversación

Pregunta de seguimiento:`;

      const response = await psychologyLLM.invoke(nestedQuestionPrompt);
      return response.content as string;
    } catch (error) {
      console.error('Error generating nested question:', error);
      return null;
    }
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
    session.currentMainQuestion = personalizedQuestion;
    session.nestedQuestionCount = 0;
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

  // Integrated LangChain capabilities
  async getAvailableTools(): Promise<string[]> {
    return toolExecutor.getAvailableTools();
  }

  async getToolDescriptions(): Promise<Record<string, string>> {
    return toolExecutor.getToolDescriptions();
  }

  async executeTool(toolName: string, input: string): Promise<string> {
    return await toolExecutor.executeTool(toolName, input);
  }

  async generateChatTitle(messages: string[]): Promise<string> {
    return await langChainChains.generateChatTitle(messages);
  }

  async extractUserInfo(message: string): Promise<Record<string, string>> {
    return await langChainChains.extractUserInfo(message);
  }

  // Clear both psychology and LangChain memory
  clearAllMemory(userId: string): void {
    this.resetSession(userId);
    // Also clear LangChain memory if available
    try {
      langChainAgent.clearMemory(userId);
    } catch (error) {
      console.error('Error clearing LangChain memory:', error);
    }
  }
}
