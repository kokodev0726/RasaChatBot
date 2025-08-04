import { apiRequest } from './queryClient';

export interface LangChainStreamResponse {
  message: string;
  chatId?: number;
  useAgent?: boolean;
}

export interface LangChainTitleResponse {
  messages: string[];
}

export interface LangChainExtractInfoResponse {
  message: string;
}

export interface LangChainToolResponse {
  toolName: string;
  input: string;
}

export interface LangChainToolsResponse {
  availableTools: string[];
  toolDescriptions: Record<string, string>;
}

export class LangChainService {
  private static async streamResponse(
    url: string,
    data: any,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          onChunk(chunk);
        }
      }

      onComplete(fullResponse);
    } catch (error) {
      onError(error as Error);
    }
  }

  // Stream conversation with LangChain
  static async streamConversation(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void,
    chatId?: number,
    useAgent: boolean = true
  ) {
    const data: LangChainStreamResponse = {
      message,
      useAgent,
    };

    if (chatId) {
      data.chatId = chatId;
    }

    await this.streamResponse(
      '/api/langchain/stream',
      data,
      onChunk,
      onComplete,
      onError
    );
  }

  // Generate chat title with LangChain
  static async generateTitle(messages: string[]): Promise<string> {
    const response = await apiRequest('POST', '/api/langchain/title', {
      messages,
    });
    
    const data = await response.json();
    return data.title;
  }

  // Extract user information with LangChain
  static async extractUserInfo(message: string): Promise<Record<string, string>> {
    const response = await apiRequest('POST', '/api/langchain/extract-info', {
      message,
    });
    
    const data = await response.json();
    return data.extractedInfo;
  }

  // Get available LangChain tools
  static async getAvailableTools(): Promise<LangChainToolsResponse> {
    const response = await apiRequest('GET', '/api/langchain/tools');
    return await response.json();
  }

  // Execute a LangChain tool
  static async executeTool(toolName: string, input: string): Promise<string> {
    const response = await apiRequest('POST', '/api/langchain/tools/execute', {
      toolName,
      input,
    });
    
    const data = await response.json();
    return data.result;
  }

  // Test LangChain connection
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/langchain/tools', {
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// LangChain configuration
export interface LangChainConfig {
  enabled: boolean;
  useAgent: boolean;
  autoExtractInfo: boolean;
  enableTools: boolean;
}

export const defaultLangChainConfig: LangChainConfig = {
  enabled: true,
  useAgent: true,
  autoExtractInfo: true,
  enableTools: true,
};

// LangChain context for React
export interface LangChainContextType {
  config: LangChainConfig;
  updateConfig: (config: Partial<LangChainConfig>) => void;
  isConnected: boolean;
  availableTools: string[];
  toolDescriptions: Record<string, string>;
}

// Utility functions for LangChain
export const langChainUtils = {
  // Check if LangChain is available
  async isAvailable(): Promise<boolean> {
    return await LangChainService.testConnection();
  },

  // Format tool descriptions for display
  formatToolDescription(description: string): string {
    return description.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  // Get tool icon based on name
  getToolIcon(toolName: string): string {
    const iconMap: Record<string, string> = {
      get_user_context: '👤',
      set_user_context: '💾',
      search_similar_conversations: '🔍',
      get_chat_history: '📜',
      generate_summary: '📝',
      language_detection: '🌐',
      sentiment_analysis: '😊',
    };
    
    return iconMap[toolName] || '🔧';
  },
}; 