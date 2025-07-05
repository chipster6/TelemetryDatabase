import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { LLMService } from './services/LLMService.js';
import { createRoutes } from './api/routes.js';
import { logger } from './utils/logger.js';
import { TelemetryDatabaseConnection } from './types/index.js';
import { createUserRateLimit } from './middleware/userRateLimit.js';
import { createResourceLimits } from './middleware/resourceLimits.js';
import { createAbuseDetection } from './middleware/abuseDetection.js';
import { AuditLogger } from './services/AuditLogger.js';
import { createPromptSecurity } from './middleware/promptSecurity.js';

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const TELEMETRY_API_URL = process.env.TELEMETRY_API_URL || 'http://localhost:3000';
const TELEMETRY_WS_URL = process.env.TELEMETRY_WS_URL || 'ws://localhost:3000';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'https://localhost:11434';

// Ollama security configuration
const OLLAMA_CERT_PINS = process.env.OLLAMA_CERT_PINS?.split(',') || [];
const OLLAMA_CA_CERT = process.env.OLLAMA_CA_CERT_PATH;
const OLLAMA_CLIENT_CERT = process.env.OLLAMA_CLIENT_CERT_PATH;
const OLLAMA_CLIENT_KEY = process.env.OLLAMA_CLIENT_KEY_PATH;

// Initialize security services
const auditLogger = new AuditLogger({
  encryptSensitiveData: NODE_ENV === 'production',
  enableRealTimeAlerts: true,
  retentionDays: 90
});

// Enhanced rate limiting configuration
const userRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: NODE_ENV === 'production' ? 1000 : 5000, // per IP
  maxRequestsPerUser: NODE_ENV === 'production' ? 100 : 500, // per user
  blockDuration: 900 // 15 minutes
});

// Prompt security middleware
const promptSecurity = createPromptSecurity({
  maxPromptLength: 10000,
  maxTokens: 4096,
  enableHoneypot: true,
  logViolations: true
});

// Resource limits middleware
const resourceLimits = createResourceLimits({
  maxTokensPerRequest: 8192,
  maxTokensPerUser: NODE_ENV === 'production' ? 100000 : 500000, // per hour
  maxTokensPerUserDaily: NODE_ENV === 'production' ? 500000 : 2000000,
  maxConcurrentRequests: NODE_ENV === 'production' ? 50 : 100,
  maxConcurrentRequestsPerUser: 3,
  maxPromptLength: 50000,
  maxResponseLength: 100000,
  maxProcessingTimeMs: 300000 // 5 minutes
}, auditLogger);

// Abuse detection middleware
const abuseDetection = createAbuseDetection({
  maxSimilarPromptsPerHour: 20,
  maxRequestBurstSize: 15,
  enableContentAnalysis: true,
  warningThreshold: 30,
  temporaryBlockThreshold: 60,
  permanentBlockThreshold: 120
}, auditLogger);

async function createApp(): Promise<express.Application> {
  const app = express();

  // Enhanced security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", TELEMETRY_API_URL.replace('http', 'ws')],
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  }));
  
  app.use(cors({
    origin: NODE_ENV === 'production' 
      ? ['https://your-telemetry-domain.com'] // Replace with actual domain
      : true,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  app.use(compression());
  app.use(express.json({ 
    limit: '1mb', // Reduced from 10mb for security
    strict: true,
    type: 'application/json'
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '1mb', // Reduced from 10mb for security
    parameterLimit: 100
  }));

  // Apply rate limiting
  app.use(userRateLimit.middleware());

  // Apply abuse detection globally
  app.use(abuseDetection.detectAbuse());

  // Apply resource limits to generation endpoints
  app.use('/api/generate', resourceLimits.preRequestLimits());

  // Apply prompt security to generation endpoints
  app.use('/api/generate', promptSecurity.middleware());

  // Initialize LLM Service
  const telemetryConfig: TelemetryDatabaseConnection = {
    baseURL: TELEMETRY_API_URL,
    wsURL: TELEMETRY_WS_URL,
    apiKey: process.env.TELEMETRY_API_KEY
  };

  // Configure Ollama with certificate pinning
  const ollamaConfig = {
    host: OLLAMA_HOST,
    pinnedCertificates: OLLAMA_CERT_PINS,
    caCertPath: OLLAMA_CA_CERT,
    clientCertPath: OLLAMA_CLIENT_CERT,
    clientKeyPath: OLLAMA_CLIENT_KEY,
    verifyHostname: true,
    timeout: 30000,
    retries: 3
  };

  const llmService = new LLMService(telemetryConfig, ollamaConfig);

  // Log security configuration
  logger.info('Ollama security configuration', {
    host: OLLAMA_HOST,
    certificatePinningEnabled: OLLAMA_CERT_PINS.length > 0,
    pinnedCertificateCount: OLLAMA_CERT_PINS.length,
    clientCertAuth: !!(OLLAMA_CLIENT_CERT && OLLAMA_CLIENT_KEY),
    customCA: !!OLLAMA_CA_CERT
  });

  try {
    await llmService.initialize();
    logger.info('LLM Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize LLM Service:', error);
    process.exit(1);
  }

  // Setup routes with security components
  app.use('/api', createRoutes(llmService, auditLogger, {
    resourceLimits,
    abuseDetection,
    userRateLimit,
    promptSecurity
  }));

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
      await resourceLimits.close();
      await abuseDetection.close();
      await userRateLimit.close();
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