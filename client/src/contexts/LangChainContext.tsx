import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LangChainService, LangChainConfig, defaultLangChainConfig, LangChainContextType } from '@/lib/langchainService';

const LangChainContext = createContext<LangChainContextType | undefined>(undefined);

interface LangChainProviderProps {
  children: ReactNode;
}

export function LangChainProvider({ children }: LangChainProviderProps) {
  const [config, setConfig] = useState<LangChainConfig>(defaultLangChainConfig);
  const [isConnected, setIsConnected] = useState(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [toolDescriptions, setToolDescriptions] = useState<Record<string, string>>({});

  // Load config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('langchain-config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig({ ...defaultLangChainConfig, ...parsedConfig });
      } catch (error) {
        console.error('Error loading LangChain config:', error);
      }
    }
  }, []);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem('langchain-config', JSON.stringify(config));
  }, [config]);

  // Check LangChain connection and load tools
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('Checking LangChain connection...');
        const connected = await LangChainService.testConnection();
        console.log('Connection result:', connected);
        setIsConnected(connected);

        if (connected) {
          console.log('Loading available tools...');
          const tools = await LangChainService.getAvailableTools();
          console.log('Tools loaded:', tools);
          setAvailableTools(tools.availableTools || []);
          setToolDescriptions(tools.toolDescriptions || {});
        } else {
          console.log('LangChain not connected, clearing tools');
          setAvailableTools([]);
          setToolDescriptions({});
        }
      } catch (error) {
        console.error('Error checking LangChain connection:', error);
        setIsConnected(false);
        setAvailableTools([]);
        setToolDescriptions({});
      }
    };

    checkConnection();
  }, []);

  const updateConfig = (newConfig: Partial<LangChainConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const value: LangChainContextType = {
    config,
    updateConfig,
    isConnected,
    availableTools,
    toolDescriptions,
  };

  return (
    <LangChainContext.Provider value={value}>
      {children}
    </LangChainContext.Provider>
  );
}

export function useLangChain() {
  const context = useContext(LangChainContext);
  if (context === undefined) {
    throw new Error('useLangChain must be used within a LangChainProvider');
  }
  return context;
} 