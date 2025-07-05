import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";
import compression from "compression";
import { ConfigurationManager } from "./config/ConfigurationManager";
import { ServiceContainer } from "./di/ServiceContainer";
import { TOKENS } from "./di/tokens";
import { MiddlewareManager, LoggingMiddleware } from "./middleware";
import { REQUEST, NETWORK } from "./constants/ApplicationConstants";

const app = express();

// Initialize DI container and configuration
import { globalContainer } from "./di/bootstrap";
const config = globalContainer.resolve(TOKENS.ConfigurationManager);

// Initialize and validate production security configuration
import { productionSecurityConfig } from "./config/ProductionSecurityConfig";
productionSecurityConfig.logSecuritySummary();

// Initialize centralized Redis connection manager
import { redisConnectionManager } from "./services/RedisConnectionManager";
redisConnectionManager.initialize().catch(console.error);

// Initialize enhanced Weaviate Connection Manager with pooling
import { weaviateConnectionManager } from "./services/WeaviateConnectionManager";
weaviateConnectionManager.initialize({
  minConnections: 2,
  maxConnections: 8,
  acquireTimeoutMs: 10000,
  idleTimeoutMs: 300000,
  healthCheckIntervalMs: 30000
}).catch((error) => {
  console.warn('Weaviate Connection Manager failed to initialize - vector database features will be limited:', error.message);
});

// Initialize secure memory manager for cryptographic protection
import { secureMemoryManager } from "./services/security/SecureMemoryManager";
console.log('🔐 Secure Memory Manager initialized for cryptographic material protection');

// Initialize NexisBrain service with proper error handling
import { nexisBrainService } from "./services/nexis-brain";
nexisBrainService.initialize().catch((error) => {
  console.warn('NexisBrain failed to initialize - AI features will be limited:', error.message);
});

// Apply middleware in correct order
MiddlewareManager.applySecurity(app, config);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: REQUEST.MAX_BODY_SIZE }));
app.use(express.urlencoded({ extended: false, limit: REQUEST.MAX_BODY_SIZE }));

// Session and logging middleware
MiddlewareManager.applySession(app, pool, config);
MiddlewareManager.applyLogging(app);

(async () => {
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use(LoggingMiddleware.errorHandler());

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = NETWORK.DEFAULT_PORT;
  
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Please stop other processes using this port and restart.`);
      process.exit(1);
    } else {
      log(`Server error: ${err.message}`);
      process.exit(1);
    }
  });
})();
