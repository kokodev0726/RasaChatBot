import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { streamChatCompletion, transcribeAudio, generateChatTitle, extractAndStoreUserInfo } from "./openai";
import { langChainAgent, langChainConversation, langChainChains } from "./langchain";
import { toolExecutor } from "./langchain.tools";
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

      // If this is a user message and LangChain is enabled, we might want to process it
      if (role === "user" && useLangChain) {
        // Extract user information using LangChain
        const extractedInfo = await langChainChains.extractUserInfo(content);
        for (const [key, value] of Object.entries(extractedInfo)) {
          if (value && value.trim()) {
            await storage.setUserContext(userId, key, value);
          }
        }
      }

      // For assistant messages, we might want to use LangChain to generate them
      if (role === "assistant" && useLangChain) {
        // This would typically be handled by the streaming endpoint
        // But we can add LangChain processing here if needed
      }

      const message = await storage.createMessage({
        chatId,
        content,
        role,
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Streaming chat completion with LangChain
  app.post('/api/chats/:chatId/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chatId = parseInt(req.params.chatId);
      const { message, useLangChain = true } = z.object({ 
        message: z.string(),
        useLangChain: z.boolean().optional()
      }).parse(req.body);
      
      // Verify chat ownership
      const chat = await storage.getChatWithMessages(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Save user message
      await storage.createMessage({
        chatId,
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
        if (useLangChain) {
          // Use LangChain for response generation
          const stream = langChainAgent.processMessage(userId, message, chatId);
          
          for await (const chunk of stream) {
            fullResponse += chunk;
            res.write(chunk);
          }
        } else {
          // Fallback to OpenAI
          const rasa_response = await fetch('http://187.33.155.76:3003/webhooks/rest/webhook', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'charset': 'UTF-8',
            },
            credentials: "same-origin",
            body: JSON.stringify({
              "sender": "user",
              "message": message,
              "metadata": {
                "user_id": userId
              }
            }),
          });

          console.log(rasa_response);
          
          // Prepare messages for OpenAI
          const messages = chat.messages.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));
          
          // Add new user message
          messages.push({ role: "user", content: message });
          
          // Stream the response using OpenAI
          for await (const chunk of streamChatCompletion(messages, userId)) {
            fullResponse += chunk;
            res.write(chunk);
          }
        }
        
        // Save AI response
        await storage.createMessage({
          chatId,
          content: fullResponse,
          role: "assistant",
        });

        // Create embedding for future reference
        await storage.createEmbedding(userId, message, fullResponse);
        
        // Update chat title if this is the first message
        if (chat.messages.length === 0) {
          const title = useLangChain 
            ? await langChainChains.generateChatTitle([message])
            : await generateChatTitle([{ role: "user", content: message }]);
          await storage.updateChatTitle(chatId, title);
        }
        
        res.end();
      } catch (streamError) {
        console.error("Streaming error:", streamError);
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

  // LangChain specific routes
  app.post('/api/langchain/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message, chatId, useAgent = true } = z.object({ 
        message: z.string(),
        chatId: z.number().optional(),
        useAgent: z.boolean().optional()
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
        // Use LangChain agent or conversation based on preference
        const stream = useAgent 
          ? langChainAgent.processMessage(userId, message, chatId)
          : langChainConversation.streamConversation(userId, message);

        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(chunk);
        }

        // Save AI response if chatId is provided
        if (chatId) {
          await storage.createMessage({
            chatId,
            content: fullResponse,
            role: "assistant",
          });
        }

        res.end();
      } catch (streamError) {
        console.error("LangChain streaming error:", streamError);
        res.write("Error: Failed to generate response");
        res.end();
      }
    } catch (error) {
      console.error("Error in LangChain streaming endpoint:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // LangChain-only chat endpoint (for when you want to force LangChain usage)
  app.post('/api/langchain/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message, chatId, useAgent = true, extractInfo = true } = z.object({ 
        message: z.string(),
        chatId: z.number().optional(),
        useAgent: z.boolean().optional(),
        extractInfo: z.boolean().optional()
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
          content: message,
          role: "user",
        });
      }

      // Extract user information if enabled
      if (extractInfo) {
        const extractedInfo = await langChainChains.extractUserInfo(message);
        for (const [key, value] of Object.entries(extractedInfo)) {
          if (value && value.trim()) {
            await storage.setUserContext(userId, key, value);
          }
        }
      }

      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      let fullResponse = "";

      try {
        // Always use LangChain for this endpoint
        const stream = useAgent 
          ? langChainAgent.processMessage(userId, message, chatId)
          : langChainConversation.streamConversation(userId, message);

        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(chunk);
        }

        // Save AI response if chatId is provided
        if (chatId) {
          await storage.createMessage({
            chatId,
            content: fullResponse,
            role: "assistant",
          });

          // Create embedding for future reference
          await storage.createEmbedding(userId, message, fullResponse);
        }

        res.end();
      } catch (streamError) {
        console.error("LangChain chat error:", streamError);
        res.write("Error: Failed to generate response");
        res.end();
      }
    } catch (error) {
      console.error("Error in LangChain chat endpoint:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // LangChain title generation
  app.post('/api/langchain/title', isAuthenticated, async (req: any, res) => {
    try {
      const { messages } = z.object({ 
        messages: z.array(z.string())
      }).parse(req.body);

      const title = await langChainChains.generateChatTitle(messages);
      res.json({ title });
    } catch (error) {
      console.error("Error generating title with LangChain:", error);
      res.status(500).json({ message: "Failed to generate title" });
    }
  });

  // LangChain user info extraction
  app.post('/api/langchain/extract-info', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message } = z.object({ 
        message: z.string()
      }).parse(req.body);

      const extractedInfo = await langChainChains.extractUserInfo(message);
      
      // Store extracted information
      for (const [key, value] of Object.entries(extractedInfo)) {
        if (value && value.trim()) {
          await storage.setUserContext(userId, key, value);
        }
      }

      res.json({ extractedInfo });
    } catch (error) {
      console.error("Error extracting user info with LangChain:", error);
      res.status(500).json({ message: "Failed to extract user information" });
    }
  });

  // LangChain memory management
  app.delete('/api/langchain/memory/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Only allow users to clear their own memory
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Clear memory (this would need to be implemented in the LangChain service)
      res.json({ message: "Memory cleared" });
    } catch (error) {
      console.error("Error clearing memory:", error);
      res.status(500).json({ message: "Failed to clear memory" });
    }
  });

  // LangChain tools routes
  app.get('/api/langchain/tools', isAuthenticated, async (req: any, res) => {
    try {
      const availableTools = toolExecutor.getAvailableTools();
      const toolDescriptions = toolExecutor.getToolDescriptions();
      
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

      const result = await toolExecutor.executeTool(toolName, input);
      res.json({ result });
    } catch (error) {
      console.error("Error executing tool:", error);
      res.status(500).json({ message: "Failed to execute tool" });
    }
  });

  // LangChain connection test
  app.get('/api/langchain/test-connection', isAuthenticated, async (req: any, res) => {
    try {
      // Test if LangChain components are working
      const testMessage = "Test connection";
      const testUserId = req.user.id;
      
      // Try to generate a simple response
      let responseChunks = [];
      for await (const chunk of langChainAgent.processMessage(testUserId, testMessage)) {
        responseChunks.push(chunk);
      }
      
      const response = responseChunks.join('');
      
      if (response && response.length > 0) {
        res.json({ 
          connected: true, 
          message: 'LangChain is working properly',
          testResponse: response.substring(0, 100) + '...'
        });
      } else {
        res.json({ 
          connected: false, 
          message: 'LangChain is not responding properly' 
        });
      }
    } catch (error) {
      console.error('Error testing LangChain connection:', error);
      res.json({ 
        connected: false, 
        message: 'LangChain connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
