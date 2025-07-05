import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { LLMService } from './services/LLMService.js';
import { createRoutes } from './api/routes.js';
import { logger } from './utils/logger.js';
import { TelemetryDatabaseConnection } from './types/index.js';

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const TELEMETRY_API_URL = process.env.TELEMETRY_API_URL || 'http://localhost:3000';
const TELEMETRY_WS_URL = process.env.TELEMETRY_WS_URL || 'ws://localhost:3000';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

async function createApp(): Promise<express.Application> {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", TELEMETRY_API_URL.replace('http', 'ws')],
      },
    },
  }));
  
  app.use(cors({
    origin: NODE_ENV === 'production' 
      ? ['https://your-telemetry-domain.com'] // Replace with actual domain
      : true,
    credentials: true
  }));

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(limiter);

  // Initialize LLM Service
  const telemetryConfig: TelemetryDatabaseConnection = {
    baseURL: TELEMETRY_API_URL,
    wsURL: TELEMETRY_WS_URL,
    apiKey: process.env.TELEMETRY_API_KEY
  };

  const llmService = new LLMService(telemetryConfig, OLLAMA_HOST);

  try {
    await llmService.initialize();
    logger.info('LLM Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize LLM Service:', error);
    process.exit(1);
  }

  // Setup routes
  app.use('/api', createRoutes(llmService));

  // Global error handler
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  });

  // 404 handler
  app.use('*', (req: express.Request, res: express.Response) => {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await llmService.shutdown();
      logger.info('LLM Service shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return app;
}

// Start server
async function start(): Promise<void> {
  try {
    const app = await createApp();
    
    const server = app.listen(PORT, () => {
      logger.info(`LLM Service running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`Health check available at http://localhost:${PORT}/api/health`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();