# AI Chat Assistant

## Overview

This is a full-stack AI chat application built with a modern tech stack. The application provides a conversational interface where users can interact with an AI assistant through text and voice input. It features real-time streaming responses, voice transcription, and a responsive design with both light and dark modes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Authentication**: Replit Auth with OpenID Connect

### AI Integration
- **Provider**: OpenAI API (GPT-4o model)
- **Features**: Text completion, streaming responses, and audio transcription
- **API Key**: Configured via environment variables

## Key Components

### Database Schema
- **Users**: Stores user profile information (required for Replit Auth)
- **Chats**: Conversation containers with titles and timestamps
- **Messages**: Individual chat messages with role (user/assistant) and content
- **Sessions**: Session storage for authentication (required for Replit Auth)

### Authentication System
- **Provider**: Replit Auth with OpenID Connect
- **Session Management**: PostgreSQL-based session storage
- **Authorization**: Route-level protection for API endpoints

### Chat System
- **Real-time Streaming**: Server-sent events for AI responses
- **Voice Input**: Web Audio API for recording and transcription
- **Message History**: Persistent conversation storage
- **Auto-generated Titles**: AI-powered chat title generation

### UI Components
- **Responsive Design**: Mobile-first approach with collapsible sidebar
- **Dark Mode**: System preference detection with manual toggle
- **Component Library**: shadcn/ui built on Radix UI primitives
- **Accessibility**: ARIA labels and keyboard navigation support

## Data Flow

1. **User Authentication**: Replit Auth handles OAuth flow and session management
2. **Chat Creation**: Users create new conversations with auto-generated titles
3. **Message Processing**: User input is sent to OpenAI API for processing
4. **Streaming Response**: AI responses are streamed back in real-time
5. **Data Persistence**: All messages and chats are stored in PostgreSQL

### Voice Input Flow
1. User clicks microphone button to start recording
2. Web Audio API captures audio and converts to blob
3. Audio is sent to `/api/transcribe` endpoint
4. OpenAI Whisper API transcribes audio to text
5. Transcribed text is inserted into the message input

## External Dependencies

### Core Dependencies
- **Database**: Neon Database (serverless PostgreSQL)
- **AI Services**: OpenAI API (GPT-4o and Whisper)
- **Authentication**: Replit Auth infrastructure
- **File Upload**: Multer for handling audio files

### Development Dependencies
- **TypeScript**: Type safety and better developer experience
- **ESLint/Prettier**: Code formatting and linting
- **Vite**: Fast development server and build tool

### UI Dependencies
- **Radix UI**: Headless UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

## Deployment Strategy

### Development
- **Local Development**: Vite dev server with hot module replacement
- **Database**: Neon Database with connection pooling
- **Environment**: NODE_ENV=development with debug logging

### Production
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Server**: Express.js serves both API and static files
- **Database**: Production Neon Database instance
- **Environment**: NODE_ENV=production with optimized settings

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `SESSION_SECRET`: Session encryption key
- `REPLIT_DOMAINS`: Allowed domains for Replit Auth
- `ISSUER_URL`: OpenID Connect issuer URL

### File Structure
```
├── client/          # Frontend React application
├── server/          # Backend Express API
├── shared/          # Shared TypeScript schemas
├── dist/            # Production build output
└── migrations/      # Database migration files
```

The application follows a monorepo structure with clear separation between frontend, backend, and shared code, making it easy to maintain and deploy as a single unit.