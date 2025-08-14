# Bot Principles Implementation

## Overview

The psychology chatbot has been updated to follow four core principles that ensure a more human-like, therapeutic conversation experience:

1. **Greetings by name or asking for patient name**
2. **Breaking the ice by summarizing previous sessions**
3. **Coherent, human-like responses with predefined questions**
4. **At least two nested questions before proceeding**

## Principle 1: Greetings by Name

### Implementation
- **File**: `server/psychology.ts` - `handleNewSession()` method
- **Logic**: 
  - Checks if user's name is stored in context
  - If name exists: Greets by name
  - If no name: Asks for name and extracts it from response
  - Uses regex patterns to identify name in responses like "Me llamo X", "Soy X", "Mi nombre es X"

### Code Example
```typescript
if (session.patientName) {
  const greeting = await this.generateSessionGreeting(userId);
  yield greeting;
} else {
  const nameRequest = "¡Hola! Soy tu psicólogo virtual. Antes de comenzar, ¿podrías decirme tu nombre?";
  yield nameRequest;
  
  const nameMatch = message.match(/(?:me llamo|soy|mi nombre es)\s+(\w+)/i);
  if (nameMatch) {
    const name = nameMatch[1];
    await storage.setUserContext(userId, 'name', name);
    session.patientName = name;
  }
}
```

## Principle 2: Session Summaries

### Implementation
- **File**: `server/psychology.ts` - `getPreviousSessionSummary()` method
- **Logic**:
  - Retrieves recent chat history
  - Generates AI-powered summary of previous session
  - Integrates summary into greeting for returning users
  - Asks if user wants to add relevant information

### Code Example
```typescript
private async getPreviousSessionSummary(userId: string): Promise<string | null> {
  const userChats = await storage.getUserChats(userId);
  if (userChats.length < 2) return null;
  
  const recentChat = await storage.getChatWithMessages(userChats[0].id);
  const lastSessionMessages = recentChat.messages
    .slice(-10)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
  
  const summaryPrompt = `Genera un resumen breve (2-3 frases) de la siguiente conversación terapéutica...`;
  const response = await psychologyLLM.invoke(summaryPrompt);
  return response.content as string;
}
```

## Principle 3: Coherent, Human-like Responses

### Implementation
- **File**: `server/psychology.config.ts` - Updated `systemPrompt`
- **Features**:
  - Enhanced system prompt with specific instructions
  - Natural conversation flow
  - Empathetic and professional tone
  - Context-aware responses
  - Integration with LangChain for better understanding

### Key Features
- **Validation**: Brief acknowledgment of user's feelings
- **Reflection**: Paraphrasing what the user shared
- **Natural Language**: Avoids robotic or list-like responses
- **Context Integration**: Uses previous conversations and user context

## Principle 4: Nested Questioning Strategy

### Implementation
- **File**: `server/psychology.ts` - `determineNextQuestion()` and `generateNestedQuestion()` methods
- **Logic**:
  - Tracks current main question and nested question count
  - Ensures at least 2 nested questions before proceeding
  - Generates context-specific follow-up questions
  - Uses AI to create personalized nested questions

### Code Example
```typescript
private async determineNextQuestion(userId: string): Promise<string | null> {
  const session = await this.getOrCreateSession(userId);
  
  // Check if we need to ask nested questions for the current main question
  if (session.currentMainQuestion && session.nestedQuestionCount < 2) {
    const nestedQuestion = await this.generateNestedQuestion(userId, session.currentMainQuestion, session.userResponses[session.userResponses.length - 1]);
    if (nestedQuestion) {
      session.nestedQuestionCount++;
      session.askedQuestions.push(nestedQuestion);
      return nestedQuestion;
    }
  }
  
  // Continue with predefined questions only after nested questions are complete
  if (session.currentQuestionIndex < session.predefinedQuestions.length) {
    return await this.getNextPredefinedQuestion(userId);
  }
}
```

### Nested Question Generation
```typescript
private async generateNestedQuestion(userId: string, mainQuestion: string, lastResponse: any): Promise<string | null> {
  const nestedQuestionPrompt = `Basándote en la pregunta principal y la respuesta del usuario, genera una pregunta de seguimiento específica que profundice en el tema.

Pregunta principal: "${mainQuestion}"
Respuesta del usuario: "${lastResponse.response}"

Genera una pregunta de seguimiento que:
1. Se relacione directamente con lo que el usuario compartió
2. Invite a reflexionar más profundamente
3. Explore emociones, pensamientos o experiencias específicas
4. Sea natural y fluida en la conversación`;
}
```

## Session Management

### Implementation
- **File**: `server/langchain.tools.ts` - `sessionManagementTool`
- **Features**:
  - Tracks session numbers
  - Manages session transitions
  - Stores session-specific data
  - Handles user context across sessions

### Session Flow
1. **First Session**: Asks for name, establishes context
2. **Returning Sessions**: Greets by name, provides summary, asks for updates
3. **Session Tracking**: Increments session number automatically
4. **Context Persistence**: Maintains user information across sessions

## Enhanced User Interface

### Session State Tracking
```typescript
interface UserSession {
  userId: string;
  currentQuestionIndex: number;
  askedQuestions: string[];
  userResponses: Array<{ 
    question: string; 
    response: string; 
    timestamp: Date;
    nestedQuestionsAsked: number;
    nestedQuestionsAnswered: number;
  }>;
  sessionStartTime: Date;
  predefinedQuestions: string[];
  personalizedQuestions: string[];
  hasGreeted: boolean;
  patientName: string | null;
  isNewSession: boolean;
  currentMainQuestion: string | null;
  nestedQuestionCount: number;
  sessionNumber: number;
}
```

## Testing

### Test File
- **File**: `server/test-bot-principles.js`
- **Purpose**: Validates all four principles are working correctly
- **Tests**:
  1. First session name request
  2. Name extraction and greeting
  3. Nested questioning strategy
  4. Session summary generation
  5. Context persistence

### Running Tests
```bash
node server/test-bot-principles.js
```

## Configuration

### System Prompt Updates
The system prompt has been enhanced with:
- **Nested Questioning Strategy**: Clear instructions for 2+ follow-up questions
- **Session Management**: Guidelines for greetings and summaries
- **Response Structure**: Specific format for coherent responses
- **Context Integration**: Better use of previous conversation data

### Key Configuration Changes
- Enhanced system prompt in `psychology.config.ts`
- Added session management tool
- Updated user session interface
- Improved question generation logic

## Benefits

1. **More Human-like**: Natural conversation flow with proper greetings
2. **Better Engagement**: Session summaries help maintain continuity
3. **Deeper Insights**: Nested questions provide more detailed information
4. **Personalized Experience**: Name-based greetings and context awareness
5. **Therapeutic Quality**: Professional yet warm interaction style

## Future Enhancements

1. **Emotion Tracking**: Enhanced sentiment analysis for better responses
2. **Progress Monitoring**: Track therapeutic progress over sessions
3. **Personalized Questions**: More sophisticated question generation
4. **Crisis Detection**: Better identification of urgent situations
5. **Multilingual Support**: Extend beyond Spanish

## Technical Notes

- All changes are backward compatible
- Existing user data is preserved
- Session management is automatic
- Error handling includes fallback responses
- Performance optimized for real-time conversations
