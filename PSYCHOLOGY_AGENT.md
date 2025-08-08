# Psychology Agent

A specialized AI agent designed for therapeutic conversations, featuring predefined questions and personalized question generation based on user responses.

## Features

### 🧠 Core Functionality
- **Predefined Questions**: 20 carefully crafted psychology questions in Spanish
- **Personalized Questions**: AI-generated questions based on user responses
- **Session Tracking**: Monitor user progress and session statistics
- **Emotion Analysis**: Track emotional patterns in user responses
- **Progress Assessment**: Evaluate user progress over time

### 📋 Predefined Questions

The agent includes 20 predefined questions organized into 7 categories:

#### Initial Assessment
1. ¿Qué te trajo a la consulta hoy?
2. ¿Puedes contarme un poco sobre tu vida antes de que comenzaras a sentirte como te sientes ahora?
3. ¿Cuáles son los principales problemas que estás enfrentando actualmente?

#### Coping Mechanisms
4. ¿Cómo has estado manejando el estrés o las dificultades en tu vida?
5. ¿Cómo sueles reaccionar cuando te enfrentas a situaciones difíciles o conflictivas?
6. ¿Qué emociones sueles experimentar con más frecuencia? ¿Cómo las manejas?

#### Social Support
7. ¿Tienes algún apoyo social (amigos, familia, pareja) para manejar tus problemas?
8. ¿Cómo describirías tu relación con tu familia?
9. ¿Cómo ha cambiado tu relación con los demás desde que comenzamos a trabajar juntos?

#### Past Experiences
10. ¿Has tenido experiencias pasadas que crees que podrían estar afectando tu bienestar hoy?
11. ¿Tienes antecedentes familiares de problemas de salud mental?

#### Emotional Wellbeing
12. ¿Cuánto te afectan las emociones que experimentas día a día?
13. ¿En qué situaciones sientes más ansiedad o estrés?
14. ¿Tienes pensamientos recurrentes que te resultan difíciles de controlar?

#### Goals and Motivation
15. ¿Tienes alguna meta específica que te gustaría alcanzar con la terapia?
16. ¿Qué cosas te motivan a seguir adelante, incluso en los momentos difíciles?

#### Self Awareness
17. ¿Has notado algún patrón en tus pensamientos o comportamientos que crees que afecta tu bienestar?
18. ¿Qué actividades o relaciones te hacen sentir más conectado contigo mismo/a?
19. ¿Te resulta difícil perdonarte a ti mismo/a o a los demás? ¿Por qué?
20. ¿Cómo te has sentido en cuanto a tu autoimagen o autoestima?

## API Endpoints

### Psychology Chat
- **POST** `/api/psychology/stream` - Stream psychology agent responses
- **GET** `/api/psychology/stats/:userId` - Get session statistics
- **DELETE** `/api/psychology/session/:userId` - Reset psychology session
- **GET** `/api/psychology/questions` - Get predefined questions
- **GET** `/api/psychology/categories` - Get question categories

### Request/Response Examples

#### Stream Psychology Response
```bash
POST /api/psychology/stream
Content-Type: application/json

{
  "message": "Hola, me siento un poco ansioso últimamente",
  "chatId": 123
}
```

#### Get Session Statistics
```bash
GET /api/psychology/stats/user-123
```

Response:
```json
{
  "totalQuestions": 5,
  "totalResponses": 4,
  "sessionDuration": 15.5
}
```

#### Get Predefined Questions
```bash
GET /api/psychology/questions?category=initial_assessment
```

Response:
```json
{
  "questions": [
    "¿Qué te trajo a la consulta hoy?",
    "¿Puedes contarme un poco sobre tu vida antes de que comenzaras a sentirte como te sientes ahora?",
    "¿Cuáles son los principales problemas que estás enfrentando actualmente?"
  ]
}
```

## Frontend Integration

### Psychology Chat Component
The `PsychologyChat` component provides a specialized interface for psychology sessions:

- **Brain Icon**: Visual indicator for psychology mode
- **Session Statistics**: Track questions asked, responses given, and session duration
- **Reset Functionality**: Clear session data and start fresh
- **Streaming Responses**: Real-time AI responses with typing indicators

### Navigation
Access the psychology agent via the brain icon in the sidebar navigation.

## Configuration

### Environment Variables
```env
PSYCHOLOGY_MODEL_NAME=gpt-4o
PSYCHOLOGY_TEMPERATURE=0.7
PSYCHOLOGY_MAX_TOKENS=2000
```

### Psychology Configuration
The agent uses a specialized configuration in `server/psychology.config.ts`:

- **Model Settings**: Optimized for therapeutic conversations
- **Question Categories**: Organized by therapeutic focus areas
- **Prompt Templates**: Psychology-specific system prompts
- **Personalization**: Context-aware question generation

## Session Management

### User Sessions
Each user has a dedicated session that tracks:
- Current question index
- Asked questions history
- User responses with timestamps
- Session duration
- Personalized questions generated

### Session Statistics
- **Total Questions**: Number of questions asked by the agent
- **Total Responses**: Number of responses from the user
- **Session Duration**: Time elapsed since session start
- **Emotions Tracked**: Emotional patterns identified

## Question Generation Logic

### Predefined Questions Flow
1. Agent starts with predefined questions in order
2. After all predefined questions, generates personalized questions
3. Continues with follow-up questions based on user responses

### Personalized Questions
The agent generates personalized questions based on:
- Recent user responses (last 3-5 responses)
- Emotional content analysis
- Topic patterns and themes
- User's specific situation and needs

### Follow-up Questions
When no more predefined or personalized questions are available, the agent generates contextual follow-up questions based on the conversation history.

## Safety and Ethics

### Therapeutic Guidelines
- **No Medical Advice**: The agent does not provide medical diagnoses or treatment recommendations
- **Crisis Detection**: Identifies potential crisis situations and suggests professional help
- **Confidentiality**: Maintains user privacy and data security
- **Empathetic Responses**: Uses warm, understanding, and professional tone

### Limitations
- Not a replacement for professional therapy
- No emergency crisis intervention
- Limited to conversational support and exploration
- Requires human oversight for serious mental health concerns

## Testing

### Run Psychology Agent Test
```bash
node server/test-psychology.js
```

This test verifies:
- Predefined questions loading
- Question categorization
- Session management
- Message processing
- Statistics tracking
- Session reset functionality

## Development

### Adding New Questions
1. Add questions to `server/psychology.config.ts`
2. Categorize them appropriately
3. Update the configuration interface if needed

### Customizing Question Generation
Modify the `generatePersonalizedQuestion` method in `server/psychology.ts` to adjust the logic for personalized question generation.

### Extending Functionality
- Add emotion analysis with more sophisticated NLP
- Implement progress tracking with metrics
- Add crisis detection algorithms
- Integrate with external therapy platforms

## Usage Examples

### Starting a Session
1. Navigate to the psychology page via the brain icon
2. The agent will start with the first predefined question
3. Respond naturally to the agent's questions
4. The agent will ask follow-up questions based on your responses

### Monitoring Progress
- Click the "Stats" button to view session statistics
- Track your responses and session duration
- Use the "Reset" button to start a fresh session

### Getting Help
- The agent maintains a therapeutic, supportive tone
- All conversations are confidential
- For serious concerns, always consult with a licensed mental health professional

## Technical Architecture

### Components
- **PsychologyAgent**: Core agent class with session management
- **PsychologyConfig**: Configuration and predefined questions
- **PsychologyChat**: Frontend component for user interaction
- **API Routes**: Backend endpoints for agent functionality

### Data Flow
1. User sends message via frontend
2. Backend processes with psychology agent
3. Agent generates response and next question
4. Response streamed back to frontend
5. Session statistics updated
6. User sees response and next question

### Memory Management
- Session data stored in memory for active sessions
- User responses tracked for personalization
- Conversation history maintained for context
- Session reset clears all user data

This psychology agent provides a safe, supportive environment for users to explore their thoughts and feelings through structured therapeutic conversations.
