import React from 'react';
import { useLangChain } from '@/contexts/LangChainContext';
import { langChainUtils } from '@/lib/langchainService';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Zap, Brain, Wrench, Info } from 'lucide-react';

export default function LangChainSettings() {
  const { config, updateConfig, isConnected, availableTools, toolDescriptions } = useLangChain();

  const handleToggle = (key: keyof typeof config) => {
    updateConfig({ [key]: !config[key] });
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            LangChain Status
          </CardTitle>
          <CardDescription>
            Manage LangChain integration and AI capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Customize LangChain behavior and features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable LangChain */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Enable LangChain</div>
              <div className="text-xs text-muted-foreground">
                Use LangChain for enhanced AI capabilities
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={() => handleToggle('enabled')}
              disabled={!isConnected}
            />
          </div>

          <Separator />

          {/* Use Agent */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Use AI Agent</div>
              <div className="text-xs text-muted-foreground">
                Enable advanced reasoning and context awareness
              </div>
            </div>
            <Switch
              checked={config.useAgent}
              onCheckedChange={() => handleToggle('useAgent')}
              disabled={!config.enabled || !isConnected}
            />
          </div>

          <Separator />

          {/* Auto Extract Info */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Auto Extract Info</div>
              <div className="text-xs text-muted-foreground">
                Automatically extract user information from messages
              </div>
            </div>
            <Switch
              checked={config.autoExtractInfo}
              onCheckedChange={() => handleToggle('autoExtractInfo')}
              disabled={!config.enabled || !isConnected}
            />
          </div>

          <Separator />

          {/* Enable Tools */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Enable Tools</div>
              <div className="text-xs text-muted-foreground">
                Use specialized tools for enhanced functionality
              </div>
            </div>
            <Switch
              checked={config.enableTools}
              onCheckedChange={() => handleToggle('enableTools')}
              disabled={!config.enabled || !isConnected}
            />
          </div>
        </CardContent>
      </Card>

      {/* Available Tools */}
      {config.enableTools && availableTools.length > 0 && (
        <Card>
          <CardHeader>
                      <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Available Tools
          </CardTitle>
            <CardDescription>
              Specialized tools for enhanced AI capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableTools.map((toolName) => (
                <div
                  key={toolName}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="text-2xl">
                    {langChainUtils.getToolIcon(toolName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {langChainUtils.formatToolDescription(toolName)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {toolDescriptions[toolName]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            About LangChain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            LangChain provides advanced AI capabilities including memory management, 
            semantic search, and specialized tools for enhanced conversation experiences.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>Memory Management</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Semantic Search</span>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              <span>Specialized Tools</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 