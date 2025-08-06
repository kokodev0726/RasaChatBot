// Test script for relationship inference

import { storage } from './storage.js';
import { toolExecutor } from './langchain.tools.js';

async function testRelationshipInference() {
  try {
    console.log('Starting relationship inference test...');
    
    // Use a test user ID
    const userId = 'test-user-' + Date.now();
    
    console.log('Extracting relationships from user statements...');
    
    // Process the first statement: "My wife is arina"
    await toolExecutor.executeTool(
      "extract_relationships", 
      `${userId}:My wife is arina`
    );
    
    // Process the second statement: "arina has a bro named alex"
    await toolExecutor.executeTool(
      "extract_relationships", 
      `${userId}:arina has a bro named alex`
    );
    
    // Process the third statement: "alex'wife is irina"
    await toolExecutor.executeTool(
      "extract_relationships", 
      `${userId}:alex's wife is irina`
    );
    
    // Get all stored relationships
    console.log('\nAll stored relationships:');
    const allRelationships = await toolExecutor.executeTool(
      "get_relationships",
      userId
    );
    console.log(allRelationships);
    
    // Test inference: "what is the relationship between irina and me?"
    console.log('\nInferring relationship between irina and me:');
    const inferredRelationship = await toolExecutor.executeTool(
      "infer_relationship",
      `${userId}:me:irina`
    );
    console.log(inferredRelationship);
    
    // The expected result should contain "brother-in-law's wife"
    if (inferredRelationship.includes("brother-in-law's wife")) {
      console.log('\n✅ TEST PASSED: Correctly inferred relationship');
    } else {
      console.log('\n❌ TEST FAILED: Incorrect relationship inference');
      console.log('Expected: "brother-in-law\'s wife"');
      console.log('Actual:', inferredRelationship);
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the test as an immediately invoked async function
(async () => {
  try {
    await testRelationshipInference();
    console.log('Test completed');
  } catch (err) {
    console.error('Test failed with error:', err);
  }
})();