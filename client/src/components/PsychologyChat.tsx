import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MessageList from "@/components/MessageList";
import VoiceInput from "@/components/VoiceInput";
import { Send, Brain, BarChart3, RotateCcw, BookOpen } from "lucide-react";
import type { ChatWithMessages, Message } from "@shared/schema";

interface PsychologyStats {
  totalQuestions: number;
  totalResponses: number;
  sessionDuration: number;
}

export default function PsychologyChat() {
  const { chatId } = useParams<{ chatId: string }>();
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [showStats, setShowStats] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: chat, isLoading, error } = useQuery<ChatWithMessages>({
    queryKey: ["/api/chats", chatId],
    enabled: !!chatId,
  });

  const { data: stats } = useQuery<PsychologyStats>({
    queryKey: ["/api/psychology/stats", user?.id],
    enabled: !!user?.id,
  });

  // Handle query errors
  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  // Sync localMessages with chat messages when chat changes
  useEffect(() => {
    if (chat?.messages) {
      setLocalMessages(chat.messages);
      setMessage(""); // Reset input box when switching chats
    }
  }, [chatId, chat?.messages]);

  // Play audio of bot response when a new assistant message is added
  useEffect(() => {
    if (localMessages.length === 0) return;

    const lastMessage = localMessages[localMessages.length - 1];
    if (lastMessage.role === "assistant" && typeof window !== "undefined" && window.speechSynthesis) {
      // Cancel any ongoing speech synthesis
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(lastMessage.content);
      window.speechSynthesis.speak(utterance);
    }
  }, [localMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      if (!chatId) throw new Error("No chat selected");
      
      setIsStreaming(true);
      setStreamingMessage("");
      
      return new Promise<string>(async (resolve, reject) => {
        try {
          const response = await fetch(`/api/psychology/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: messageContent,
              chatId: parseInt(chatId),
            }),
          });

          if (!response.ok) {
            setIsStreaming(false);
            setStreamingMessage("");
            reject(new Error(`HTTP error! status: ${response.status}`));
            return;
          }

        const reader = response.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          setStreamingMessage("");
          reject(new Error("No response body"));
          return;
        }

        let fullResponse = "";

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                setIsStreaming(false);
                setStreamingMessage("");
                resolve(fullResponse);
                break;
              }

              const chunk = new TextDecoder().decode(value);
              fullResponse += chunk;
              setStreamingMessage(fullResponse);
            }
          } catch (error) {
            setIsStreaming(false);
            setStreamingMessage("");
            reject(error);
          }
        };

        processStream();
        } catch (error) {
          setIsStreaming(false);
          setStreamingMessage("");
          reject(error);
        }
      });
    },
    onSuccess: async (fullResponse) => {
      // Add user message
      const userMessage: Message = {
        id: Date.now(),
        chatId: parseInt(chatId!),
        userId: user!.id,
        content: message,
        role: "user",
        createdAt: new Date(),
      };

      // Add assistant message
      const assistantMessage: Message = {
        id: Date.now() + 1,
        chatId: parseInt(chatId!),
        userId: user!.id,
        content: fullResponse,
        role: "assistant",
        createdAt: new Date(),
      };

      setLocalMessages(prev => [...prev, userMessage, assistantMessage]);
      setMessage("");

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId] });
      queryClient.invalidateQueries({ queryKey: ["/api/psychology/stats", user?.id] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetSessionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user ID");
      await apiRequest(`/api/psychology/session/${user.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Session Reset",
        description: "Psychology session has been reset.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/psychology/stats", user?.id] });
    },
    onError: (error) => {
      console.error("Error resetting session:", error);
      toast({
        title: "Error",
        description: "Failed to reset session.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() || isStreaming) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleVoiceInput = (transcription: string) => {
    setMessage(transcription);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getUserInitials = (user: any) => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return (firstName + lastName).slice(0, 2).toUpperCase() || "U";
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading psychology session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Brain className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Psychology Agent</h1>
            <p className="text-sm text-gray-600">Therapeutic conversation assistant</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="flex items-center space-x-1"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Stats</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetSessionMutation.mutate()}
            disabled={resetSessionMutation.isPending}
            className="flex items-center space-x-1"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="border-b p-4 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.totalQuestions}</p>
              <p className="text-sm text-gray-600">Questions Asked</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.totalResponses}</p>
              <p className="text-sm text-gray-600">Responses Given</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{formatDuration(stats.sessionDuration)}</p>
              <p className="text-sm text-gray-600">Session Duration</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList 
          messages={localMessages}
          streamingMessage={isStreaming ? streamingMessage : null}
          user={user}
        />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Share your thoughts and feelings..."
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={isStreaming}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <VoiceInput onTranscription={handleVoiceInput} />
            
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || isStreaming}
              className="px-4 py-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {isStreaming && (
          <div className="mt-2 text-sm text-gray-500 flex items-center space-x-1">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
            <span>Psychology agent is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
