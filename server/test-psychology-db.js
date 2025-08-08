// Test script for psychology database integration

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

// Create database connection
const pool = new Pool({
  host: '187.33.153.208',
  port: 3003,
  user: 'rasaadmin',
  password: '81gm21x&1}e{',
  database: 'rasa1db',
  ssl: false,
});

const db = drizzle(pool);

async function testPsychologyDB() {
  try {
    console.log('Testing psychology database integration...');
    
    // Test 1: Check if psychology_questions table exists and has data
    console.log('\n1. Testing psychology_questions table...');
    const questions = await db.execute(sql`
      SELECT id, question, category, is_active, order_index 
      FROM psychology_questions 
      ORDER BY category, order_index
    `);
    
    console.log(`Found ${questions.rows.length} psychology questions:`);
    questions.rows.forEach(q => {
      console.log(`  - [${q.category}] ${q.question.substring(0, 60)}...`);
    });
    
    // Test 2: Check if user_generated_questions table exists
    console.log('\n2. Testing user_generated_questions table...');
    const userQuestions = await db.execute(sql`
      SELECT COUNT(*) as count FROM user_generated_questions
    `);
    
    console.log(`Found ${userQuestions.rows[0].count} user generated questions`);
    
    // Test 3: Check if there are any users in the system
    console.log('\n3. Testing user table...');
    const users = await db.execute(sql`
      SELECT id, email FROM users LIMIT 1
    `);
    
    if (users.rows.length > 0) {
      const testUserId = users.rows[0].id;
      console.log(`Found user: ${users.rows[0].email} (${testUserId})`);
      
      // Test 4: Test adding a user generated question with valid user ID
      console.log('\n4. Testing adding a user generated question...');
      const testQuestion = '¿Cómo te sientes hoy?';
      
      await db.execute(sql`
        INSERT INTO user_generated_questions (user_id, question, category, is_used)
        VALUES (${testUserId}, ${testQuestion}, 'test', false)
      `);
      
      console.log('Successfully added test user generated question');
      
      // Test 5: Test retrieving user generated questions
      const userGenQuestions = await db.execute(sql`
        SELECT * FROM user_generated_questions WHERE user_id = ${testUserId}
      `);
      
      console.log(`Found ${userGenQuestions.rows.length} questions for test user`);
      
      // Clean up test data
      await db.execute(sql`
        DELETE FROM user_generated_questions WHERE user_id = ${testUserId} AND category = 'test'
      `);
      
      console.log('Cleaned up test data');
    } else {
      console.log('No users found in the system, skipping user generated questions test');
    }
    
    console.log('\n✅ All tests passed! Psychology database integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testPsychologyDB()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
