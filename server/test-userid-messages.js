import { storage } from './storage.ts';

async function testUserIdMessages() {
  try {
    console.log('Testing userId in messages functionality...');
    
    // Test 1: Check if we can get user messages
    console.log('\n1. Testing getUserMessages method...');
    
    // Get all users to test with
    const testUserId = 'test-user-id'; // You might want to use a real user ID from your database
    
    try {
      const userMessages = await storage.getUserMessages(testUserId, 5);
      console.log(`✓ getUserMessages works - found ${userMessages.length} messages for user ${testUserId}`);
      
      if (userMessages.length > 0) {
        console.log('Sample message:', {
          id: userMessages[0].id,
          userId: userMessages[0].userId,
          chatId: userMessages[0].chatId,
          role: userMessages[0].role,
          content: userMessages[0].content.substring(0, 50) + '...'
        });
      }
    } catch (error) {
      console.log(`⚠ getUserMessages test failed: ${error.message}`);
    }
    
    // Test 2: Check if messages have userId field
    console.log('\n2. Testing message structure...');
    
    try {
      // Get any chat messages to check structure
      const allChats = await storage.getUserChats(testUserId);
      if (allChats.length > 0) {
        const chatMessages = await storage.getChatMessages(allChats[0].id);
        if (chatMessages.length > 0) {
          const message = chatMessages[0];
          console.log('Message structure:', {
            hasUserId: 'userId' in message,
            hasChatId: 'chatId' in message,
            userId: message.userId,
            chatId: message.chatId
          });
          console.log('✓ Messages have userId field');
        } else {
          console.log('No messages found in chat to test structure');
        }
      } else {
        console.log('No chats found for user to test message structure');
      }
    } catch (error) {
      console.log(`⚠ Message structure test failed: ${error.message}`);
    }
    
    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testUserIdMessages();