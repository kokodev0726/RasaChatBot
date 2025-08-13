import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { streamChatCompletion, transcribeAudio, generateChatTitle, extractAndStoreUserInfo } from "./openai";
import { langChainAgent, langChainConversation, langChainChains } from "./langchain";
import { toolExecutor } from "./langchain.tools";
import { PsychologyAgent } from "./psychology";
import { insertChatSchema, insertMessageSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Chat routes
  app.get('/api/chats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chats = await storage.getUserChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });

  app.post('/api/chats', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized - missing user ID" });
      }

      const { title } = insertChatSchema.parse(req.body);
      
      const chat = await storage.createChat({
        userId: req.user.id,
        title,
      });

      res.json(chat);
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(500).json({ message: "Failed to create chat" });
    }
  });

  app.get('/api/chats/:chatId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chatId = parseInt(req.params.chatId);
      
      const chat = await storage.getChatWithMessages(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Check if user owns this chat
      if (chat.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(chat);
    } catch (error) {
      console.error("Error fetching chat:", error);
      res.status(500).json({ message: "Failed to fetch chat" });
    }
  });

  app.delete('/api/chats/:chatId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chatId = parseInt(req.params.chatId);
      
      await storage.deleteChat(chatId, userId);
      res.json({ message: "Chat deleted" });
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  // Message routes
  app.post('/api/chats/:chatId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chatId = parseInt(req.params.chatId);
      const { content, role, useLangChain = true } = insertMessageSchema.extend({
        useLangChain: z.boolean().optional()
      }).parse(req.body);
      
      // Verify chat ownership
      const chat = await storage.getChat(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const message = await storage.createMessage({
        chatId,
        userId,
        content,
        role,
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Streaming chat completion - now uses Psychology Agent only
  app.post('/api/chats/:chatId/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chatId = parseInt(req.params.chatId);
      const { message } = z.object({ 
        message: z.string()
      }).parse(req.body);
      
      // Verify chat ownership
      const chat = await storage.getChatWithMessages(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Save user message
      await storage.createMessage({
        chatId,
        userId,
        content: message,
        role: "user",
      });
      
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      
      let fullResponse = "";
      
      try {
        // Always use Psychology Agent (integrated with all capabilities)
        const stream = psychologyAgent.processMessage(userId, message, chatId);
        
        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(chunk);
        }
        
        // Save AI response
        await storage.createMessage({
          chatId,
          userId,
          content: fullResponse,
          role: "assistant",
        });

        // Create embedding for future reference
        await storage.createEmbedding(userId, message, fullResponse);
        
        // Update chat title if this is the first message
        if (chat.messages.length === 0) {
          const title = await psychologyAgent.generateChatTitle([message]);
          await storage.updateChatTitle(chatId, title);
        }
        
        res.end();
      } catch (streamError) {
        console.error("Psychology streaming error:", streamError);
        res.write("Error: Failed to generate response");
        res.end();
      }
    } catch (error) {
      console.error("Error in streaming endpoint:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Voice transcription
  app.post('/api/transcribe', isAuthenticated, upload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      
      const transcription = await transcribeAudio(req.file.buffer);
      res.json({ transcription });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  // LangChain specific routes - now redirected to Psychology Agent
  app.post('/api/langchain/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message, chatId } = z.object({ 
        message: z.string(),
        chatId: z.number().optional()
      }).parse(req.body);

      // Verify chat ownership if chatId is provided
      if (chatId) {
        const chat = await storage.getChat(chatId);
        if (!chat || chat.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Save user message if chatId is provided
      if (chatId) {
        await storage.createMessage({
          chatId,
          userId,
          content: message,
          role: "user",
        });
      }

      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      let fullResponse = "";

      try {
        // Use Psychology Agent (integrated with all LangChain capabilities)
        const stream = psychologyAgent.processMessage(userId, message, chatId);

        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(chunk);
        }

        // Save AI response if chatId is provided
        if (chatId) {
          await storage.createMessage({
            chatId,
            userId,
            content: fullResponse,
            role: "assistant",
          });
        }

        res.end();
      } catch (streamError) {
        console.error("Psychology streaming error:", streamError);
        res.write("Error: Failed to generate response");
        res.end();
      }
    } catch (error) {
      console.error("Error in Psychology streaming endpoint:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // LangChain-only chat endpoint - now redirected to Psychology Agent
  app.post('/api/langchain/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message, chatId } = z.object({ 
        message: z.string(),
        chatId: z.number().optional()
      }).parse(req.body);

      // Verify chat ownership if chatId is provided
      let chat;
      if (chatId) {
        chat = await storage.getChatWithMessages(chatId);
        if (!chat || chat.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Save user message if chatId is provided
      if (chatId) {
        await storage.createMessage({
          chatId,
          userId,
          content: message,
          role: "user",
        });
      }

      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      let fullResponse = "";

      try {
        // Use Psychology Agent (includes all LangChain capabilities)
        const stream = psychologyAgent.processMessage(userId, message, chatId);

        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(chunk);
        }

        // Save AI response if chatId is provided
        if (chatId) {
          await storage.createMessage({
            chatId,
            userId,
            content: fullResponse,
            role: "assistant",
          });

          // Create embedding for future reference
          await storage.createEmbedding(userId, message, fullResponse);

          // Update chat title if this is the first message
          if (chat && chat.messages.length === 0) {
            const title = await psychologyAgent.generateChatTitle([message]);
            await storage.updateChatTitle(chatId, title);
          }
        }

        res.end();
      } catch (streamError) {
        console.error("Psychology chat error:", streamError);
        res.write("Error: Failed to generate response");
        res.end();
      }
    } catch (error) {
      console.error("Error in Psychology chat endpoint:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // LangChain title generation - now uses Psychology Agent
  app.post('/api/langchain/title', isAuthenticated, async (req: any, res) => {
    try {
      const { messages } = z.object({ 
        messages: z.array(z.string())
      }).parse(req.body);

      const title = await psychologyAgent.generateChatTitle(messages);
      res.json({ title });
    } catch (error) {
      console.error("Error generating title with Psychology Agent:", error);
      res.status(500).json({ message: "Failed to generate title" });
    }
  });

  // LangChain user info extraction - now uses Psychology Agent
  app.post('/api/langchain/extract-info', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message } = z.object({ 
        message: z.string()
      }).parse(req.body);

      const extractedInfo = await psychologyAgent.extractUserInfo(message);
      
      // Store extracted information
      for (const [key, value] of Object.entries(extractedInfo)) {
        if (value && value.trim()) {
          await storage.setUserContext(userId, key, value);
        }
      }

      res.json({ extractedInfo });
    } catch (error) {
      console.error("Error extracting user info with Psychology Agent:", error);
      res.status(500).json({ message: "Failed to extract user information" });
    }
  });

  // LangChain memory management - now uses Psychology Agent
  app.delete('/api/langchain/memory/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Only allow users to clear their own memory
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Clear all memory using Psychology Agent
      psychologyAgent.clearAllMemory(userId);
      res.json({ message: "All memory cleared" });
    } catch (error) {
      console.error("Error clearing memory:", error);
      res.status(500).json({ message: "Failed to clear memory" });
    }
  });

  // LangChain tools routes - now uses Psychology Agent
  app.get('/api/langchain/tools', isAuthenticated, async (req: any, res) => {
    try {
      const availableTools = await psychologyAgent.getAvailableTools();
      const toolDescriptions = await psychologyAgent.getToolDescriptions();
      
      res.json({
        availableTools,
        toolDescriptions,
      });
    } catch (error) {
      console.error("Error getting available tools:", error);
      res.status(500).json({ message: "Failed to get available tools" });
    }
  });

  app.post('/api/langchain/tools/execute', isAuthenticated, async (req: any, res) => {
    try {
      const { toolName, input } = z.object({
        toolName: z.string(),
        input: z.string(),
      }).parse(req.body);

      const result = await psychologyAgent.executeTool(toolName, input);
      res.json({ result });
    } catch (error) {
      console.error("Error executing tool:", error);
      res.status(500).json({ message: "Failed to execute tool" });
    }
  });

  // LangChain connection test - now uses Psychology Agent
  app.get('/api/langchain/test-connection', isAuthenticated, async (req: any, res) => {
    try {
      // Test if Psychology Agent (with integrated LangChain) is working
      const testMessage = "Test connection";
      const testUserId = req.user.id;
      
      // Try to generate a simple response
      let responseChunks = [];
      for await (const chunk of psychologyAgent.processMessage(testUserId, testMessage)) {
        responseChunks.push(chunk);
      }
      
      const response = responseChunks.join('');
      
      if (response && response.length > 0) {
        res.json({ 
          connected: true, 
          message: 'Psychology Agent is working properly',
          testResponse: response.substring(0, 100) + '...'
        });
      } else {
        res.json({ 
          connected: false, 
          message: 'Psychology Agent is not responding properly' 
        });
      }
    } catch (error) {
      console.error('Error testing Psychology Agent connection:', error);
      res.json({ 
        connected: false, 
        message: 'Psychology Agent connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Psychology Agent routes
  const psychologyAgent = new PsychologyAgent();

  // Psychology chat streaming - now uses integrated Psychology Agent
  app.post('/api/psychology/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message, chatId } = z.object({ 
        message: z.string(),
        chatId: z.number().optional()
      }).parse(req.body);

      // Verify chat ownership if chatId is provided
      if (chatId) {
        const chat = await storage.getChat(chatId);
        if (!chat || chat.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Save user message if chatId is provided
      if (chatId) {
        await storage.createMessage({
          chatId,
          userId,
          content: message,
          role: "user",
        });
      }

      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      let fullResponse = "";

      try {
        // Use integrated psychology agent (includes all LangChain capabilities)
        const stream = psychologyAgent.processMessage(userId, message, chatId);
        
        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(chunk);
        }
        
        // Save AI response if chatId is provided
        if (chatId) {
          await storage.createMessage({
            chatId,
            userId,
            content: fullResponse,
            role: "assistant",
          });

          // Create embedding for future reference
          await storage.createEmbedding(userId, message, fullResponse);
        }
        
        res.end();
      } catch (streamError) {
        console.error("Psychology streaming error:", streamError);
        res.write("Error: Failed to generate psychology response");
        res.end();
      }
    } catch (error) {
      console.error("Error in psychology streaming endpoint:", error);
      res.status(500).json({ message: "Failed to process psychology message" });
    }
  });

  // Get psychology session statistics
  app.get('/api/psychology/stats/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Only allow users to access their own stats
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const stats = await psychologyAgent.getSessionStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting psychology stats:", error);
      res.status(500).json({ message: "Failed to get psychology stats" });
    }
  });

  // Reset psychology session - now clears all integrated memory
  app.delete('/api/psychology/session/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Only allow users to reset their own session
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      psychologyAgent.clearAllMemory(userId);
      res.json({ message: "All psychology and LangChain memory cleared" });
    } catch (error) {
      console.error("Error resetting psychology session:", error);
      res.status(500).json({ message: "Failed to reset psychology session" });
    }
  });

  // Get predefined psychology questions
  app.get('/api/psychology/questions', isAuthenticated, async (req: any, res) => {
    try {
      const { category } = req.query;
      
      let questions;
      if (category && typeof category === 'string') {
        questions = await psychologyAgent.getQuestionsByCategory(category);
      } else {
        questions = await psychologyAgent.getAllPredefinedQuestions();
      }
      
      res.json({ questions });
    } catch (error) {
      console.error("Error getting psychology questions:", error);
      res.status(500).json({ message: "Failed to get psychology questions" });
    }
  });

  // Get psychology question categories
  app.get('/api/psychology/categories', isAuthenticated, async (req: any, res) => {
    try {
      const categories = [
        'initial_assessment',
        'coping_mechanisms', 
        'social_support',
        'past_experiences',
        'emotional_wellbeing',
        'goals_and_motivation',
        'self_awareness'
      ];
      res.json({ categories });
    } catch (error) {
      console.error("Error getting psychology categories:", error);
      res.status(500).json({ message: "Failed to get psychology categories" });
    }
  });

  // Psychology questions management routes
  app.post('/api/psychology/questions', isAuthenticated, async (req: any, res) => {
    try {
      const { question, category, orderIndex = 0 } = z.object({
        question: z.string(),
        category: z.string(),
        orderIndex: z.number().optional()
      }).parse(req.body);

      const newQuestion = await storage.addPsychologyQuestion({
        question,
        category,
        isActive: true,
        orderIndex
      });

      res.json(newQuestion);
    } catch (error) {
      console.error("Error creating psychology question:", error);
      res.status(500).json({ message: "Failed to create psychology question" });
    }
  });

  app.put('/api/psychology/questions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { question, category, isActive, orderIndex } = req.body;

      const updatedQuestion = await storage.updatePsychologyQuestion(parseInt(id), {
        question,
        category,
        isActive,
        orderIndex
      });

      res.json(updatedQuestion);
    } catch (error) {
      console.error("Error updating psychology question:", error);
      res.status(500).json({ message: "Failed to update psychology question" });
    }
  });

  app.delete('/api/psychology/questions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePsychologyQuestion(parseInt(id));
      res.json({ message: "Psychology question deleted" });
    } catch (error) {
      console.error("Error deleting psychology question:", error);
      res.status(500).json({ message: "Failed to delete psychology question" });
    }
  });

  app.get('/api/psychology/questions/all', isAuthenticated, async (req: any, res) => {
    try {
      const questions = await storage.getPsychologyQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error getting all psychology questions:", error);
      res.status(500).json({ message: "Failed to get psychology questions" });
    }
  });

  // User generated questions routes
  app.get('/api/psychology/user-questions/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Only allow users to access their own questions
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const questions = await storage.getUserGeneratedQuestions(userId);
      res.json(questions);
    } catch (error) {
      console.error("Error getting user generated questions:", error);
      res.status(500).json({ message: "Failed to get user generated questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
