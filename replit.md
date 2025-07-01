# AI Prompt Engineering Platform v3.0 - Biometric Integration

## Overview

This is a full-stack web application focused on prompt engineering best practices with real-time biometric data collection and analysis. The platform allows users to create, manage, and refine prompts using proven prompt engineering techniques while monitoring physiological responses for wellness tracking.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with Hot Module Replacement (HMR)
- **UI Library**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Real-time Communication**: WebSocket connection for live biometric data

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **WebSocket**: ws library for real-time biometric streaming


### Database Schema
- **Users**: User authentication and management
- **Prompt Templates**: Reusable prompt configurations
- **Prompt Sessions**: Individual AI interaction sessions
- **Biometric Data**: Real-time physiological measurements
- **Cognitive Correlations**: AI performance vs biometric correlations
- **Device Connections**: Connected biometric device management

## Key Components

### 1. Biometric Data Collection
- **Real-time Monitoring**: Heart rate, HRV, stress levels, attention, cognitive load
- **Environmental Factors**: Sound, temperature, light levels
- **Device Integration**: Supports Bluetooth devices, HealthKit, and simulation mode
- **Data Processing**: On-device processing with privacy-first approach

### 2. Prompt Engineering Tools
- **Template System**: Reusable prompt templates with categories
- **Prompt Refinement**: Automatic enhancement using prompt engineering best practices
- **Structure Analysis**: Analyzes and improves prompt structure and clarity
- **Best Practice Application**: Applies proven prompt engineering techniques

### 3. Real-time Dashboard
- **Live Biometric Display**: Current physiological state visualization
- **Interactive Charts**: HRV trends, cognitive load patterns
- **Device Status**: Connected device monitoring
- **AI Readiness Indicators**: Real-time cognitive state assessment

### 4. Privacy & Security
- **On-device Processing**: Biometric data processed locally when possible
- **Encryption**: All sensitive data encrypted in transit and at rest
- **Federated Learning**: Privacy-preserving AI model improvements
- **Differential Privacy**: Statistical privacy protection

## Data Flow

1. **Biometric Collection**: Devices → WebSocket → Real-time Processing → Database
2. **Prompt Refinement**: User Input → Prompt Engineering Analysis → Enhanced Prompt Output
3. **Wellness Analysis**: Biometric Data → Anonymized Statistics → Health Insights
4. **Real-time Updates**: Database Changes → WebSocket → Frontend Updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM

- **@tanstack/react-query**: Server state management
- **ws**: WebSocket server implementation

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **react-hook-form**: Form state management
- **chart.js**: Data visualization

### Development Dependencies
- **vite**: Fast build tool with HMR
- **typescript**: Type safety
- **drizzle-kit**: Database migrations

## Deployment Strategy

### Development
- **Local Development**: `npm run dev` starts both frontend and backend
- **Database**: Drizzle Kit for schema management and migrations
- **Environment**: NODE_ENV=development with Vite dev server

### Production
- **Build Process**: 
  - Frontend: `vite build` → static assets
  - Backend: `esbuild` → optimized Node.js bundle
- **Database**: PostgreSQL via Neon Database
- **Deployment**: Single-process deployment with static file serving
- **Environment Variables**: Database URL required

### Configuration
- **Frontend Config**: Vite with React, TypeScript, and Tailwind
- **Database Config**: Drizzle with PostgreSQL dialect
- **Prompt Processing**: Built-in prompt engineering and refinement system

## Changelog

```
Changelog:
- June 29, 2025. Initial setup
- June 29, 2025. Fixed startup issues: resolved missing chart.js dependency and CSS import order problems. App now running successfully with real-time biometric simulation.
- June 29, 2025. Implemented comprehensive vector database architecture with Weaviate, post-quantum encryption, sharded storage, semantic search, telemetry analytics, daily compression, and cloud export capabilities. All advanced features operational.
- July 1, 2025. Major architectural change: Removed biometric-aware prompt refinement feature per user feedback. The system now focuses purely on prompt engineering best practices rather than adapting prompts based on physiological state. Biometric monitoring remains for general wellness tracking only.
- July 1, 2025. Implemented comprehensive post-quantum encryption for all data at rest and in transit. All sensitive data (biometric readings, user information, prompt sessions) is encrypted using post-quantum resistant algorithms before storage and transmission. Replaced simulated Weaviate vector database with real Weaviate Cloud integration using TypeScript client.
- July 1, 2025. Removed all OpenAI API integrations per user request. The platform now focuses on prompt engineering best practices using built-in algorithms rather than external AI services. Biometric monitoring remains for wellness tracking, and prompt refinement uses proven prompt engineering techniques.
- July 1, 2025. Implemented comprehensive Weaviate environment variables (WEAVIATE_URL and WEAVIATE_API_KEY) with proper URL parsing, authentication handling, connection testing, and health monitoring. Added performance optimizations including caching, rate limiting, and batch processing throughout the system.
- July 1, 2025. Created comprehensive GitHub documentation including detailed README.md, API documentation, security guide, and licensing. Implemented zero-visibility password input that shows absolutely no characters while typing, enhanced with anti-keylogging protection and clipboard monitoring. Added MIT license and environment variable examples for easy deployment.
- July 1, 2025. Implemented advanced security and integration features: (1) WebAuthn/FIDO2 passwordless biometric authentication framework with credential management, (2) Microsoft SEAL homomorphic encryption service for privacy-preserving cloud computations on biometric data, (3) Comprehensive biometric device SDK supporting Apple HealthKit, Bluetooth devices, and EEG sensors with real-time streaming capabilities. Added device discovery, connection management, and automated data processing.
- July 1, 2025. Implemented Nexis Brain - advanced AI conversation system with biometric-aware contextual memory. Features include conversation storage with full biometric context, semantic similarity search, biometric pattern learning, dynamic prompt generation based on cognitive state, and intelligent LLM context building. The system learns from user interactions to provide neurodivergent-optimized responses and maintains comprehensive memory nodes for long-term learning.
- July 1, 2025. Completed Weaviate-first architecture migration transforming the platform into a true LLM backbone with infinite memory. Implemented comprehensive Weaviate schema with NexisConversation, NexisMemoryNode, NexisBiometricPattern, and NexisPromptTemplate classes. Added full RAG pipeline with semantic search, biometric state matching, optimal response strategy learning, and dynamic LLM context building. PostgreSQL now handles only authentication while Weaviate serves as primary data store for all conversations, memories, and patterns.
- July 1, 2025. Completed advanced RAG (Retrieval-Augmented Generation) service with infinite context windows, comprehensive PostgreSQL-to-Weaviate migration tools, and intelligent frontend RAG interface. The system now provides biometric-aware AI responses using semantic similarity search across unlimited conversation history, personal memory retrieval, learned biometric patterns, and dynamic prompt adaptation. Added 12 new API endpoints supporting the complete Weaviate-first architecture with real-time pattern learning and contextual intelligence.
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```