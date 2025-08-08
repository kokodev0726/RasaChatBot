// Script to seed psychology questions

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Predefined questions from psychology.config.ts
const questionCategories = {
  "initial_assessment": [
    "¿Qué te trajo a la consulta hoy?",
    "¿Puedes contarme un poco sobre tu vida antes de que comenzaras a sentirte como te sientes ahora?",
    "¿Cuáles son los principales problemas que estás enfrentando actualmente?"
  ],
  "coping_mechanisms": [
    "¿Cómo has estado manejando el estrés o las dificultades en tu vida?",
    "¿Cómo sueles reaccionar cuando te enfrentas a situaciones difíciles o conflictivas?",
    "¿Qué emociones sueles experimentar con más frecuencia? ¿Cómo las manejas?"
  ],
  "social_support": [
    "¿Tienes algún apoyo social (amigos, familia, pareja) para manejar tus problemas?",
    "¿Cómo describirías tu relación con tu familia?",
    "¿Cómo ha cambiado tu relación con los demás desde que comenzamos a trabajar juntos?"
  ],
  "past_experiences": [
    "¿Has tenido experiencias pasadas que crees que podrían estar afectando tu bienestar hoy?",
    "¿Tienes antecedentes familiares de problemas de salud mental?"
  ],
  "emotional_wellbeing": [
    "¿Cuánto te afectan las emociones que experimentas día a día?",
    "¿En qué situaciones sientes más ansiedad o estrés?",
    "¿Tienes pensamientos recurrentes que te resultan difíciles de controlar?"
  ],
  "goals_and_motivation": [
    "¿Tienes alguna meta específica que te gustaría alcanzar con la terapia?",
    "¿Qué cosas te motivan a seguir adelante, incluso en los momentos difíciles?"
  ],
  "self_awareness": [
    "¿Has notado algún patrón en tus pensamientos o comportamientos que crees que afecta tu bienestar?",
    "¿Qué actividades o relaciones te hacen sentir más conectado contigo mismo/a?",
    "¿Te resulta difícil perdonarte a ti mismo/a o a los demás? ¿Por qué?",
    "¿Cómo te has sentido en cuanto a tu autoimagen o autoestima?"
  ]
};

async function seedPsychologyQuestions() {
  try {
    console.log('Seeding psychology questions...');
    
    // Check for existing questions
    const existingQuestions = await db.execute(sql`
      SELECT question FROM psychology_questions
    `);
    
    const existingQuestionTexts = existingQuestions.rows.map(row => row.question);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    // Seed predefined questions
    for (const [category, questions] of Object.entries(questionCategories)) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        // Skip if question already exists
        if (existingQuestionTexts.includes(question)) {
          console.log(`Skipping existing question: ${question.substring(0, 50)}...`);
          skippedCount++;
          continue;
        }
        
        // Add the question
        await db.execute(sql`
          INSERT INTO psychology_questions (question, category, is_active, order_index)
          VALUES (${question}, ${category}, true, ${i})
        `);
        
        console.log(`Added question: ${question.substring(0, 50)}...`);
        addedCount++;
      }
    }
    
    console.log(`\nSeeding completed!`);
    console.log(`Added: ${addedCount} questions`);
    console.log(`Skipped: ${skippedCount} existing questions`);
    
  } catch (error) {
    console.error('Error seeding psychology questions:', error);
  } finally {
    await pool.end();
  }
}

// Run the seeding
seedPsychologyQuestions()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
