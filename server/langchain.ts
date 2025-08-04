import { ChatOpenAI } from "@langchain/openai";
import { 
  ConversationChain, 
  LLMChain,
  SequentialChain,
  SimpleSequentialChain
} from "langchain/chains";
import { 
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { 
  BufferMemory,
  ConversationSummaryMemory,
  VectorStoreRetrieverMemory
} from "langchain/memory";
import { 
  OpenAIEmbeddings 
} from "@langchain/openai";
import { 
  MemoryVectorStore 
} from "langchain/vectorstores/memory";
import { 
  RunnableSequence,
  RunnablePassthrough
} from "@langchain/core/runnables";
import { 
  StringOutputParser 
} from "@langchain/core/output_parsers";
import { storage } from './storage';
import { getLangChainConfig } from './langchain.config';
import dotenv from 'dotenv';

dotenv.config();

const config = getLangChainConfig();

// Initialize LangChain components
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: config.modelName,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  streaming: true,
});

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Memory management
export class LangChainMemory {
  private memoryStore: Map<string, BufferMemory> = new Map();

  getMemory(userId: string): BufferMemory {
    if (!this.memoryStore.has(userId)) {
      this.memoryStore.set(userId, new BufferMemory({
        returnMessages: config.returnMessages,
        memoryKey: config.memoryKey,
        inputKey: "input",
      }));
    }
    return this.memoryStore.get(userId)!;
  }

  async clearMemory(userId: string): Promise<void> {
    this.memoryStore.delete(userId);
  }
}

// Conversation chain with memory
export class LangChainConversation {
  private memoryManager: LangChainMemory;

  constructor() {
    this.memoryManager = new LangChainMemory();
  }

  async createConversationChain(userId: string): Promise<ConversationChain> {
    const memory = this.memoryManager.getMemory(userId);
    
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(config.systemPrompt),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    return new ConversationChain({
      llm,
      memory,
      prompt,
    });
  }

  async createConversationChainWithContext(userId: string, contextSnippets: string): Promise<ConversationChain> {
    const memory = this.memoryManager.getMemory(userId);
    
    // Replace the context placeholder with actual context
    const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
    
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    return new ConversationChain({
      llm,
      memory,
      prompt,
    });
  }

  async* streamConversation(userId: string, message: string): AsyncGenerator<string> {
    try {
      // Get similar conversations for context
      const similarEmbeddings = await storage.getSimilarEmbeddings(userId, message, 3);
      const contextSnippets = similarEmbeddings
        .map(s => `Usuario: ${s.user_input}\nAsistente: ${s.bot_output}`)
        .join('\n\n');

      // Use the same prompt as OpenAI with context
      const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
      
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());

      // Stream the response
      const stream = await chain.stream({
        input: message,
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      console.error('LangChain conversation error:', error);
      throw new Error('Failed to generate conversation response');
    }
  }
}

// Advanced chains for specific tasks
export class LangChainChains {
  // Chain for generating chat titles
  async generateChatTitle(messages: string[]): Promise<string> {
    const titlePrompt = PromptTemplate.fromTemplate(config.titlePrompt);

    const titleChain = new LLMChain({
      llm,
      prompt: titlePrompt,
    });

    const firstMessage = messages[0] || "";
    const result = await titleChain.invoke({ message: firstMessage });
    return result.text.trim() || "Nueva Conversación";
  }

  // Chain for extracting user information
  async extractUserInfo(message: string): Promise<Record<string, string>> {
    const extractionPrompt = PromptTemplate.fromTemplate(config.extractionPrompt);

    const extractionChain = new LLMChain({
      llm,
      prompt: extractionPrompt,
    });

    try {
      const result = await extractionChain.invoke({ message });
      const jsonMatch = result.text.match(/\{.*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('Error extracting user info:', error);
      return {};
    }
  }

  // Sequential chain for processing user input
  async processUserInput(userId: string, message: string): Promise<{
    response: string;
    extractedInfo: Record<string, string>;
    title?: string;
  }> {
    // First chain: Extract user information
    const infoPrompt = PromptTemplate.fromTemplate(
      "Extrae información personal del mensaje: {message}\n\nRespuesta en formato JSON:"
    );
    const infoChain = new LLMChain({
      llm,
      prompt: infoPrompt,
      outputKey: "extracted_info",
    });

    // Second chain: Generate response
    const responsePrompt = PromptTemplate.fromTemplate(
      `Responde al siguiente mensaje de forma natural y útil en español.
      
      Información del usuario: {extracted_info}
      Mensaje: {message}
      
      Respuesta:`
    );
    const responseChain = new LLMChain({
      llm,
      prompt: responsePrompt,
      outputKey: "response",
    });

    // Create sequential chain
    const fullChain = new SequentialChain({
      chains: [infoChain, responseChain],
      inputVariables: ["message"],
      outputVariables: ["extracted_info", "response"],
    });

    const result = await fullChain.invoke({ message });
    
    let extractedInfo = {};
    try {
      const jsonMatch = result.extracted_info.match(/\{.*\}/);
      if (jsonMatch) {
        extractedInfo = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parsing extracted info:', error);
    }

    return {
      response: result.response,
      extractedInfo,
    };
  }
}

// Vector store for semantic search
export class LangChainVectorStore {
  private vectorStore: MemoryVectorStore;

  constructor() {
    this.vectorStore = new MemoryVectorStore(embeddings);
  }

  async addDocuments(documents: string[], metadata?: Record<string, any>[]): Promise<void> {
    await this.vectorStore.addDocuments(
      documents.map((doc, i) => ({
        pageContent: doc,
        metadata: metadata?.[i] || {},
      }))
    );
  }

  async similaritySearch(query: string, k: number = 5): Promise<string[]> {
    const results = await this.vectorStore.similaritySearch(query, k);
    return results.map(doc => doc.pageContent);
  }

  async similaritySearchWithScore(query: string, k: number = 5): Promise<Array<{ content: string; score: number }>> {
    const results = await this.vectorStore.similaritySearchWithScore(query, k);
    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      score,
    }));
  }
}

// Agent for complex reasoning
export class LangChainAgent {
  private conversation: LangChainConversation;
  private chains: LangChainChains;
  private vectorStore: LangChainVectorStore;

  constructor() {
    this.conversation = new LangChainConversation();
    this.chains = new LangChainChains();
    this.vectorStore = new LangChainVectorStore();
  }

  async* processMessage(userId: string, message: string, chatId?: number): AsyncGenerator<string> {
    try {
      // Get similar conversations for context
      const similarEmbeddings = await storage.getSimilarEmbeddings(userId, message, 3);
      const contextSnippets = similarEmbeddings
        .map(s => `Usuario: ${s.user_input}\nAsistente: ${s.bot_output}`)
        .join('\n\n');

      // Create enhanced prompt with context using the same prompt as OpenAI
      const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
      
      const enhancedPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      const chain = enhancedPrompt.pipe(llm).pipe(new StringOutputParser());

      // Stream the response
      const stream = await chain.stream({
        input: message,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk;
        yield chunk;
      }

      // Store the interaction for future reference
      if (chatId) {
        await storage.createEmbedding(userId, message, fullResponse);
      }

      // Extract and store user information
      const extractedInfo = await this.chains.extractUserInfo(message);
      for (const [key, value] of Object.entries(extractedInfo)) {
        if (value && value.trim()) {
          await storage.setUserContext(userId, key, value);
        }
      }

    } catch (error) {
      console.error('LangChain agent error:', error);
      throw new Error('Failed to process message with LangChain agent');
    }
  }

  async generateTitle(messages: string[]): Promise<string> {
    return await this.chains.generateChatTitle(messages);
  }
}

// Export instances
export const langChainConversation = new LangChainConversation();
export const langChainChains = new LangChainChains();
export const langChainVectorStore = new LangChainVectorStore();
export const langChainAgent = new LangChainAgent(); 