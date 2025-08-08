# Psychology Database Integration

This document describes the database integration for the psychology agent, which allows storing and managing psychology questions dynamically.

## Overview

The psychology agent now uses a database to store and manage questions instead of hardcoded questions. This enables:

- Dynamic addition/editing of questions
- User-specific generated questions storage
- Better organization and categorization
- Scalable question management

## Database Schema

### Tables

#### 1. `psychology_questions`
Stores predefined psychology questions that can be used by the agent.

```sql
CREATE TABLE psychology_questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  category VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Indexes:**
- `idx_psychology_questions_category` - For filtering by category
- `idx_psychology_questions_active` - For filtering active questions

#### 2. `user_generated_questions`
Stores personalized questions generated for specific users.

```sql
CREATE TABLE user_generated_questions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  category VARCHAR NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

**Indexes:**
- `idx_user_generated_questions_user_id` - For filtering by user
- `idx_user_generated_questions_category` - For filtering by category
- `idx_user_generated_questions_used` - For filtering unused questions

## API Endpoints

### Psychology Questions Management

#### GET `/api/psychology/questions`
Get all predefined questions or filter by category.

**Query Parameters:**
- `category` (optional) - Filter by category

**Response:**
```json
{
  "questions": [
    "¿Qué te trajo a la consulta hoy?",
    "¿Puedes contarme un poco sobre tu vida antes de que comenzaras a sentirte como te sientes ahora?"
  ]
}
```

#### GET `/api/psychology/questions/all`
Get all psychology questions with full details.

**Response:**
```json
[
  {
    "id": 1,
    "question": "¿Qué te trajo a la consulta hoy?",
    "category": "initial_assessment",
    "isActive": true,
    "orderIndex": 0,
    "createdAt": "2025-01-08T21:00:00.000Z",
    "updatedAt": "2025-01-08T21:00:00.000Z"
  }
]
```

#### POST `/api/psychology/questions`
Add a new psychology question.

**Request Body:**
```json
{
  "question": "¿Cómo te sientes hoy?",
  "category": "emotional_wellbeing",
  "orderIndex": 0
}
```

#### PUT `/api/psychology/questions/:id`
Update an existing psychology question.

**Request Body:**
```json
{
  "question": "Updated question text",
  "category": "emotional_wellbeing",
  "isActive": true,
  "orderIndex": 1
}
```

#### DELETE `/api/psychology/questions/:id`
Delete a psychology question.

### User Generated Questions

#### GET `/api/psychology/user-questions/:userId`
Get all generated questions for a specific user.

**Response:**
```json
[
  {
    "id": 1,
    "userId": "user-123",
    "question": "¿Cómo te sientes hoy?",
    "category": "personalized",
    "isUsed": false,
    "usedAt": null,
    "createdAt": "2025-01-08T21:00:00.000Z"
  }
]
```

## Storage Functions

The `storage.ts` file includes new functions for managing psychology questions:

### Psychology Questions
- `addPsychologyQuestion(question)` - Add a new question
- `getPsychologyQuestions(limit?)` - Get all active questions
- `getPsychologyQuestionsByCategory(category)` - Get questions by category
- `getPsychologyQuestionById(id)` - Get a specific question
- `updatePsychologyQuestion(id, update)` - Update a question
- `deletePsychologyQuestion(id)` - Delete a question

### User Generated Questions
- `addUserGeneratedQuestion(question)` - Add a user-specific question
- `getUserGeneratedQuestions(userId?, limit?)` - Get user questions
- `getUserGeneratedQuestionsByCategory(userId, category)` - Get user questions by category
- `getUnusedUserGeneratedQuestions(userId, limit?)` - Get unused questions
- `markUserGeneratedQuestionAsUsed(id)` - Mark question as used
- `updateUserGeneratedQuestion(id, update)` - Update a user question
- `deleteUserGeneratedQuestion(id)` - Delete a user question

## Psychology Agent Updates

The `PsychologyAgent` class has been updated to:

1. **Load questions from database** - Instead of using hardcoded questions
2. **Store personalized questions** - Generated questions are saved to the database
3. **Track question usage** - Questions are marked as used when asked
4. **Support dynamic question management** - Questions can be added/edited via API

### Key Changes

- `getOrCreateSession()` now loads questions from database
- `getNextPredefinedQuestion()` uses database questions
- `generatePersonalizedQuestion()` stores questions in database
- `determineNextQuestion()` checks for unused personalized questions
- All methods are now async to support database operations

## Migration and Seeding

### Migration
The database tables were created using a manual migration script:
- `drizzle/migrations/add_psychology_questions_tables.sql`
- Applied using `server/apply-psychology-migration.mjs`

### Seeding
Predefined questions were seeded using:
- `server/seed-psychology-questions.mjs`
- Includes all 20 original questions organized by category

## Testing

A test script `server/test-psychology-db.js` verifies:
1. Psychology questions table exists and has data
2. User generated questions table exists
3. User generated questions can be added and retrieved
4. Foreign key constraints work correctly

## Usage Examples

### Adding a New Question
```javascript
// Via API
const response = await fetch('/api/psychology/questions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: '¿Cómo te sientes hoy?',
    category: 'emotional_wellbeing',
    orderIndex: 0
  })
});

// Via storage
await storage.addPsychologyQuestion({
  question: '¿Cómo te sientes hoy?',
  category: 'emotional_wellbeing',
  isActive: true,
  orderIndex: 0
});
```

### Getting Questions by Category
```javascript
// Via API
const response = await fetch('/api/psychology/questions?category=emotional_wellbeing');
const { questions } = await response.json();

// Via storage
const questions = await storage.getPsychologyQuestionsByCategory('emotional_wellbeing');
```

### Getting User Generated Questions
```javascript
// Via API
const response = await fetch(`/api/psychology/user-questions/${userId}`);
const questions = await response.json();

// Via storage
const questions = await storage.getUserGeneratedQuestions(userId);
```

## Benefits

1. **Dynamic Management** - Questions can be added/edited without code changes
2. **User Personalization** - Generated questions are stored per user
3. **Better Organization** - Questions are categorized and ordered
4. **Scalability** - Database can handle large numbers of questions
5. **Audit Trail** - Question usage and creation is tracked
6. **Flexibility** - Questions can be activated/deactivated

## Future Enhancements

1. **Question Analytics** - Track which questions are most effective
2. **Question Templates** - Support for question templates with variables
3. **Question Scheduling** - Schedule questions for specific times
4. **Question Feedback** - Allow users to rate question effectiveness
5. **Question Import/Export** - Bulk question management
6. **Question Versioning** - Track question changes over time
