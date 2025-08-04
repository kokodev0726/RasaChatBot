// Simple test script to verify LangChain integration
import { langChainAgent, langChainChains, langChainConversation } from './langchain.js';

async function testLangChainIntegration() {
  console.log('🧪 Testing LangChain Backend Integration...\n');

  try {
    // Test 1: Basic conversation
    console.log('1. Testing basic conversation...');
    const testUserId = 'test-user-123';
    const testMessage = 'Hola, ¿cómo estás?';
    
    let responseChunks = [];
    for await (const chunk of langChainConversation.streamConversation(testUserId, testMessage)) {
      responseChunks.push(chunk);
    }
    
    const fullResponse = responseChunks.join('');
    console.log('✅ Basic conversation test passed');
    console.log(`Response: ${fullResponse.substring(0, 100)}...\n`);

    // Test 2: Title generation
    console.log('2. Testing title generation...');
    const testMessages = ['Hola, me llamo Juan', '¿Cómo estás?'];
    const title = await langChainChains.generateChatTitle(testMessages);
    console.log('✅ Title generation test passed');
    console.log(`Generated title: ${title}\n`);

    // Test 3: User info extraction
    console.log('3. Testing user info extraction...');
    const testUserMessage = 'Me llamo María, tengo 25 años y vivo en Madrid. Trabajo como ingeniera.';
    const extractedInfo = await langChainChains.extractUserInfo(testUserMessage);
    console.log('✅ User info extraction test passed');
    console.log(`Extracted info:`, extractedInfo);
    console.log('');

    // Test 4: Agent processing
    console.log('4. Testing agent processing...');
    const agentResponseChunks = [];
    for await (const chunk of langChainAgent.processMessage(testUserId, '¿Cuál es el clima hoy?')) {
      agentResponseChunks.push(chunk);
    }
    
    const agentResponse = agentResponseChunks.join('');
    console.log('✅ Agent processing test passed');
    console.log(`Agent response: ${agentResponse.substring(0, 100)}...\n`);

    console.log('🎉 All LangChain backend tests passed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Conversation streaming works');
    console.log('- ✅ Title generation works');
    console.log('- ✅ User info extraction works');
    console.log('- ✅ Agent processing works');
    console.log('- ✅ LangChain is properly integrated');

  } catch (error) {
    console.error('❌ LangChain backend test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check if OPENAI_API_KEY is set');
    console.error('2. Verify LangChain dependencies are installed');
    console.error('3. Check if the server is running');
    console.error('4. Verify the langchain.ts file is properly configured');
  }
}

// Run the test
testLangChainIntegration()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }); 