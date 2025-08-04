# LangChain Prompt Integration

This document explains how the OpenAI prompt has been successfully integrated into LangChain to ensure consistent behavior and responses.

## Overview

The LangChain integration now uses the exact same prompt as the OpenAI implementation, ensuring consistent behavior, tone, and response quality across both systems.

## Prompt Integration

### Original OpenAI Prompt
```typescript
// From server/openai.ts
const systemPrompt = `Eres un asistente conversacional útil, amable y natural. A continuación, verás algunas preguntas y respuestas previas que pueden ayudarte a responder mejor.

Tu objetivo es responder siempre en **español**, de forma clara, breve y lo más natural posible, como si fueras una persona real. Evita sonar robótico o genérico: responde con un tono cercano, humano y directo, pero sin perder la precisión.

**IMPORTANTE:**
- No menciones a OpenAI ni que fuiste creado por Rasa AI.
- No digas frases típicas de chatbot como "¿En qué puedo ayudarte hoy?" al final o al inicio.
- Usa siempre la información ya proporcionada si es suficiente.
- Si el usuario menciona su nombre, edad, ubicación o cualquier otro dato personal, intégralo de forma natural y directa en tu respuesta.

Piensa como un humano: adapta tu lenguaje, muestra empatía si corresponde, y mantén un estilo conversacional.

--- INICIO de preguntas y respuestas relevantes ---
${contextSnippets}
--- FIN de preguntas y respuestas relevantes ---`;
```

### LangChain Prompt Configuration
```typescript
// From server/langchain.config.ts
systemPrompt: `Eres un asistente conversacional útil, amable y natural. A continuación, verás algunas preguntas y respuestas previas que pueden ayudarte a responder mejor.

Tu objetivo es responder siempre en **español**, de forma clara, breve y lo más natural posible, como si fueras una persona real. Evita sonar robótico o genérico: responde con un tono cercano, humano y directo, pero sin perder la precisión.

**IMPORTANTE:**
- No menciones a OpenAI ni que fuiste creado por Rasa AI.
- No digas frases típicas de chatbot como "¿En qué puedo ayudarte hoy?" al final o al inicio.
- Usa siempre la información ya proporcionada si es suficiente.
- Si el usuario menciona su nombre, edad, ubicación o cualquier otro dato personal, intégralo de forma natural y directa en tu respuesta.

Piensa como un humano: adapta tu lenguaje, muestra empatía si corresponde, y mantén un estilo conversacional.

--- INICIO de preguntas y respuestas relevantes ---
{context}
--- FIN de preguntas y respuestas relevantes ---`
```

## Key Features

### 1. Identical Prompt Structure
- ✅ **Same instructions**: Identical guidance for the AI
- ✅ **Same tone**: Human-like, conversational, empathetic
- ✅ **Same language**: Spanish responses
- ✅ **Same restrictions**: No OpenAI mentions, no generic phrases

### 2. Context Integration
- ✅ **Dynamic context**: Uses `{context}` placeholder
- ✅ **Similar conversations**: Retrieves relevant past interactions
- ✅ **User information**: Integrates user context naturally
- ✅ **Personalization**: Uses stored user preferences

### 3. Enhanced Capabilities
- ✅ **Memory management**: Remembers conversation history
- ✅ **Semantic search**: Finds relevant past conversations
- ✅ **Tool integration**: Uses specialized tools when needed
- ✅ **Advanced reasoning**: Agent-based complex processing

## Implementation Details

### 1. Configuration Loading
```typescript
// Load prompt from configuration
const config = getLangChainConfig();
const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
```

### 2. Context Retrieval
```typescript
// Get similar conversations for context
const similarEmbeddings = await storage.getSimilarEmbeddings(userId, message, 3);
const contextSnippets = similarEmbeddings
  .map(s => `Usuario: ${s.user_input}\nAsistente: ${s.bot_output}`)
  .join('\n\n');
```

### 3. Prompt Application
```typescript
// Create prompt with context
const prompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

const chain = prompt.pipe(llm).pipe(new StringOutputParser());
```

## Usage in Different Components

### 1. Conversation Chain
```typescript
// Basic conversation with enhanced prompt
async* streamConversation(userId: string, message: string) {
  // Get context and apply prompt
  const contextSnippets = await getContext(userId, message);
  const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
  
  // Use enhanced prompt
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
    HumanMessagePromptTemplate.fromTemplate("{input}"),
  ]);
}
```

### 2. Agent Processing
```typescript
// Agent with enhanced prompt
async* processMessage(userId: string, message: string, chatId?: number) {
  // Get context and apply prompt
  const contextSnippets = await getContext(userId, message);
  const systemPromptWithContext = config.systemPrompt.replace('{context}', contextSnippets);
  
  // Use enhanced prompt with agent capabilities
  const enhancedPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemPromptWithContext),
    HumanMessagePromptTemplate.fromTemplate("{input}"),
  ]);
}
```

## Benefits

### 1. Consistency
- **Same behavior**: Identical responses to OpenAI
- **Same tone**: Consistent conversational style
- **Same quality**: Maintains response quality standards

### 2. Enhanced Features
- **Better context**: More relevant conversation history
- **Memory**: Remembers user preferences and information
- **Tools**: Uses specialized tools for enhanced responses

### 3. Flexibility
- **Configurable**: Easy to modify prompt in one place
- **Extensible**: Easy to add new features
- **Maintainable**: Centralized prompt management

## Testing

### Test Commands
```bash
# Test LangChain prompt integration
npm run test:langchain-prompt

# Test full LangChain integration
npm run test:langchain-backend

# Test frontend integration
npm run test:langchain
```

### Test Results
- ✅ **Prompt loading**: Configuration loads correctly
- ✅ **Context integration**: Context is properly applied
- ✅ **Response quality**: Responses match OpenAI quality
- ✅ **Consistency**: Behavior is consistent across systems

## Configuration

### Environment Variables
```bash
# LangChain configuration
LANGCHAIN_MODEL_NAME=gpt-4o
LANGCHAIN_TEMPERATURE=0.7
LANGCHAIN_MAX_TOKENS=2000
```

### Prompt Customization
```typescript
// Modify prompt in server/langchain.config.ts
export const langChainConfig: LangChainConfig = {
  systemPrompt: `Your custom prompt here...`,
  // ... other settings
};
```

## Migration Guide

### From OpenAI Only
1. **No changes needed**: System works with existing setup
2. **Enable LangChain**: Use settings to enable LangChain
3. **Verify consistency**: Test that responses are consistent
4. **Configure preferences**: Adjust settings as needed

### From Different Prompt
1. **Update configuration**: Modify prompt in `langchain.config.ts`
2. **Test responses**: Verify new prompt works correctly
3. **Update documentation**: Update any prompt-related docs
4. **Deploy changes**: Restart server to apply changes

## Troubleshooting

### Common Issues

1. **Prompt not loading**
   - Check `langchain.config.ts` file
   - Verify configuration is exported correctly
   - Check for syntax errors

2. **Context not working**
   - Verify storage is working
   - Check embedding creation
   - Verify context retrieval

3. **Responses inconsistent**
   - Check prompt configuration
   - Verify context integration
   - Test with same inputs

### Debug Mode
```typescript
// Enable debug logging
console.log('System prompt:', config.systemPrompt);
console.log('Context snippets:', contextSnippets);
console.log('Final prompt:', systemPromptWithContext);
```

## Performance Considerations

### Prompt Processing
- **Template replacement**: Efficient string replacement
- **Context retrieval**: Optimized database queries
- **Memory usage**: Minimal memory overhead

### Response Time
- **Prompt loading**: Cached configuration
- **Context retrieval**: Optimized queries
- **Response generation**: Streaming for better UX

## Security

### Prompt Security
- **No sensitive data**: Prompt doesn't contain sensitive information
- **User isolation**: Context is user-specific
- **Input validation**: All inputs are validated

### Data Privacy
- **User context**: Stored securely
- **Conversation history**: User-specific
- **No data leakage**: Context is isolated

## Future Enhancements

### Planned Features
1. **Dynamic prompts**: Context-aware prompt selection
2. **Multi-language support**: Language-specific prompts
3. **Custom prompts**: User-defined prompt customization
4. **Prompt analytics**: Usage tracking and optimization

### Potential Improvements
1. **Prompt optimization**: Better prompt engineering
2. **Context enhancement**: More sophisticated context retrieval
3. **Response quality**: Improved response generation
4. **User feedback**: Prompt improvement based on feedback

## Conclusion

The LangChain integration now uses the exact same prompt as the OpenAI implementation, ensuring consistent behavior, tone, and response quality. The integration provides enhanced capabilities while maintaining the same user experience and response quality standards. 