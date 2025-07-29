import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { streamChatCompletion, transcribeAudio, generateChatTitle, extractAndStoreUserInfo } from "./openai";
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
      const { content, role } = insertMessageSchema.parse(req.body);
      
      // Verify chat ownership
      const chat = await storage.getChat(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      

      await fetch('http://187.33.155.76:3003/webhooks/rest/webhook', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'charset': 'UTF-8',
        },
        credentials: "same-origin",
        body: JSON.stringify({ "sender": "user", "message": content }),
      });

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

  // Streaming chat completion
  app.post('/api/chats/:chatId/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chatId = parseInt(req.params.chatId);
      const { message } = z.object({ message: z.string() }).parse(req.body);
      
      // Verify chat ownership
      const chat = await storage.getChatWithMessages(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await fetch('http://187.33.155.76:3003/webhooks/rest/webhook', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'charset': 'UTF-8',
        },
        credentials: "same-origin",
        body: JSON.stringify({ "sender": "user", "message": message }),
      });
      
      // Save user message
      await storage.createMessage({
        chatId,
        content: message,
        role: "user",
      });
      
      // Extract and store user information
      // await extractAndStoreUserInfo(message, userId);
      
      // Prepare messages for OpenAI
      const messages = chat.messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      
      // Add new user message
      messages.push({ role: "user", content: message });
      
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      
      let fullResponse = "";
      
      try {
        // Stream the response
        for await (const chunk of streamChatCompletion(messages, userId)) {
          fullResponse += chunk;
          res.write(chunk);
        }
        
        // Save AI response
        await storage.createMessage({
          chatId,
          content: fullResponse,
          role: "assistant",
        });


        await storage.createEmbedding(message, fullResponse);
        
        // Update chat title if this is the first message
        if (messages.length === 1) {
          const title = await generateChatTitle(messages);
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

  const httpServer = createServer(app);
  return httpServer;
}
