import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, User } from "lucide-react";
import type { Message } from "@shared/schema";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string;
  isStreaming: boolean;
  user: any;
}

export default function MessageList({
  messages,
  isLoading,
  streamingMessage,
  isStreaming,
  user,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const getUserInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === "user";
    
    return (
      <div
        key={message.id}
        className={`flex items-start space-x-3 animate-fade-in ${
          isUser ? "justify-end" : ""
        }`}
      >
        {!isUser && (
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white">
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className={`flex-1 ${isUser ? "flex flex-col items-end" : ""}`}>
          <div
            className={`max-w-3xl p-4 rounded-2xl ${
              isUser
                ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white rounded-tr-md"
                : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-md"
            }`}
          >
            <div className="prose prose-sm max-w-none">
              {message.content.includes("```") ? (
                <pre className="whitespace-pre-wrap break-words">
                  {message.content}
                </pre>
              ) : (
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
            </div>
          </div>
          <span className={`text-xs text-slate-500 dark:text-slate-400 mt-1 block ${
            isUser ? "mr-4" : "ml-4"
          }`}>
            {formatTimestamp(message.createdAt!)}
          </span>
        </div>
        
        {isUser && (
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500 text-white">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  };

  const renderStreamingMessage = () => {
    if (!isStreaming && !streamingMessage) return null;
    
    return (
      <div className="flex items-start space-x-3 animate-fade-in">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white">
            <Bot className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-md p-4 max-w-3xl">
            <div className="prose prose-sm max-w-none">
              {streamingMessage ? (
                <p className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
                  {streamingMessage}
                  <span className="animate-pulse">▊</span>
                </p>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-slate-600 dark:text-slate-400">AI is typing</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-4 mt-1 block">
            Ahora
          </span>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-6"
    >
      {messages.length === 0 ? (
        <div className="flex items-start space-x-3 animate-fade-in">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white">
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-md p-4 max-w-3xl">
              <p className="text-slate-800 dark:text-slate-200">
                ¡Hola! Soy tu asistente de IA. Puedo ayudarte con tus preguntas. ¿Cómo puedo ayudarte hoy?
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-4 mt-1 block">
              En este momento
            </span>
          </div>
        </div>
      ) : (
        messages.map(renderMessage)
      )}
      
      {renderStreamingMessage()}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
