# LangChain Integration for Rasa ChatBot

This document describes the LangChain integration added to your Rasa chatbot project.

## Overview

The LangChain integration provides advanced AI capabilities including:
- **Conversation Chains** with memory management
- **Agents** for complex reasoning
- **Tools** for specific tasks
- **Vector Stores** for semantic search
- **Sequential Chains** for multi-step processing

## Architecture

### Core Components

1. **LangChain Service** (`server/langchain.ts`)
   - Conversation management with memory
   - Agent implementation
   - Chain orchestration
   - Vector store operations

2. **Configuration** (`server/langchain.config.ts`)
   - Centralized configuration
   - Environment variable support
   - Prompt templates

3. **Tools** (`server/langchain.tools.ts`)
   - User context management
   - Conversation search
   - Sentiment analysis
   - Language detection
   - Summary generation

## API Endpoints

### LangChain Streaming
```http
POST /api/langchain/stream
Content-Type: application/json

{
  "message": "User message",
  "chatId": 123,
  "useAgent": true
}
```

### Title Generation
```http
POST /api/langchain/title
Content-Type: application/json

{
  "messages": ["Message 1", "Message 2"]
}
```

### User Info Extraction
```http
POST /api/langchain/extract-info
Content-Type: application/json

{
  "message": "User message with personal info"
}
```

### Tools Management
```http
GET /api/langchain/tools
```

```http
POST /api/langchain/tools/execute
Content-Type: application/json

{
  "toolName": "get_user_context",
  "input": "user_id"
}
```

## Available Tools

### 1. User Context Tools
- `get_user_context`: Retrieve stored user information
- `set_user_context`: Store user information

### 2. Conversation Tools
- `search_similar_conversations`: Find similar past conversations
- `get_chat_history`: Retrieve chat history

### 3. Analysis Tools
- `generate_summary`: Create conversation summaries
- `language_detection`: Detect and translate languages
- `sentiment_analysis`: Analyze message sentiment

## Configuration

### Environment Variables

```bash
# LangChain Configuration
LANGCHAIN_MODEL_NAME=gpt-4o
LANGCHAIN_TEMPERATURE=0.7
LANGCHAIN_MAX_TOKENS=2000
LANGCHAIN_SIMILARITY_SEARCH_K=5
```

### Configuration File

The `server/langchain.config.ts` file contains all configurable settings:

```typescript
export const langChainConfig: LangChainConfig = {
  modelName: "gpt-4o",
  temperature: 0.7,
  maxTokens: 2000,
  memoryKey: "history",
  returnMessages: true,
  similaritySearchK: 5,
  enableAgent: true,
  enableMemory: true,
  enableVectorStore: true,
  // ... prompt templates
};
```

## Usage Examples

### 1. Basic Conversation with Memory

```typescript
import { langChainConversation } from './server/langchain';

// Stream conversation with memory
const stream = langChainConversation.streamConversation(userId, message);
for await (const chunk of stream) {
  console.log(chunk);
}
```

### 2. Using the Agent

```typescript
import { langChainAgent } from './server/langchain';

// Process message with agent (includes context search and user info extraction)
const stream = langChainAgent.processMessage(userId, message, chatId);
for await (const chunk of stream) {
  console.log(chunk);
}
```

### 3. Using Tools

```typescript
import { toolExecutor } from './server/langchain.tools';

// Execute a tool
const result = await toolExecutor.executeTool('get_user_context', userId);
console.log(result);

// Get available tools
const tools = toolExecutor.getAvailableTools();
console.log(tools);
```

### 4. Generating Titles

```typescript
import { langChainChains } from './server/langchain';

const title = await langChainChains.generateChatTitle(['Hello', 'How are you?']);
console.log(title); // "Greeting and well-being inquiry"
```

## Integration with Existing System

The LangChain integration works alongside your existing OpenAI implementation:

1. **Parallel Operation**: Both systems can be used simultaneously
2. **Shared Storage**: Uses the same database for embeddings and user context
3. **Compatible APIs**: Similar response formats for easy switching
4. **Enhanced Features**: LangChain provides additional capabilities

## Features

### Memory Management
- Per-user conversation memory
- Automatic context retrieval
- Memory clearing capabilities

### Semantic Search
- Similar conversation retrieval
- Context-aware responses
- Embedding-based search

### User Information Extraction
- Automatic personal info detection
- Context storage and retrieval
- Natural language processing

### Advanced Chains
- Sequential processing
- Multi-step reasoning
- Conditional logic

### Tool Integration
- Extensible tool system
- Custom tool creation
- Tool execution management

## Benefits

1. **Enhanced Context Awareness**: Better understanding of user history
2. **Improved Personalization**: User-specific responses
3. **Advanced Reasoning**: Complex multi-step processing
4. **Extensibility**: Easy to add new tools and capabilities
5. **Memory Management**: Persistent conversation context
6. **Semantic Search**: Relevant past conversation retrieval

## Migration Guide

### From OpenAI to LangChain

1. **Update API calls**:
   ```typescript
   // Old OpenAI streaming
   const stream = streamChatCompletion(messages, userId);
   
   // New LangChain streaming
   const stream = langChainAgent.processMessage(userId, message, chatId);
   ```

2. **Add LangChain routes**:
   ```typescript
   // Use LangChain endpoints
   POST /api/langchain/stream
   POST /api/langchain/title
   POST /api/langchain/extract-info
   ```

3. **Configure environment**:
   ```bash
   # Add LangChain configuration
   LANGCHAIN_MODEL_NAME=gpt-4o
   LANGCHAIN_TEMPERATURE=0.7
   ```

## Troubleshooting

### Common Issues

1. **Memory not persisting**: Check user ID consistency
2. **Tools not working**: Verify tool registration
3. **Slow responses**: Adjust model parameters
4. **Context not found**: Check embedding storage

### Debug Mode

Enable debug logging by setting environment variables:
```bash
DEBUG=langchain:*
```

## Performance Considerations

1. **Memory Usage**: LangChain maintains conversation memory
2. **Response Time**: Agent processing may be slower than direct OpenAI calls
3. **Token Usage**: Additional context may increase token consumption
4. **Storage**: Vector embeddings require additional storage

## Security

1. **User Isolation**: Memory and context are user-specific
2. **Input Validation**: All inputs are validated
3. **Error Handling**: Comprehensive error handling
4. **Authentication**: All endpoints require authentication

## Future Enhancements

1. **Custom Tools**: Add domain-specific tools
2. **Advanced Agents**: Implement more sophisticated agents
3. **Multi-modal Support**: Add image and audio processing
4. **External Integrations**: Connect to external APIs
5. **Analytics**: Add conversation analytics
6. **A/B Testing**: Compare different chain configurations 