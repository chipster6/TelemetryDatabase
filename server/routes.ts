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

// Simple rate limiting for API endpoints
const requests = new Map<string, number[]>();
const rateLimit = (ip: string, maxRequests: number = 100, windowMs: number = 60000): boolean => {
  const now = Date.now();
  if (!requests.has(ip)) requests.set(ip, []);
  
  const userRequests = requests.get(ip)!;
  const validRequests = userRequests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) return false;
  
  validRequests.push(now);
  requests.set(ip, validRequests);
  return true;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket Controller
  const wsController = new WebSocketController(globalContainer, httpServer);
  globalContainer.registerSingleton(TOKENS.WebSocketController, () => wsController);

  // Resolve controllers
  const authController = globalContainer.resolve(TOKENS.AuthController);
  const promptController = globalContainer.resolve(TOKENS.PromptController);
  const biometricController = globalContainer.resolve(TOKENS.BiometricController);

  // Rate limiting middleware
  const applyRateLimit = (req: any, res: any, next: any) => {
    if (!rateLimit(req.ip || 'unknown')) {
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };

  // CSRF protection middleware
  const csrfProtect = SecurityMiddleware.csrfProtection();

  // Authentication Routes
  app.post("/api/login", validateCredentials, (req, res) => authController.login(req, res));
  app.post("/api/register", validateCredentials, (req, res) => authController.register(req, res));
  app.post("/api/logout", csrfProtect, (req, res) => authController.logout(req, res));
  app.get("/api/auth/status", (req, res) => authController.getAuthStatus(req, res));

  // Prompt Routes
  app.get("/api/templates", requireAuth, (req, res) => promptController.getPromptTemplates(req, res));
  app.post("/api/templates", csrfProtect, authorizeTemplateAccess, validatePromptTemplate, (req, res) => promptController.createPromptTemplate(req, res));
  app.post("/api/generate", csrfProtect, requireAuth, validatePromptSession, applyRateLimit, (req, res) => promptController.generateResponse(req, res));
  app.get("/api/sessions", (req, res) => promptController.getPromptSessions(req, res));

  // Biometric Routes
  app.get("/api/biometric", (req, res) => biometricController.getBiometricData(req, res));
  app.get("/api/biometric/timeseries", (req, res) => biometricController.getBiometricTimeSeries(req, res));
  app.get("/api/biometric/latest", (req, res) => biometricController.getLatestBiometricData(req, res));
  app.post("/api/biometric", csrfProtect, authorizeBiometricAccess, validateBiometricData, (req, res) => biometricController.collectBiometricData(req, res));
  app.get("/api/biometric/analytics", (req, res) => biometricController.getBiometricAnalytics(req, res));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      websocketClients: wsController.getConnectedClientsCount()
    });
  });

  return httpServer;
}