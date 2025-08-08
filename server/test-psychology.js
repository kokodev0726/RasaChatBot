import { PsychologyAgent } from './psychology.js';

async function testPsychologyAgent() {
  console.log('Testing Psychology Agent...');
  
  const agent = new PsychologyAgent();
  
  // Test predefined questions
  console.log('\n=== Predefined Questions ===');
  const allQuestions = agent.getAllPredefinedQuestions();
  console.log(`Total predefined questions: ${allQuestions.length}`);
  console.log('First 3 questions:');
  allQuestions.slice(0, 3).forEach((q, i) => {
    console.log(`${i + 1}. ${q}`);
  });
  
  // Test question categories
  console.log('\n=== Question Categories ===');
  const categories = [
    'initial_assessment',
    'coping_mechanisms',
    'social_support',
    'past_experiences',
    'emotional_wellbeing',
    'goals_and_motivation',
    'self_awareness'
  ];
  
  categories.forEach(category => {
    const questions = agent.getQuestionsByCategory(category);
    console.log(`${category}: ${questions.length} questions`);
  });
  
  // Test session management
  console.log('\n=== Session Management ===');
  const testUserId = 'test-user-123';
  
  // Get initial stats
  const initialStats = agent.getSessionStats(testUserId);
  console.log('Initial stats:', initialStats);
  
  // Test message processing
  console.log('\n=== Message Processing ===');
  const testMessage = "Hola, me siento un poco ansioso últimamente";
  
  console.log('Processing message:', testMessage);
  const responseStream = agent.processMessage(testUserId, testMessage);
  
  let fullResponse = '';
  for await (const chunk of responseStream) {
    fullResponse += chunk;
    process.stdout.write(chunk);
  }
  
  console.log('\n\n=== Updated Stats ===');
  const updatedStats = agent.getSessionStats(testUserId);
  console.log('Updated stats:', updatedStats);
  
  // Test reset
  console.log('\n=== Testing Reset ===');
  agent.resetSession(testUserId);
  const resetStats = agent.getSessionStats(testUserId);
  console.log('Stats after reset:', resetStats);
  
  console.log('\n✅ Psychology Agent test completed successfully!');
}

testPsychologyAgent().catch(console.error);
