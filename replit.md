# AI Prompt Engineering Platform v3.0 - Biometric Integration

## Overview

This is a full-stack web application that combines AI prompt engineering with real-time biometric data collection and analysis. The platform allows users to create, manage, and execute AI prompts while monitoring physiological responses to optimize cognitive performance and AI interaction quality.

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
- **AI Integration**: OpenAI API (GPT-4o model)

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

### 2. AI Prompt Engineering
- **Template System**: Reusable prompt templates with categories
- **Dynamic Adaptation**: AI prompts adapt based on real-time biometric context
- **Response Analysis**: Tracks response time and cognitive complexity
- **Performance Optimization**: Correlates biometric state with AI interaction quality

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
2. **AI Interaction**: User Input → Biometric Context → OpenAI API → Response Analysis
3. **Correlation Analysis**: Biometric + AI Performance → Machine Learning → Optimization
4. **Real-time Updates**: Database Changes → WebSocket → Frontend Updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **openai**: Official OpenAI API client
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
- **Environment Variables**: OpenAI API key, Database URL required

### Configuration
- **Frontend Config**: Vite with React, TypeScript, and Tailwind
- **Database Config**: Drizzle with PostgreSQL dialect
- **API Integration**: OpenAI GPT-4o model for AI responses

## Changelog

```
Changelog:
- June 29, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```