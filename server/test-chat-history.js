// Test script for chat history retrieval

import { storage } from './storage.js';
import { langChainAgent } from './langchain.js';
import { toolExecutor } from './langchain.tools.js';

async function testChatHistory() {
  try {
    console.log('Starting chat history test...');
    
    // Use a test user ID with timestamp to avoid conflicts
    const userId = 'test-chat-history-' + Date.now();
    
    // Create a chat for the user
    const chat = await storage.createChat({
      userId: userId,
      title: "Test Chat History"
    });
    
    console.log(`Created test chat with ID: ${chat.id}`);
    
    // Create a series of messages
    const conversations = [
      { user: "Hola, ¿cómo estás?", bot: "¡Hola! Estoy bien, ¿y tú?" },
      { user: "Me llamo Carlos", bot: "Encantado de conocerte, Carlos. ¿En qué puedo ayudarte hoy?" },
      { user: "Vivo en Madrid", bot: "Madrid es una ciudad preciosa. ¿Qué te gusta hacer allí?" },
      { user: "Mi hermana se llama Ana", bot: "Entiendo que tienes una hermana llamada Ana. ¿Qué edad tiene?" },
      { user: "Mi madre se llama María y mi padre Juan", bot: "Gracias por contarme sobre tu familia. Ahora sé que tu hermana es Ana, tu madre María y tu padre Juan." }
    ];
    
    // Add messages to the chat
    console.log('Adding test messages...');
    for (const convo of conversations) {
      // Add user message
      await storage.createMessage({
        chatId: chat.id,
        content: convo.user,
        role: "user"
      });
      
      // Add bot message
      await storage.createMessage({
        chatId: chat.id,
        content: convo.bot,
        role: "assistant"
      });
      
      // Also create embeddings for this conversation
      await storage.createEmbedding(userId, convo.user, convo.bot);
    }
    
    // Test relationship extraction from messages
    console.log('\nExtracting relationships from messages...');
    for (const convo of conversations) {
      await toolExecutor.executeTool(
        "extract_relationships",
        `${userId}:${convo.user}`
      );
    }
    
    // Get stored relationships
    const relationships = await storage.getRelationships(userId);
    console.log(`\nFound ${relationships.length} relationships:`);
    for (const rel of relationships) {
      console.log(`- ${rel.entity1} ${rel.relationship} ${rel.entity2}`);
    }
    
    // Now test the chat history function
    console.log('\nRetrieving chat history using getUserChatHistory:');
    const chatHistory = await langChainAgent.getUserChatHistory(userId);
    console.log(chatHistory);
    
    // Test the embeddings history function
    console.log('\nRetrieving embeddings history using getUserEmbeddingsHistory:');
    const embeddingsHistory = await langChainAgent.getUserEmbeddingsHistory(userId);
    console.log(embeddingsHistory);
    
    // Test a query that should use the history
    console.log('\nTesting a query that should use chat history context:');
    const queryResponse = await langChainAgent.processMessage(userId, "¿Cómo se llama mi hermana?", chat.id);
    
    // Collect the entire response
    let fullResponse = '';
    for await (const chunk of queryResponse) {
      fullResponse += chunk;
    }
    console.log(`Query response: ${fullResponse}`);
    
    console.log('\nTest completed successfully');
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the test
(async () => {
  try {
    await testChatHistory();
  } catch (err) {
    console.error('Test failed with error:', err);
  }
})();