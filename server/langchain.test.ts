import { langChainAgent, langChainConversation, langChainChains } from './langchain';
import { toolExecutor } from './langchain.tools';

// Simple test functions for LangChain integration
export async function testLangChainIntegration() {
  console.log('🧪 Testing LangChain Integration...');

  try {
    // Test 1: Basic conversation
    console.log('\n1. Testing basic conversation...');
    const testUserId = 'test-user-123';
    const testMessage = 'Hola, ¿cómo estás?';
    
    let responseChunks: string[] = [];
    for await (const chunk of langChainConversation.streamConversation(testUserId, testMessage)) {
      responseChunks.push(chunk);
    }
    
    const fullResponse = responseChunks.join('');
    console.log('✅ Basic conversation test passed');
    console.log(`Response: ${fullResponse.substring(0, 100)}...`);

    // Test 2: Title generation
    console.log('\n2. Testing title generation...');
    const testMessages = ['Hola, me llamo Juan', '¿Cómo estás?'];
    const title = await langChainChains.generateChatTitle(testMessages);
    console.log('✅ Title generation test passed');
    console.log(`Generated title: ${title}`);

    // Test 3: User info extraction
    console.log('\n3. Testing user info extraction...');
    const testUserMessage = 'Me llamo María, tengo 25 años y vivo en Madrid. Trabajo como ingeniera.';
    const extractedInfo = await langChainChains.extractUserInfo(testUserMessage);
    console.log('✅ User info extraction test passed');
    console.log(`Extracted info:`, extractedInfo);

    // Test 4: Tools availability
    console.log('\n4. Testing tools availability...');
    const availableTools = toolExecutor.getAvailableTools();
    const toolDescriptions = toolExecutor.getToolDescriptions();
    console.log('✅ Tools availability test passed');
    console.log(`Available tools: ${availableTools.length}`);
    console.log('Tool descriptions:', Object.keys(toolDescriptions));

    // Test 5: Agent processing
    console.log('\n5. Testing agent processing...');
    const agentResponseChunks: string[] = [];
    for await (const chunk of langChainAgent.processMessage(testUserId, '¿Cuál es el clima hoy?')) {
      agentResponseChunks.push(chunk);
    }
    
    const agentResponse = agentResponseChunks.join('');
    console.log('✅ Agent processing test passed');
    console.log(`Agent response: ${agentResponse.substring(0, 100)}...`);

    console.log('\n🎉 All LangChain integration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ LangChain integration test failed:', error);
    return false;
  }
}

// Test specific tools
export async function testLangChainTools() {
  console.log('\n🔧 Testing LangChain Tools...');

  try {
    // Test user context tool
    console.log('\n1. Testing user context tool...');
    const contextResult = await toolExecutor.executeTool('get_user_context', 'test-user-123');
    console.log('✅ User context tool test passed');
    console.log(`Context result: ${contextResult}`);

    // Test summary tool
    console.log('\n2. Testing summary tool...');
    const summaryResult = await toolExecutor.executeTool('generate_summary', 'Esta es una conversación de prueba para verificar que el sistema funciona correctamente.');
    console.log('✅ Summary tool test passed');
    console.log(`Summary: ${summaryResult}`);

    // Test sentiment analysis tool
    console.log('\n3. Testing sentiment analysis tool...');
    const sentimentResult = await toolExecutor.executeTool('sentiment_analysis', 'Estoy muy feliz de usar este chatbot!');
    console.log('✅ Sentiment analysis tool test passed');
    console.log(`Sentiment: ${sentimentResult}`);

    console.log('\n🎉 All LangChain tools tests passed!');
    return true;

  } catch (error) {
    console.error('❌ LangChain tools test failed:', error);
    return false;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLangChainIntegration()
    .then(() => testLangChainTools())
    .then(() => {
      console.log('\n✅ All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
} 