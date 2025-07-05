import { Router, Request, Response } from 'express';
import { LLMService } from '../services/LLMService.js';
import { AuditLogger, AuditEventType } from '../services/AuditLogger.js';
import { createSecurityRoutes } from './security-routes.js';
import { createAdminRoutes } from './admin-routes.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const GenerateRequestSchema = z.object({
  userId: z.string().min(1),
  prompt: z.string().min(1),
  stream: z.boolean().optional().default(false)
});

const HealthCheckSchema = z.object({
  includeModels: z.boolean().optional().default(false)
});

interface AuthenticatedRequest extends Request {
  userId?: string;
  startTime?: number;
  metrics?: {
    startTime: number;
    tokensUsed: number;
    promptLength: number;
    memoryUsage: number;
  };
  resourceLimits?: {
    maxTokens: number;
    maxResponseLength: number;
    timeoutMs: number;
  };
}

interface SecurityComponents {
  resourceLimits: any;
  abuseDetection: any;
  userRateLimit: any;
  promptSecurity: any;
}

export function createRoutes(
  llmService: LLMService, 
  auditLogger: AuditLogger,
  security?: SecurityComponents
): Router {
  const router = Router();

  // Middleware to extract user info and timing
  router.use((req: AuthenticatedRequest, res, next) => {
    req.startTime = Date.now();
    next();
  });

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const { includeModels } = HealthCheckSchema.parse(req.query);
      
      const status = llmService.getModelStatus();
      const health = {
        status: status.initialized ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        telemetryConnected: status.telemetryConnected,
        ...(includeModels && { models: status.loadedModels })
      };

      res.status(status.initialized ? 200 : 503).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Main generation endpoint
  router.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
    const startTime = req.startTime || Date.now();
    let success = false;
    let tokensUsed = 0;
    let response = '';
    let cognitiveAdaptations: string[] = [];

    try {
      const { userId, prompt, stream } = GenerateRequestSchema.parse(req.body);
      req.userId = userId;

      if (stream) {
        // Set up Server-Sent Events for streaming
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        let fullResponse = '';

        try {
          fullResponse = await llmService.generateStream(userId, prompt, (token: string) => {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          });

          response = fullResponse;
          success = true;

          res.write(`data: ${JSON.stringify({ 
            done: true, 
            response: fullResponse,
            metadata: {
              timestamp: new Date().toISOString(),
              userId
            }
          })}\n\n`);
        } catch (error) {
          res.write(`data: ${JSON.stringify({ 
            error: 'Generation failed',
            done: true 
          })}\n\n`);
          throw error;
        } finally {
          res.end();
        }
      } else {
        // Regular JSON response
        const llmResponse = await llmService.generateWithBiometricContext(prompt, userId);
        response = llmResponse.response;
        tokensUsed = llmResponse.metadata.tokensUsed || 0;
        cognitiveAdaptations = llmResponse.metadata.cognitiveAdaptations || [];
        success = true;

        // Track token consumption for resource limits
        if (req.metrics && security?.resourceLimits) {
          req.metrics.tokensUsed = tokensUsed;
        }
        
        res.json({
          success: true,
          data: llmResponse,
          timestamp: new Date().toISOString()
        });
      }

      // Apply post-request resource tracking
      if (security?.resourceLimits && tokensUsed > 0) {
        await security.resourceLimits.postRequestLimits()(req, res, () => {});
      }
    } catch (error) {
      logger.error('Generation request failed:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Generation failed'
        });
      }
    } finally {
      // Audit log the LLM generation attempt
      if (req.userId && req.body?.prompt) {
        try {
          await auditLogger.logLLMGeneration({
            userId: req.userId,
            prompt: req.body.prompt,
            response: response,
            model: 'mistral:7b-instruct-q4',
            tokensUsed: tokensUsed,
            cognitiveAdaptations: cognitiveAdaptations,
            sourceIp: req.ip || 'unknown',
            userAgent: req.get('User-Agent'),
            processingTimeMs: Date.now() - startTime
          });
        } catch (auditError) {
          logger.error('Failed to log audit event:', auditError);
        }
      }
    }
  });

  // Model management endpoints
  router.get('/models', async (req: Request, res: Response) => {
    try {
      const status = llmService.getModelStatus();
      res.json({
        success: true,
        models: status.loadedModels,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve model information'
      });
    }
  });

  // Biometric integration status
  router.get('/telemetry-status', async (req: Request, res: Response) => {
    try {
      const status = llmService.getModelStatus();
      res.json({
        success: true,
        telemetryConnected: status.telemetryConnected,
        initialized: status.initialized,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get telemetry status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve telemetry status'
      });
    }
  });

  // Mount security routes
  router.use(createSecurityRoutes(llmService, auditLogger));

  // Mount admin routes (if security components are available)
  if (security) {
    router.use(createAdminRoutes(llmService, auditLogger, security));
  }

  return router;
}