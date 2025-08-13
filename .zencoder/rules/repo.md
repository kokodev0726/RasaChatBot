---
description: Repository Information Overview
alwaysApply: true
---

# RasaChatBot Information

## Summary
A full-stack chat application with AI capabilities powered by LangChain and OpenAI. The application features a React frontend with TypeScript, an Express backend, and PostgreSQL database integration. It includes psychology-related features, relationship pattern analysis, and conversational AI functionality.

## Structure
- **client/**: React frontend application with TypeScript
- **server/**: Express backend with LangChain integration
- **shared/**: Shared schema and types used by both client and server
- **drizzle/**: Database migration files and schema definitions
- **migrations/**: Additional database migration scripts
- **certs/**: Self-signed certificates for HTTPS

## Language & Runtime
**Language**: TypeScript/JavaScript
**Version**: ESM modules (type: "module")
**Build System**: Vite for frontend, esbuild for backend
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- **Frontend**: React 18, Radix UI components, TailwindCSS, wouter (routing)
- **Backend**: Express 4.21, LangChain 0.3.30, OpenAI 5.9.0
- **Database**: PostgreSQL with Drizzle ORM 0.39.3
- **AI**: @langchain/openai 0.6.3, langchain 0.3.30
- **Authentication**: Passport.js with Google/GitHub strategies

**Development Dependencies**:
- TypeScript 5.6.3
- Vite 5.4.19
- Tailwind 3.4.17
- tsx 4.19.1 (TypeScript execution)

## Build & Installation
```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Database migrations
npm run db:push
```

## Main Files & Resources
**Frontend Entry Point**: client/src/main.tsx
**Backend Entry Point**: server/index.ts
**API Routes**: server/routes.ts
**Database Schema**: shared/schema.ts
**Database Connection**: server/db.ts
**LangChain Integration**: server/langchain.ts, server/langchain.config.ts

## Testing
**Framework**: Custom test scripts
**Test Location**: server/*.test.ts, server/test-*.js
**Run Commands**:
```bash
# LangChain tests
npm run test:langchain

# Backend LangChain tests
npm run test:langchain-backend

# LangChain prompt tests
npm run test:langchain-prompt

# Settings tests
npm run test:settings
```

## Server Configuration
**Port**: 5005
**Protocol**: HTTPS with self-signed certificates
**Database**: PostgreSQL
**Authentication**: Passport.js with multiple strategies
**Environment Variables**: Loaded from .env file

## AI Features
**LLM Provider**: OpenAI
**Framework**: LangChain
**Capabilities**:
- Conversational memory management
- Vector store for semantic search
- Relationship inference and tracking
- Psychology-related question handling
- Streaming responses