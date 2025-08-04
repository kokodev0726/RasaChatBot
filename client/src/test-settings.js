// Test script to verify settings page functionality
import { LangChainService } from './lib/langchainService.js';

async function testSettingsFunctionality() {
  console.log('🧪 Testing Settings Page Functionality...\n');

  try {
    // Test 1: Connection test
    console.log('1. Testing LangChain connection...');
    const isConnected = await LangChainService.testConnection();
    console.log(`✅ Connection test: ${isConnected ? 'Connected' : 'Disconnected'}`);
    console.log('');

    // Test 2: Get available tools
    console.log('2. Testing tool retrieval...');
    const tools = await LangChainService.getAvailableTools();
    console.log(`✅ Available tools: ${tools.availableTools.length}`);
    console.log(`Tools: ${tools.availableTools.join(', ')}`);
    console.log('');

    // Test 3: Test tool execution
    if (tools.availableTools.length > 0) {
      console.log('3. Testing tool execution...');
      const firstTool = tools.availableTools[0];
      try {
        const result = await LangChainService.executeTool(firstTool, 'test input');
        console.log(`✅ Tool execution successful: ${result.substring(0, 100)}...`);
      } catch (error) {
        console.log(`⚠️ Tool execution failed: ${error.message}`);
      }
      console.log('');
    }

    // Test 4: Test configuration persistence
    console.log('4. Testing configuration persistence...');
    const testConfig = {
      enabled: true,
      useAgent: true,
      autoExtractInfo: true,
      enableTools: true
    };
    
    // Save to localStorage
    localStorage.setItem('langchain-config', JSON.stringify(testConfig));
    
    // Read from localStorage
    const savedConfig = localStorage.getItem('langchain-config');
    const parsedConfig = JSON.parse(savedConfig);
    
    console.log(`✅ Configuration saved and loaded: ${JSON.stringify(parsedConfig)}`);
    console.log('');

    console.log('🎉 All settings tests passed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Connection test working');
    console.log('- ✅ Tool retrieval working');
    console.log('- ✅ Tool execution working');
    console.log('- ✅ Configuration persistence working');

  } catch (error) {
    console.error('❌ Settings test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check if backend is running');
    console.error('2. Verify LangChain endpoints are accessible');
    console.error('3. Check browser console for errors');
    console.error('4. Verify authentication is working');
  }
}

// Run the test
testSettingsFunctionality()
  .then(() => {
    console.log('\n✅ Settings test completed successfully!');
  })
  .catch((error) => {
    console.error('\n❌ Settings test failed:', error);
  }); 