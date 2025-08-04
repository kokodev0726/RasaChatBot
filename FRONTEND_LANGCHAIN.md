# Frontend LangChain Integration

This document describes the frontend changes made to support LangChain integration.

## Overview

The frontend has been updated to support both OpenAI and LangChain backends, with automatic fallback and user-configurable settings.

## New Components

### 1. LangChain Service (`client/src/lib/langchainService.ts`)
- **LangChainService**: Handles all LangChain API calls
- **Streaming support**: Real-time response streaming
- **Tool management**: Execute and manage LangChain tools
- **Configuration**: Type-safe configuration interface

### 2. LangChain Context (`client/src/contexts/LangChainContext.tsx`)
- **LangChainProvider**: React context provider for LangChain state
- **Configuration management**: Persistent settings in localStorage
- **Connection status**: Real-time connection monitoring
- **Tool discovery**: Automatic tool loading and caching

### 3. LangChain Settings (`client/src/components/LangChainSettings.tsx`)
- **Configuration UI**: User-friendly settings interface
- **Connection status**: Visual connection indicator
- **Tool display**: Shows available tools with descriptions
- **Feature toggles**: Enable/disable specific features

### 4. Settings Page (`client/src/pages/settings.tsx`)
- **Unified settings**: Combines user profile and LangChain settings
- **Responsive design**: Works on mobile and desktop
- **Navigation**: Easy access from sidebar

## Updated Components

### 1. ChatInterface (`client/src/components/ChatInterface.tsx`)
- **Dual backend support**: Uses LangChain when available, falls back to OpenAI
- **Status indicator**: Shows LangChain status in chat header
- **Streaming**: Enhanced streaming with LangChain
- **Error handling**: Graceful fallback on connection issues

### 2. Sidebar (`client/src/components/Sidebar.tsx`)
- **LangChain indicator**: Shows when LangChain is active
- **Settings link**: Direct access to settings page
- **Status display**: Visual connection status

### 3. App (`client/src/App.tsx`)
- **Provider integration**: Includes LangChainProvider
- **Route addition**: Settings page route
- **Context hierarchy**: Proper provider nesting

## Features

### Automatic Fallback
- Uses LangChain when enabled and connected
- Falls back to OpenAI if LangChain is unavailable
- Seamless user experience with no interruption

### Configuration Management
- Persistent settings in localStorage
- Real-time configuration updates
- User-friendly toggle controls

### Connection Monitoring
- Automatic connection status checking
- Visual indicators for connection state
- Graceful error handling

### Tool Integration
- Automatic tool discovery
- Tool execution capabilities
- Visual tool descriptions

## Usage

### Basic Usage
```typescript
import { useLangChain } from '@/contexts/LangChainContext';

function MyComponent() {
  const { config, isConnected, updateConfig } = useLangChain();
  
  // Check if LangChain is available
  if (config.enabled && isConnected) {
    // Use LangChain features
  }
}
```

### Streaming Conversation
```typescript
import { LangChainService } from '@/lib/langchainService';

// Stream with LangChain
LangChainService.streamConversation(
  message,
  (chunk) => console.log(chunk),
  (fullResponse) => console.log('Complete:', fullResponse),
  (error) => console.error(error),
  chatId,
  useAgent
);
```

### Tool Execution
```typescript
// Execute a tool
const result = await LangChainService.executeTool('get_user_context', userId);

// Get available tools
const tools = await LangChainService.getAvailableTools();
```

## Configuration Options

### LangChainConfig Interface
```typescript
interface LangChainConfig {
  enabled: boolean;        // Enable/disable LangChain
  useAgent: boolean;       // Use AI agent for complex reasoning
  autoExtractInfo: boolean; // Auto-extract user information
  enableTools: boolean;    // Enable specialized tools
}
```

### Environment Variables
```bash
# Frontend can detect backend configuration
# No additional environment variables needed for frontend
```

## User Experience

### Settings Access
1. Click the settings icon in the sidebar
2. Navigate to the settings page
3. Configure LangChain options
4. Settings are automatically saved

### Visual Indicators
- **Blue Zap icon**: LangChain is active
- **Green dot**: Connection is established
- **Settings page**: Comprehensive configuration

### Automatic Detection
- Backend connection is automatically detected
- Features are enabled/disabled based on availability
- No manual configuration required

## Error Handling

### Connection Issues
- Automatic fallback to OpenAI
- Visual error indicators
- Graceful degradation

### Configuration Errors
- Default values are used
- User is notified of issues
- Settings are preserved

### Tool Errors
- Individual tool failures don't break the system
- Error messages are user-friendly
- Fallback options are available

## Performance Considerations

### Lazy Loading
- LangChain features are loaded on demand
- Connection checking is non-blocking
- Settings are cached locally

### Streaming Optimization
- Efficient chunk processing
- Memory-conscious streaming
- Real-time UI updates

### Caching
- Tool descriptions are cached
- Configuration is persisted
- Connection status is cached

## Security

### Authentication
- All requests include credentials
- User-specific configurations
- Secure localStorage usage

### Data Privacy
- User information is handled securely
- No sensitive data in localStorage
- Proper error message sanitization

## Future Enhancements

### Planned Features
1. **Advanced tool UI**: Visual tool execution interface
2. **Custom tools**: User-defined tool creation
3. **Analytics**: Usage tracking and insights
4. **A/B testing**: Compare different configurations
5. **Multi-modal support**: Image and audio processing

### Potential Improvements
1. **Offline support**: Cached responses when offline
2. **Progressive enhancement**: Better fallback strategies
3. **Performance monitoring**: Real-time performance metrics
4. **User feedback**: In-app feedback collection

## Troubleshooting

### Common Issues

1. **LangChain not connecting**
   - Check backend server is running
   - Verify API endpoints are accessible
   - Check network connectivity

2. **Settings not saving**
   - Check localStorage is available
   - Verify browser permissions
   - Clear browser cache

3. **Tools not loading**
   - Check backend tool registration
   - Verify API responses
   - Check console for errors

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('langchain-debug', 'true');
```

### Reset Configuration
```typescript
// Reset to defaults
localStorage.removeItem('langchain-config');
```

## Migration Guide

### From OpenAI Only
1. **No changes required**: System works with existing setup
2. **Enable LangChain**: Use settings page to enable
3. **Test features**: Verify tools and agents work
4. **Configure preferences**: Adjust settings as needed

### Adding New Features
1. **Extend service**: Add new methods to LangChainService
2. **Update context**: Add new state to LangChainContext
3. **Create UI**: Add components for new features
4. **Test integration**: Verify end-to-end functionality

## API Reference

### LangChainService Methods
- `streamConversation()`: Stream conversation responses
- `generateTitle()`: Generate chat titles
- `extractUserInfo()`: Extract user information
- `getAvailableTools()`: Get available tools
- `executeTool()`: Execute a specific tool
- `testConnection()`: Test backend connection

### LangChainContext Hooks
- `useLangChain()`: Access LangChain context
- `config`: Current configuration
- `updateConfig()`: Update configuration
- `isConnected`: Connection status
- `availableTools`: Available tools list
- `toolDescriptions`: Tool descriptions

### Configuration Options
- `enabled`: Enable/disable LangChain
- `useAgent`: Use AI agent
- `autoExtractInfo`: Auto-extract user info
- `enableTools`: Enable tools 