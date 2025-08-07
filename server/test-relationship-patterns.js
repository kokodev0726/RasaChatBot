// Test script for relationship pattern detection

import { storage } from './storage.js';
import { langChainAgent } from './langchain.js';
import { toolExecutor } from './langchain.tools.js';

async function testRelationshipPatterns() {
  try {
    console.log('Starting relationship pattern testing...');
    
    // Use a test user ID with timestamp to avoid conflicts
    const userId = 'test-user-patterns-' + Date.now();
    const chatId = 1; // Simulate a chat ID
    
    // Array of test cases with different relationship expressions
    const testCases = [
      // Direct family relationships - various phrasings
      { message: "Mi hermana se llama Laura", expectedEntity: "Laura", expectedRelationship: "hermana" },
      { message: "Tengo una hermana que se llama Marta", expectedEntity: "Marta", expectedRelationship: "hermana" },
      { message: "Roberto es mi hermano", expectedEntity: "Roberto", expectedRelationship: "hermano" },
      { message: "Juan y Pedro son mis hermanos", expectedEntity: ["Juan", "Pedro"], expectedRelationship: "hermano" },
      
      // Indirect mentions
      { message: "María vive en Madrid con sus hijos", expectedEntity: "María", expectedRelationship: "madre" },
      { message: "Visité a mi tía Carmen ayer", expectedEntity: "Carmen", expectedRelationship: "tía" },
      
      // Multiple relationships in one message
      { message: "Mi padre se llama José y mi madre se llama Ana", 
        multipleRelationships: true,
        expected: [
          { entity1: "yo", relationship: "hijo", entity2: "José" },
          { entity1: "yo", relationship: "hijo", entity2: "Ana" }
        ]
      },
      
      // Sister-specific tests (the problematic case)
      { message: "Como te comenté, mi hermana Elena vive en Barcelona", expectedEntity: "Elena", expectedRelationship: "hermana" },
      { message: "Mi hermana mayor se llama Sofía", expectedEntity: "Sofía", expectedRelationship: "hermana" },
      { message: "Te había dicho que tengo una hermana?", expectedEntity: null, expectedRelationship: "hermana" },
      
      // Possessive phrases without explicit relationship
      { message: "La casa de mi hermana es grande", expectedEntity: null, expectedRelationship: "hermana" },
      
      // Non-person relationships
      { message: "Mi coche es un Toyota", expectedEntity: "Toyota", expectedRelationship: "marca" },
      { message: "Vivo en Madrid", expectedEntity: "Madrid", expectedRelationship: "reside_en" },
      { message: "Trabajo para Google", expectedEntity: "Google", expectedRelationship: "trabajo" },
    ];
    
    // Process each test case
    for (const testCase of testCases) {
      console.log(`\n======= Testing: "${testCase.message}" =======`);
      
      // 1. Test relationship extraction
      const extractionResult = await toolExecutor.executeTool(
        "extract_relationships",
        `${userId}:${testCase.message}`
      );
      console.log("Extraction result:", extractionResult);
      
      // 2. Get stored relationships
      const relationships = await storage.getRelationships(userId);
      console.log(`Found ${relationships.length} relationships after extraction`);
      
      // 3. Check if expected relationship was detected
      if (testCase.multipleRelationships) {
        // For test cases with multiple expected relationships
        for (const expected of testCase.expected) {
          const foundMatch = relationships.some(rel => 
            rel.entity1.toLowerCase() === expected.entity1.toLowerCase() &&
            rel.relationship.toLowerCase().includes(expected.relationship.toLowerCase()) &&
            (!expected.entity2 || rel.entity2.toLowerCase().includes(expected.entity2.toLowerCase()))
          );
          
          console.log(`Looking for relationship: ${expected.entity1} ${expected.relationship} ${expected.entity2 || '?'}`);
          console.log(`Found: ${foundMatch ? 'YES ✅' : 'NO ❌'}`);
        }
      } else {
        // For simple test cases with a single expected relationship
        const foundMatch = relationships.some(rel => 
          (rel.entity1.toLowerCase() === 'yo' || rel.entity1.toLowerCase() === 'me') &&
          rel.relationship.toLowerCase().includes(testCase.expectedRelationship.toLowerCase()) &&
          (!testCase.expectedEntity || 
            (Array.isArray(testCase.expectedEntity) ? 
              testCase.expectedEntity.some(e => rel.entity2.toLowerCase().includes(e.toLowerCase())) :
              rel.entity2.toLowerCase().includes(testCase.expectedEntity.toLowerCase()))
          )
        );
        
        console.log(`Looking for relationship: yo ${testCase.expectedRelationship} ${testCase.expectedEntity || '?'}`);
        console.log(`Found: ${foundMatch ? 'YES ✅' : 'NO ❌'}`);
      }
      
      // 4. For the sister case specifically, test querying
      if (testCase.expectedRelationship === 'hermana' && testCase.expectedEntity) {
        console.log("\nTesting sister relationship querying...");
        
        // Test with specific query: "who is my sister?"
        const queryMessage = "¿Quién es mi hermana?";
        console.log(`Query: "${queryMessage}"`);
        
        let response = '';
        for await (const chunk of langChainAgent.processMessage(userId, queryMessage, chatId)) {
          response += chunk;
        }
        
        console.log(`Response: "${response}"`);
        
        // Check if the response contains the expected sister's name
        const containsName = response.toLowerCase().includes(testCase.expectedEntity.toLowerCase());
        console.log(`Response contains sister's name: ${containsName ? 'YES ✅' : 'NO ❌'}`);
      }
    }
    
    console.log("\n===== Test Summary =====");
    console.log(`Total test cases: ${testCases.length}`);
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the test
(async () => {
  try {
    await testRelationshipPatterns();
    console.log('Test completed');
  } catch (err) {
    console.error('Test failed with error:', err);
  }
})();