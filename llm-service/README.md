# LLM Service

A microservice for biometric-aware LLM processing using Ollama and Mistral models.

## Features

- **Biometric Integration**: Consumes cognitive state data from TelemetryDatabase
- **Adaptive Generation**: Adjusts LLM parameters based on real-time biometrics
- **Local Models**: Uses Ollama with Mistral 7B for privacy-first processing
- **Memory Storage**: Stores interactions for personal memory retrieval
- **Real-time WebSocket**: Connects to TelemetryDatabase for live updates
- **Streaming Support**: Server-sent events for real-time response streaming

## Architecture

```
llm-service/
├── src/
│   ├── api/           # REST API routes
│   ├── ollama/        # Ollama client integration
│   ├── services/      # Core service classes
│   ├── types/         # TypeScript interfaces
│   └── utils/         # Utilities and logging
├── Dockerfile         # GPU-enabled container
└── package.json       # Dependencies and scripts
```

## Quick Start

### Prerequisites

- Node.js 18+
- Ollama installed locally or via Docker
- TelemetryDatabase running on port 3000

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start in development mode
npm run dev
```

### Docker Deployment

```bash
# Build with GPU support
docker build -t llm-service .

# Run with GPU access
docker run --gpus all -p 3001:3001 --env-file .env llm-service
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Generate Response
```
POST /api/generate
{
  "userId": "user123",
  "prompt": "Hello, how are you?",
  "stream": false
}
```

### Streaming Generation
```
POST /api/generate
{
  "userId": "user123", 
  "prompt": "Tell me a story",
  "stream": true
}
```

### Model Status
```
GET /api/models
```

### Telemetry Status
```
GET /api/telemetry-status
```

## Biometric Adaptations

The service automatically adapts based on cognitive state:

- **High Cognitive Load**: Simplified responses, lower temperature
- **Flow State**: Enhanced detail, higher token limits
- **Attention Issues**: Concise formatting, focused outputs
- **Neurodivergent Patterns**: Customized prompt conditioning

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | 3001 |
| `TELEMETRY_API_URL` | TelemetryDatabase API URL | http://localhost:3000 |
| `TELEMETRY_WS_URL` | TelemetryDatabase WebSocket URL | ws://localhost:3000 |
| `OLLAMA_HOST` | Ollama server URL | http://localhost:11434 |
| `NODE_ENV` | Environment mode | development |

## Development

```bash
# Development with hot reload
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Start production build
npm start
```

## Integration with TelemetryDatabase

The service integrates with your existing TelemetryDatabase by:

1. **Fetching biometric context** via `/api/llm/prepare-context`
2. **Storing interactions** via `/api/memory/store`  
3. **Receiving real-time updates** via WebSocket connection
4. **Adapting generation** based on cognitive state data

## Model Management

The service automatically:
- Downloads Mistral 7B Instruct Q4 on startup
- Manages model loading/unloading
- Provides model status via API
- Supports multiple quantization levels

## Monitoring

Logs are written to:
- `logs/combined.log` - All log levels
- `logs/error.log` - Error logs only
- Console output in development mode

Health checks available at `/api/health` for container orchestration.