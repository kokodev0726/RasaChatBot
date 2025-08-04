import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { LangChainService } from "@/lib/langchainService";
import { useLangChain } from "@/contexts/LangChainContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MessageList from "@/components/MessageList";
import VoiceInput from "@/components/VoiceInput";
import { Send, Paperclip, Download, Share, Bot, Zap } from "lucide-react";
import type { ChatWithMessages, Message } from "@shared/schema";

export default function ChatInterface() {
  const { chatId } = useParams<{ chatId: string }>();
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { config: langChainConfig, isConnected } = useLangChain();

  const { data: chat, isLoading, error } = useQuery<ChatWithMessages>({
    queryKey: ["/api/chats", chatId],
    enabled: !!chatId,
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
      
      // Use LangChain if enabled and connected, otherwise fall back to OpenAI
      if (langChainConfig.enabled && isConnected) {
        return new Promise<string>((resolve, reject) => {
          LangChainService.streamConversation(
            messageContent,
            (chunk) => {
              setStreamingMessage(prev => prev + chunk);
            },
            (fullResponse) => {
              setIsStreaming(false);
              setStreamingMessage("");
              resolve(fullResponse);
            },
            (error) => {
              setIsStreaming(false);
              setStreamingMessage("");
              reject(error);
            },
            parseInt(chatId),
            langChainConfig.useAgent
          );
        });
      } else {
        // Fallback to OpenAI
        const response = await fetch(`/api/chats/${chatId}/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ message: messageContent }),
        });

        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            setStreamingMessage(fullResponse);
          }
        }

        setIsStreaming(false);
        setStreamingMessage("");
        
        return fullResponse;
      }
    },
    onSuccess: (aiMessageContent: string) => {
      // Add AI message to localMessages
      const aiMessage: Message = {
        id: Date.now(), // temporary id
        role: "assistant",
        content: aiMessageContent,
        createdAt: new Date(),
        chatId: parseInt(chatId!),
      };
      setLocalMessages((prev) => [...prev, aiMessage]);
      // Only invalidate the chats list, not the current chat to avoid refresh
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
    onError: (error: Error) => {
      setIsStreaming(false);
      setStreamingMessage("");
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "No autorizado",
          description: "Has cerrado sesión. Iniciando sesión nuevamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;

    // Add user message immediately to localMessages
    const userMessage: Message = {
      id: Date.now(), // temporary id
      role: "user",
      content: message,
      createdAt: new Date(),
      chatId: parseInt(chatId!),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    sendMessageMutation.mutate(message);
    setMessage("");
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const getUserInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
            Bienvenido al chat de RASA AI
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Selecciona una conversación en la barra lateral o crea una nueva para comenzar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                Asistente de Rasa AI
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-emerald-500 flex items-center">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                  En línea
                </p>
                {langChainConfig.enabled && isConnected && (
                  <div className="flex items-center gap-1 text-xs text-blue-500">
                    <Zap className="w-3 h-3" />
                    <span>LangChain</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={localMessages}
          isLoading={isLoading}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
          user={user}
        />
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="min-h-[44px] max-h-32 resize-none pr-20 rounded-2xl border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={sendMessageMutation.isPending}
              />
              
              <div className="absolute right-3 bottom-3 flex items-center space-x-1">
                <VoiceInput onTranscription={handleVoiceInput} />
              </div>
            </div>
          </div>
          <div className="relative pb-2">
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white h-11 w-11 p-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
