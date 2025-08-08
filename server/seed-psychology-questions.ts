import { storage } from './storage';
import { psychologyConfig } from './psychology.config';

async function seedPsychologyQuestions() {
  console.log('Seeding psychology questions...');
  
  try {
    // Get existing questions to avoid duplicates
    const existingQuestions = await storage.getPsychologyQuestions();
    const existingQuestionTexts = existingQuestions.map(q => q.question);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    // Seed predefined questions
    for (const [category, questions] of Object.entries(psychologyConfig.questionCategories)) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        // Skip if question already exists
        if (existingQuestionTexts.includes(question)) {
          console.log(`Skipping existing question: ${question.substring(0, 50)}...`);
          skippedCount++;
          continue;
        }
        
        // Add the question
        await storage.addPsychologyQuestion({
          question,
          category,
          isActive: true,
          orderIndex: i,
        });
        
        console.log(`Added question: ${question.substring(0, 50)}...`);
        addedCount++;
      }
    }
    
    console.log(`\nSeeding completed!`);
    console.log(`Added: ${addedCount} questions`);
    console.log(`Skipped: ${skippedCount} existing questions`);
    
  } catch (error) {
    console.error('Error seeding psychology questions:', error);
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedPsychologyQuestions()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedPsychologyQuestions };
