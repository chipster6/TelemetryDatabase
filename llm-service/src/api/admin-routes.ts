import { Router, Request, Response } from 'express';
import { LLMService } from '../services/LLMService.js';
import { AuditLogger, AuditEventType } from '../services/AuditLogger.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const UnblockUserSchema = z.object({
  userId: z.string().min(1)
});

const GetUserStatsSchema = z.object({
  userId: z.string().min(1)
});

interface AuthenticatedRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

interface SecurityComponents {
  resourceLimits: any;
  abuseDetection: any;
  userRateLimit: any;
  promptSecurity: any;
}

// Simple admin auth middleware (replace with proper auth in production)
const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: any) => {
  const adminToken = req.headers['x-admin-token'];
  const validAdminToken = process.env.ADMIN_API_TOKEN;
  
  if (!validAdminToken) {
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not configured'
    });
  }
  
  if (!adminToken || adminToken !== validAdminToken) {
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required'
    });
  }
  
  req.isAdmin = true;
  req.userId = 'admin';
  next();
};

export function createAdminRoutes(
  llmService: LLMService, 
  auditLogger: AuditLogger,
  security: SecurityComponents
): Router {
  const router = Router();

  // Resource usage overview
  router.get('/admin/resource-metrics', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const resourceMetrics = security.resourceLimits.getResourceMetrics();
      const abuseMetrics = security.abuseDetection.getAbuseMetrics();
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'resource_metrics_check',
        resource: 'system_monitoring',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'low'
      });
      
      res.json({
        success: true,
        data: {
          resources: resourceMetrics,
          abuse: abuseMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get resource metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve resource metrics'
      });
    }
  });

  // User-specific resource usage
  router.get('/admin/user-stats/:userId', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      const tokenUsage = await security.resourceLimits.getUserTokenUsage(userId);
      const riskProfile = await security.abuseDetection.getUserRiskProfile(userId);
      const rateLimitStats = await security.userRateLimit.getStats(userId);
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'user_stats_check',
        resource: 'user_monitoring',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'low',
        metadata: { targetUserId: userId }
      });
      
      res.json({
        success: true,
        data: {
          userId,
          tokenUsage,
          riskProfile,
          rateLimitStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get user stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user statistics'
      });
    }
  });

  // Unblock user
  router.post('/admin/unblock-user', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = UnblockUserSchema.parse(req.body);
      
      await security.abuseDetection.unblockUser(userId);
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'user_unblocked',
        resource: 'user_management',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'medium',
        metadata: { targetUserId: userId }
      });
      
      res.json({
        success: true,
        message: `User ${userId} has been unblocked`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to unblock user:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to unblock user'
        });
      }
    }
  });

  // System health and security status
  router.get('/admin/security-status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const systemStatus = llmService.getModelStatus();
      const securityStatus = llmService.getSecurityStatus();
      const resourceMetrics = security.resourceLimits.getResourceMetrics();
      const abuseMetrics = security.abuseDetection.getAbuseMetrics();
      
      const overallHealth = {
        system: {
          initialized: systemStatus.initialized,
          telemetryConnected: systemStatus.telemetryConnected,
          secureConnection: systemStatus.secureConnection,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        },
        security: {
          certificatePinning: securityStatus.certificatePinningEnabled,
          activeRequests: resourceMetrics.totalActiveRequests,
          blockedUsers: abuseMetrics.blockedUsers,
          highRiskUsers: abuseMetrics.highRiskUsers,
          recentAbuseEvents: abuseMetrics.recentAbuseEvents
        },
        resources: {
          totalActiveRequests: resourceMetrics.activeRequests,
          memoryUsage: resourceMetrics.memoryUsage,
          userConcurrentRequests: Object.keys(resourceMetrics.userConcurrentRequests).length
        }
      };
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'security_status_check',
        resource: 'system_monitoring',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'low'
      });
      
      res.json({
        success: true,
        data: overallHealth,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get security status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security status'
      });
    }
  });

  // Emergency shutdown
  router.post('/admin/emergency-shutdown', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'emergency_shutdown_requested',
        resource: 'system_control',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'critical'
      });
      
      res.json({
        success: true,
        message: 'Emergency shutdown initiated',
        timestamp: new Date().toISOString()
      });
      
      // Shutdown after response is sent
      setTimeout(() => {
        logger.warn('Emergency shutdown requested by admin', { adminUserId: req.userId });
        process.kill(process.pid, 'SIGTERM');
      }, 1000);
      
    } catch (error) {
      logger.error('Failed to initiate emergency shutdown:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate emergency shutdown'
      });
    }
  });

  // Abuse detection configuration
  router.get('/admin/abuse-config', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Return current abuse detection configuration (without sensitive details)
      const config = {
        maxRequestBurstSize: 15,
        enableContentAnalysis: true,
        warningThreshold: 30,
        temporaryBlockThreshold: 60,
        permanentBlockThreshold: 120
      };
      
      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get abuse config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve abuse detection configuration'
      });
    }
  });

  // Resource limits configuration
  router.get('/admin/resource-config', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Return current resource limits configuration
      const config = {
        maxTokensPerRequest: 8192,
        maxConcurrentRequests: process.env.NODE_ENV === 'production' ? 50 : 100,
        maxConcurrentRequestsPerUser: 3,
        maxPromptLength: 50000,
        maxResponseLength: 100000,
        maxProcessingTimeMs: 300000
      };
      
      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get resource config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve resource limits configuration'
      });
    }
  });

  return router;
}