// Enhanced Biometric API Routes with WebSocket Integration
// Comprehensive endpoints for the enhanced biometric pipeline

import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import BiometricPipelineService, { BiometricDataPoint, ProcessingResult } from '../services/BiometricPipelineService';
import NeurodivergentAnalyticsService, { NDPatterns } from '../services/NeurodivergentAnalyticsService';
import BiometricSecurityService, { EncryptedBiometricData } from '../services/BiometricSecurityService';
import BiometricPerformanceService, { PerformanceMetrics } from '../services/BiometricPerformanceService';

// ==================== Types ====================

interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
  user?: {
    id: string;
    permissions: string[];
    subscription: string;
  };
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'biometric_data' | 'analytics_request' | 'ping';
  userId?: string;
  data?: any;
  timestamp: number;
}

interface WebSocketClient {
  id: string;
  userId: string;
  subscriptions: Set<string>;
  lastActivity: number;
  ws: WebSocket;
}

// ==================== Enhanced Router Setup ====================

export function createEnhancedBiometricRoutes(
  pipelineService: BiometricPipelineService,
  analyticsService: NeurodivergentAnalyticsService,
  securityService: BiometricSecurityService,
  performanceService: BiometricPerformanceService,
  wsServer: WebSocketServer
): Router {
  const router = Router();
  const wsManager = new WebSocketManager(wsServer, pipelineService, analyticsService);
  
  // ==================== Middleware ====================
  
  // Security middleware
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "wss:", "ws:"]
      }
    }
  }));
  
  // CORS configuration
  router.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  }));
  
  // Compression
  router.use(compression());
  
  // Rate limiting
  const createRateLimit = (windowMs: number, max: number, message: string) => 
    rateLimit({
      windowMs,
      max,
      message: { error: message },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: AuthenticatedRequest) => req.userId || req.ip
    });
  
  // Different rate limits for different endpoints
  const biometricDataLimit = createRateLimit(60 * 1000, 1000, 'Too many biometric data submissions'); // 1000/min
  const analyticsLimit = createRateLimit(60 * 1000, 100, 'Too many analytics requests'); // 100/min
  const generalLimit = createRateLimit(60 * 1000, 500, 'Too many requests'); // 500/min
  
  // Authentication middleware (placeholder - integrate with your auth system)
  const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Verify token and extract user info
      // This should integrate with your existing auth system
      const user = await verifyAuthToken(token);
      req.userId = user.id;
      req.user = user;
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid authentication token' });
    }
  };
  
  // Permission middleware
  const requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: Function) => {
      if (!req.user?.permissions.includes(permission)) {
        return res.status(403).json({ error: `Permission required: ${permission}` });
      }
      next();
    };
  };
  
  // Validation error handler
  const handleValidationErrors = (req: Request, res: Response, next: Function) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  };
  
  // ==================== Biometric Data Endpoints ====================
  
  /**
   * POST /api/biometric/data
   * Submit biometric data for processing
   */
  router.post('/data',
    biometricDataLimit,
    authenticateUser,
    [
      body('timestamp').isNumeric().withMessage('Timestamp must be a number'),
      body('heartRate').isFloat({ min: 30, max: 250 }).withMessage('Heart rate must be between 30-250'),
      body('cognitiveLoad').isFloat({ min: 0, max: 100 }).withMessage('Cognitive load must be between 0-100'),
      body('attentionLevel').isFloat({ min: 0, max: 100 }).withMessage('Attention level must be between 0-100'),
      body('stressLevel').isFloat({ min: 0, max: 100 }).withMessage('Stress level must be between 0-100'),
      body('sessionId').isString().withMessage('Session ID is required'),
      body('hrv').optional().isFloat({ min: 0 }).withMessage('HRV must be positive'),
      body('skinTemperature').optional().isFloat({ min: 20, max: 50 }).withMessage('Temperature must be between 20-50°C'),
      body('environmentalSound').optional().isFloat({ min: 0, max: 150 }).withMessage('Sound level must be between 0-150 dB'),
      body('lightLevel').optional().isFloat({ min: 0 }).withMessage('Light level must be positive'),
      body('contextId').optional().isString().withMessage('Context ID must be a string')
    ],
    handleValidationErrors,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const biometricData: BiometricDataPoint = {
          ...req.body,
          userId: req.userId!,
          timestamp: req.body.timestamp || Date.now()
        };
        
        // Process through pipeline
        const result: ProcessingResult = await pipelineService.processBiometricData(biometricData);
        
        if (result.success) {
          // Broadcast to WebSocket subscribers
          wsManager.broadcastToUser(req.userId!, {
            type: 'biometric_update',
            data: {
              dataPoint: result.dataPoint,
              analytics: result.analytics,
              alerts: result.alerts
            },
            timestamp: Date.now()
          });
          
          res.status(201).json({
            success: true,
            processed: result.dataPoint,
            analytics: result.analytics,
            alerts: result.alerts,
            timestamp: Date.now()
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error,
            timestamp: Date.now()
          });
        }
        
      } catch (error) {
        console.error('Biometric data processing error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Processing failed'
        });
      }
    }
  );
  
  /**
   * POST /api/biometric/batch
   * Submit multiple biometric data points
   */
  router.post('/batch',
    biometricDataLimit,
    authenticateUser,
    [
      body('dataPoints').isArray({ min: 1, max: 100 }).withMessage('Data points must be an array of 1-100 items'),
      body('dataPoints.*.timestamp').isNumeric().withMessage('Each timestamp must be a number'),
      body('dataPoints.*.heartRate').isFloat({ min: 30, max: 250 }).withMessage('Each heart rate must be between 30-250')
    ],
    handleValidationErrors,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const dataPoints: BiometricDataPoint[] = req.body.dataPoints.map((point: any) => ({
          ...point,
          userId: req.userId!
        }));
        
        const results = await Promise.allSettled(
          dataPoints.map(point => pipelineService.processBiometricData(point))
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - successful;
        
        res.json({
          success: true,
          processed: successful,
          failed,
          totalReceived: dataPoints.length,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({ error: 'Batch processing failed' });
      }
    }
  );
  
  /**
   * GET /api/biometric/analytics/current
   * Get current real-time analytics
   */
  router.get('/analytics/current',
    analyticsLimit,
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const analytics = await pipelineService.getCurrentAnalytics(req.userId!);
        
        if (analytics) {
          res.json({
            success: true,
            analytics,
            timestamp: Date.now()
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'No current analytics available',
            timestamp: Date.now()
          });
        }
        
      } catch (error) {
        console.error('Analytics retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve analytics' });
      }
    }
  );
  
  // ==================== Neurodivergent Analytics Endpoints ====================
  
  /**
   * POST /api/biometric/analytics/nd-patterns
   * Analyze neurodivergent patterns
   */
  router.post('/analytics/nd-patterns',
    analyticsLimit,
    authenticateUser,
    requirePermission('analytics:advanced'),
    [
      body('startDate').isISO8601().withMessage('Start date must be valid ISO8601'),
      body('endDate').isISO8601().withMessage('End date must be valid ISO8601'),
      body('patternTypes').optional().isArray().withMessage('Pattern types must be an array')
    ],
    handleValidationErrors,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { startDate, endDate, patternTypes } = req.body;
        
        // Validate date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 30) {
          return res.status(400).json({
            error: 'Date range cannot exceed 30 days'
          });
        }
        
        if (start >= end) {
          return res.status(400).json({
            error: 'Start date must be before end date'
          });
        }
        
        // Get historical patterns
        const patterns = await analyticsService.analyzeHistoricalPatterns(
          req.userId!,
          { start, end }
        );
        
        res.json({
          success: true,
          patterns,
          dateRange: { startDate, endDate },
          analysisTimestamp: Date.now()
        });
        
      } catch (error) {
        console.error('ND pattern analysis error:', error);
        res.status(500).json({ error: 'Pattern analysis failed' });
      }
    }
  );
  
  /**
   * GET /api/biometric/analytics/insights/:userId?
   * Get personalized insights (admin can specify userId)
   */
  router.get('/analytics/insights/:userId?',
    analyticsLimit,
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const targetUserId = req.params.userId;
        
        // Check permissions for accessing other user's data
        if (targetUserId && targetUserId !== req.userId) {
          if (!req.user?.permissions.includes('analytics:admin')) {
            return res.status(403).json({
              error: 'Insufficient permissions to access other user data'
            });
          }
        }
        
        const userId = targetUserId || req.userId!;
        
        // Get recent patterns and generate insights
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        
        const patterns = await analyticsService.analyzeHistoricalPatterns(
          userId,
          { start: startDate, end: endDate }
        );
        
        // Generate personalized insights
        const insights = generatePersonalizedInsights(patterns);
        
        res.json({
          success: true,
          insights,
          userId,
          dataRange: { startDate, endDate },
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Insights generation error:', error);
        res.status(500).json({ error: 'Failed to generate insights' });
      }
    }
  );
  
  // ==================== Security Endpoints ====================
  
  /**
   * POST /api/biometric/security/encrypt
   * Encrypt biometric data
   */
  router.post('/security/encrypt',
    generalLimit,
    authenticateUser,
    requirePermission('security:encrypt'),
    [
      body('data').isObject().withMessage('Data must be an object'),
      body('keyId').optional().isString().withMessage('Key ID must be a string')
    ],
    handleValidationErrors,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { data, keyId } = req.body;
        
        const encrypted = await securityService.encryptBiometricData(data, keyId);
        
        res.json({
          success: true,
          encrypted,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Encryption error:', error);
        res.status(500).json({ error: 'Encryption failed' });
      }
    }
  );
  
  /**
   * POST /api/biometric/security/validate
   * Validate data integrity
   */
  router.post('/security/validate',
    generalLimit,
    authenticateUser,
    [
      body('data').isObject().withMessage('Data must be an object')
    ],
    handleValidationErrors,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isValid = await securityService.validateDataIntegrity(req.body.data);
        
        res.json({
          success: true,
          valid: isValid,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ error: 'Validation failed' });
      }
    }
  );
  
  // ==================== Performance Endpoints ====================
  
  /**
   * GET /api/biometric/performance/metrics
   * Get system performance metrics
   */
  router.get('/performance/metrics',
    generalLimit,
    authenticateUser,
    requirePermission('admin:metrics'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const metrics = performanceService.getPerformanceMetrics();
        
        res.json({
          success: true,
          metrics,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Metrics retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve metrics' });
      }
    }
  );
  
  /**
   * POST /api/biometric/performance/optimize
   * Trigger system optimization
   */
  router.post('/performance/optimize',
    generalLimit,
    authenticateUser,
    requirePermission('admin:optimize'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        await performanceService.optimizeResources();
        
        res.json({
          success: true,
          message: 'System optimization completed',
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ error: 'Optimization failed' });
      }
    }
  );
  
  // ==================== Export Endpoints ====================
  
  /**
   * POST /api/biometric/export/training-data
   * Export data for AI training
   */
  router.post('/export/training-data',
    createRateLimit(60 * 60 * 1000, 5, 'Too many export requests'), // 5/hour
    authenticateUser,
    requirePermission('data:export'),
    [
      body('startDate').isISO8601().withMessage('Start date must be valid ISO8601'),
      body('endDate').isISO8601().withMessage('End date must be valid ISO8601'),
      body('format').optional().isIn(['json', 'csv', 'parquet']).withMessage('Format must be json, csv, or parquet')
    ],
    handleValidationErrors,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { startDate, endDate, format = 'json' } = req.body;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Limit export range
        const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 90) {
          return res.status(400).json({
            error: 'Export range cannot exceed 90 days'
          });
        }
        
        const trainingData = await pipelineService.exportTrainingData(
          req.userId!,
          { start, end }
        );
        
        res.json({
          success: true,
          data: trainingData,
          format,
          exportTimestamp: Date.now()
        });
        
      } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed' });
      }
    }
  );
  
  // ==================== Health Check Endpoints ====================
  
  /**
   * GET /api/biometric/health
   * System health check
   */
  router.get('/health',
    async (req: Request, res: Response) => {
      try {
        const metrics = performanceService.getPerformanceMetrics();
        const isHealthy = assessSystemHealth(metrics);
        
        res.status(isHealthy ? 200 : 503).json({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: Date.now(),
          metrics: {
            memoryUsage: metrics.memoryUsage.heapUsed / 1024 / 1024, // MB
            activeConnections: metrics.activeConnections,
            averageProcessingTime: metrics.averageProcessingTime,
            requestsPerSecond: metrics.requestsPerSecond
          }
        });
        
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: Date.now()
        });
      }
    }
  );
  
  // ==================== WebSocket Status Endpoint ====================
  
  /**
   * GET /api/biometric/websocket/status
   * WebSocket connection status
   */
  router.get('/websocket/status',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const status = wsManager.getUserStatus(req.userId!);
        
        res.json({
          success: true,
          status,
          timestamp: Date.now()
        });
        
      } catch (error) {
        res.status(500).json({ error: 'Failed to get WebSocket status' });
      }
    }
  );
  
  return router;
}

// ==================== WebSocket Manager ====================

class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout;
  
  constructor(
    private wsServer: WebSocketServer,
    private pipelineService: BiometricPipelineService,
    private analyticsService: NeurodivergentAnalyticsService
  ) {
    this.setupWebSocketServer();
    this.startPingPong();
  }
  
  private setupWebSocketServer(): void {
    this.wsServer.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      
      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(clientId, message, ws);
        } catch (error) {
          this.sendError(ws, 'Invalid message format');
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnection(clientId);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(clientId);
      });
      
      // Send connection acknowledgment
      this.sendMessage(ws, {
        type: 'connection_ack',
        clientId,
        timestamp: Date.now()
      });
    });
  }
  
  private async handleMessage(clientId: string, message: WebSocketMessage, ws: WebSocket): Promise<void> {
    switch (message.type) {
      case 'subscribe':
        await this.handleSubscription(clientId, message, ws);
        break;
        
      case 'unsubscribe':
        this.handleUnsubscription(clientId, message);
        break;
        
      case 'analytics_request':
        await this.handleAnalyticsRequest(clientId, message, ws);
        break;
        
      case 'ping':
        this.sendMessage(ws, {
          type: 'pong',
          timestamp: Date.now()
        });
        break;
        
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }
  
  private async handleSubscription(clientId: string, message: WebSocketMessage, ws: WebSocket): Promise<void> {
    if (!message.userId) {
      this.sendError(ws, 'User ID required for subscription');
      return;
    }
    
    // Verify user authentication (in production, validate JWT token)
    const isAuthenticated = await this.verifyUserAuthentication(message.userId, message.data?.token);
    if (!isAuthenticated) {
      this.sendError(ws, 'Authentication failed');
      return;
    }
    
    const client: WebSocketClient = {
      id: clientId,
      userId: message.userId,
      subscriptions: new Set(['biometric_updates', 'analytics_updates']),
      lastActivity: Date.now(),
      ws
    };
    
    this.clients.set(clientId, client);
    
    // Add to user connections
    if (!this.userConnections.has(message.userId)) {
      this.userConnections.set(message.userId, new Set());
    }
    this.userConnections.get(message.userId)!.add(clientId);
    
    this.sendMessage(ws, {
      type: 'subscription_success',
      subscriptions: Array.from(client.subscriptions),
      timestamp: Date.now()
    });
  }
  
  private handleUnsubscription(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && message.data?.subscription) {
      client.subscriptions.delete(message.data.subscription);
    }
  }
  
  private async handleAnalyticsRequest(clientId: string, message: WebSocketMessage, ws: WebSocket): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      this.sendError(ws, 'Client not found');
      return;
    }
    
    try {
      const analytics = await this.pipelineService.getCurrentAnalytics(client.userId);
      
      this.sendMessage(ws, {
        type: 'analytics_response',
        data: analytics,
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendError(ws, 'Failed to retrieve analytics');
    }
  }
  
  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      // Remove from user connections
      const userConnections = this.userConnections.get(client.userId);
      if (userConnections) {
        userConnections.delete(clientId);
        if (userConnections.size === 0) {
          this.userConnections.delete(client.userId);
        }
      }
      
      this.clients.delete(clientId);
    }
  }
  
  broadcastToUser(userId: string, message: any): void {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return;
    
    for (const clientId of userConnections) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(client.ws, message);
      }
    }
  }
  
  broadcastToAll(message: any): void {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(client.ws, message);
      }
    }
  }
  
  getUserStatus(userId: string): any {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) {
      return { connected: false, connections: 0 };
    }
    
    const activeConnections = Array.from(userConnections)
      .map(clientId => this.clients.get(clientId))
      .filter(client => client && client.ws.readyState === WebSocket.OPEN);
    
    return {
      connected: activeConnections.length > 0,
      connections: activeConnections.length,
      lastActivity: Math.max(...activeConnections.map(c => c!.lastActivity))
    };
  }
  
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }
  
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async verifyUserAuthentication(userId: string, token?: string): Promise<boolean> {
    // Implement actual authentication verification
    // This should verify JWT token or session
    return true; // Placeholder
  }
  
  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendMessage(client.ws, {
            type: 'ping',
            timestamp: Date.now()
          });
        }
      }
    }, 30000); // Every 30 seconds
  }
  
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Close all connections
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    
    this.clients.clear();
    this.userConnections.clear();
  }
}

// ==================== Helper Functions ====================

async function verifyAuthToken(token: string): Promise<any> {
  // Implement actual JWT verification
  // This should integrate with your existing auth system
  return {
    id: 'user123',
    permissions: ['analytics:basic', 'data:read'],
    subscription: 'premium'
  };
}

function generatePersonalizedInsights(patterns: any): any {
  return {
    strengths: [
      'High focus periods detected during morning hours',
      'Excellent attention stability during complex tasks'
    ],
    recommendations: [
      'Schedule demanding work between 9-11 AM for optimal performance',
      'Take 5-minute breaks every 45 minutes to maintain cognitive load'
    ],
    patterns: {
      optimalTimes: ['09:00-11:00', '14:00-16:00'],
      attentionCycles: 45, // minutes
      stressManagement: 'breathing_exercises'
    }
  };
}

function assessSystemHealth(metrics: PerformanceMetrics): boolean {
  const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
  const isHealthy = 
    memoryUsagePercent < 85 &&
    metrics.averageProcessingTime < 2000 &&
    metrics.requestsPerSecond < 1000;
    
  return isHealthy;
}

export default createEnhancedBiometricRoutes;