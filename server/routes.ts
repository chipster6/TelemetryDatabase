import type { Express } from "express";
import { createServer, type Server } from "http";
import { globalContainer } from "./di/bootstrap";
import { TOKENS } from "./di/tokens";
import { WebSocketController } from "./controllers/WebSocketController";
import { 
  validateCredentials, 
  validateBiometricData, 
  validatePromptTemplate, 
  validatePromptSession,
  validateDeviceConnection,
  validateId,
  validatePagination,
  csrfProtection,
  generateCsrfToken
} from './middleware/validation.js';
import {
  requireAuth,
  authorizeBiometricAccess,
  authorizeTemplateAccess,
  authorizeDeviceAccess,
  auditLog
} from './middleware/authorization.js';
import { SecurityMiddleware } from './middleware/SecurityMiddleware.js';
import { PerformanceMiddleware } from './middleware/PerformanceMiddleware.js';
import { SecurityEndpoints } from './routes/security-endpoints.js';
import { HealthEndpoints } from './routes/health-endpoints.js';
import { PerformanceEndpoints } from './routes/performance-endpoints.js';

// REMOVED: Simple in-memory rate limiting replaced with Redis-backed SecurityMiddleware rate limiting

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket Controller
  const wsController = new WebSocketController(globalContainer, httpServer);
  globalContainer.registerSingleton(TOKENS.WebSocketController, () => wsController);

  // Resolve controllers
  const authController = globalContainer.resolve(TOKENS.AuthController);
  const promptController = globalContainer.resolve(TOKENS.PromptController);
  const biometricController = globalContainer.resolve(TOKENS.BiometricController);

  // Rate limiting middleware - use Redis-backed SecurityMiddleware
  const apiRateLimit = SecurityMiddleware.rateLimiting().api;

  // CSRF protection middleware
  const csrfProtect = SecurityMiddleware.csrfProtection();

  // Performance monitoring middleware - apply globally
  app.use(PerformanceMiddleware.monitor());
  app.use(PerformanceMiddleware.rateLimitMonitor());
  app.use(PerformanceMiddleware.memoryMonitor());

  // Authentication Routes
  app.post("/api/login", validateCredentials, (req, res) => authController.login(req, res));
  app.post("/api/register", validateCredentials, (req, res) => authController.register(req, res));
  app.post("/api/logout", csrfProtect, (req, res) => authController.logout(req, res));
  app.get("/api/auth/status", (req, res) => authController.getAuthStatus(req, res));

  // Prompt Routes
  app.get("/api/templates", requireAuth, (req, res) => promptController.getPromptTemplates(req, res));
  app.post("/api/templates", csrfProtect, authorizeTemplateAccess, validatePromptTemplate, (req, res) => promptController.createPromptTemplate(req, res));
  app.post("/api/generate", csrfProtect, requireAuth, validatePromptSession, apiRateLimit, (req, res) => promptController.generateResponse(req, res));
  app.get("/api/sessions", (req, res) => promptController.getPromptSessions(req, res));

  // Biometric Routes
  app.get("/api/biometric", (req, res) => biometricController.getBiometricData(req, res));
  app.get("/api/biometric/timeseries", (req, res) => biometricController.getBiometricTimeSeries(req, res));
  app.get("/api/biometric/latest", (req, res) => biometricController.getLatestBiometricData(req, res));
  app.post("/api/biometric", csrfProtect, authorizeBiometricAccess, validateBiometricData, (req, res) => biometricController.collectBiometricData(req, res));
  app.get("/api/biometric/analytics", (req, res) => biometricController.getBiometricAnalytics(req, res));

  // Health check endpoints
  app.get("/api/health", HealthEndpoints.getLegacyHealth); // Backward compatibility
  app.get("/api/health/comprehensive", HealthEndpoints.getComprehensiveHealth);
  app.get("/api/health/quick", HealthEndpoints.getQuickHealth);
  app.get("/api/health/database", HealthEndpoints.getDatabaseHealth);
  app.get("/api/health/redis", HealthEndpoints.getRedisHealth);
  app.get("/api/health/weaviate", HealthEndpoints.getWeaviateHealth);
  app.get("/api/health/readiness", HealthEndpoints.getReadiness);
  app.get("/api/health/liveness", HealthEndpoints.getLiveness);

  // Security monitoring endpoints (IP-restricted)
  app.get("/api/security/memory-stats", ...SecurityEndpoints.getMemoryStats);
  app.post("/api/security/memory-cleanup", ...SecurityEndpoints.forceMemoryCleanup);
  app.get("/api/security/comprehensive-status", ...SecurityEndpoints.getSecurityStatus);
  app.post("/api/security/test-memory", ...SecurityEndpoints.testSecureMemory);

  // Performance monitoring endpoints
  app.get("/api/performance/metrics", PerformanceEndpoints.getCurrentMetrics);
  app.get("/api/performance/summary", PerformanceEndpoints.getPerformanceSummary);
  app.get("/api/performance/trends", PerformanceEndpoints.getPerformanceTrends);
  app.get("/api/performance/component/:component", PerformanceEndpoints.getComponentMetrics);
  app.get("/api/performance/alerts", PerformanceEndpoints.getPerformanceAlerts);
  app.post("/api/performance/alerts", csrfProtect, PerformanceEndpoints.createPerformanceAlert);
  app.delete("/api/performance/alerts/:alertId", csrfProtect, PerformanceEndpoints.deletePerformanceAlert);
  app.get("/api/performance/export", PerformanceEndpoints.exportPerformanceData);
  app.get("/api/performance/realtime", PerformanceEndpoints.getRealtimeMetrics);
  app.post("/api/performance/collect", csrfProtect, PerformanceEndpoints.forceMetricsCollection);

  // Error handling middleware for performance monitoring
  app.use(PerformanceMiddleware.errorMonitor());

  return httpServer;
}