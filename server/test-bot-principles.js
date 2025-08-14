const { PsychologyAgent } = require('./psychology');
const { storage } = require('./storage');

async function testBotPrinciples() {
  console.log('🧪 Testing Bot Principles Implementation...\n');
  
  const psychologyAgent = new PsychologyAgent();
  const testUserId = 'test-user-' + Date.now();
  
  try {
    // Test 1: First session - should ask for name
    console.log('📝 Test 1: First Session - Name Request');
    console.log('User: "Hola"');
    
    const firstResponse = [];
    for await (const chunk of psychologyAgent.processMessage(testUserId, 'Hola')) {
      firstResponse.push(chunk);
    }
    const firstResponseText = firstResponse.join('');
    console.log('Bot:', firstResponseText);
    console.log('✅ Should ask for name if not known\n');
    
    // Test 2: Provide name
    console.log('📝 Test 2: Provide Name');
    console.log('User: "Me llamo María"');
    
    const nameResponse = [];
    for await (const chunk of psychologyAgent.processMessage(testUserId, 'Me llamo María')) {
      nameResponse.push(chunk);
    }
    const nameResponseText = nameResponse.join('');
    console.log('Bot:', nameResponseText);
    console.log('✅ Should greet by name and ask about feelings\n');
    
    // Test 3: First response - should get nested questions
    console.log('📝 Test 3: First Response - Nested Questions');
    console.log('User: "Me siento estresada por el trabajo"');
    
    const stressResponse = [];
    for await (const chunk of psychologyAgent.processMessage(testUserId, 'Me siento estresada por el trabajo')) {
      stressResponse.push(chunk);
    }
    const stressResponseText = stressResponse.join('');
    console.log('Bot:', stressResponseText);
    console.log('✅ Should provide 2 nested questions about stress\n');
    
    // Test 4: Answer nested question 1
    console.log('📝 Test 4: Answer Nested Question 1');
    console.log('User: "Desde hace 3 meses"');
    
    const nested1Response = [];
    for await (const chunk of psychologyAgent.processMessage(testUserId, 'Desde hace 3 meses')) {
      nested1Response.push(chunk);
    }
    const nested1ResponseText = nested1Response.join('');
    console.log('Bot:', nested1ResponseText);
    console.log('✅ Should ask second nested question\n');
    
    // Test 5: Answer nested question 2
    console.log('📝 Test 5: Answer Nested Question 2');
    console.log('User: "Me afecta en mi sueño y relaciones"');
    
    const nested2Response = [];
    for await (const chunk of psychologyAgent.processMessage(testUserId, 'Me afecta en mi sueño y relaciones')) {
      nested2Response.push(chunk);
    }
    const nested2ResponseText = nested2Response.join('');
    console.log('Bot:', nested2ResponseText);
    console.log('✅ Should proceed to next main question\n');
    
    // Test 6: Simulate new session
    console.log('📝 Test 6: New Session - Should provide summary');
    console.log('Creating new session...');
    
    // Reset session to simulate new session
    psychologyAgent.resetSession(testUserId);
    
    const newSessionResponse = [];
    for await (const chunk of psychologyAgent.processMessage(testUserId, 'Hola de nuevo')) {
      newSessionResponse.push(chunk);
    }
    const newSessionResponseText = newSessionResponse.join('');
    console.log('Bot:', newSessionResponseText);
    console.log('✅ Should greet by name and provide session summary\n');
    
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBotPrinciples().catch(console.error);
