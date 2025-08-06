// Test script for conversation flow with relationships

import { storage } from './storage.js';
import { langChainAgent } from './langchain.js';

async function testConversationFlow() {
  try {
    console.log('Starting conversation flow test...');
    
    // Use a test user ID
    const userId = 'test-user-' + Date.now();
    const chatId = 1; // Simulate a chat ID
    
    console.log('\n--- Testing relationship extraction and response ---');
    
    // Simulate a conversation about family relationships
    const messages = [
      "Me llamo Roberto y tengo 45 años",
      "Tengo varios hermanos. Óscar y Raúl",
      "Con Oscar me llevo bien pero con Raúl no me hablo.",
      "Luego está mi hermana Eduarda que tiene un niño y una niña",
      "Yo tengo dos hijos Markel y Oier",
      "Mi madre tiene 83 años y se llama Encarnación pero todos le llaman Encarna. Cumple años el 26 de Agosto",
      "Mi mujer se llama Isabel",
      // Now ask about relationships
      "Dame una relación de todos mis parientes"
    ];
    
    // Process each message
    for (const message of messages) {
      console.log(`\nUser input: ${message}`);
      
      // Get response
      let response = '';
      for await (const chunk of langChainAgent.processMessage(userId, message, chatId)) {
        response += chunk;
      }
      
      console.log(`Bot response: ${response}`);
      
      // If this is the last message (asking about relationships), check if response contains family information
      if (message.includes("relación de todos mis parientes")) {
        if (response.includes("Isabel") && 
            response.includes("Óscar") && 
            response.includes("Raúl") && 
            response.includes("Eduarda") && 
            response.includes("Markel") && 
            response.includes("Oier") && 
            response.includes("Encarnación")) {
          console.log('\n✅ TEST PASSED: Bot correctly listed family members');
        } else {
          console.log('\n❌ TEST FAILED: Bot did not include all family members in the response');
          console.log('Expected all family members to be mentioned');
          console.log('Actual response:', response);
        }
      }
    }
    
    // Get all stored relationships
    console.log('\nAll stored relationships:');
    const relationships = await storage.getRelationships(userId);
    console.log(relationships);
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the test
(async () => {
  try {
    await testConversationFlow();
    console.log('Test completed');
  } catch (err) {
    console.error('Test failed with error:', err);
  }
})();