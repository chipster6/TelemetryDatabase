import { Router, Request, Response } from 'express';
import { LLMService } from '../services/LLMService.js';
import { AuditLogger, AuditEventType } from '../services/AuditLogger.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const UpdateCertificatePinsSchema = z.object({
  fingerprints: z.array(z.string().length(64, 'Certificate fingerprints must be 64 characters (SHA-256 hex)'))
    .min(1, 'At least one certificate fingerprint is required')
    .max(10, 'Maximum 10 certificate fingerprints allowed')
});

const TestConnectionSchema = z.object({
  timeout: z.number().min(1000).max(60000).optional().default(30000)
});

interface AuthenticatedRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
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

export function createSecurityRoutes(llmService: LLMService, auditLogger: AuditLogger): Router {
  const router = Router();

  // Get security status
  router.get('/security/status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const securityStatus = llmService.getSecurityStatus();
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'security_status_check',
        resource: 'ollama_security',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'low'
      });
      
      res.json({
        success: true,
        data: securityStatus,
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

  // Update certificate pins
  router.post('/security/certificate-pins', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fingerprints } = UpdateCertificatePinsSchema.parse(req.body);
      
      // Validate fingerprint format (SHA-256 hex)
      const invalidFingerprints = fingerprints.filter(fp => 
        !/^[A-Fa-f0-9]{64}$/.test(fp)
      );
      
      if (invalidFingerprints.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid certificate fingerprint format',
          invalidFingerprints
        });
      }

      await llmService.updateCertificatePins(fingerprints);
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'certificate_pins_updated',
        resource: 'ollama_security',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'medium',
        metadata: {
          fingerprintCount: fingerprints.length,
          fingerprints: fingerprints
        }
      });
      
      res.json({
        success: true,
        message: 'Certificate pins updated successfully',
        data: {
          fingerprintCount: fingerprints.length,
          updated: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update certificate pins:', error);
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'certificate_pins_update_failed',
        resource: 'ollama_security',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: false,
        risk_level: 'high',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      } else {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update certificate pins'
        });
      }
    }
  });

  // Test secure connection
  router.post('/security/test-connection', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { timeout } = TestConnectionSchema.parse(req.body);
      
      const testResult = await llmService.testSecureConnection();
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'secure_connection_test',
        resource: 'ollama_security',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: testResult.success,
        risk_level: testResult.success ? 'low' : 'medium',
        metadata: {
          testResult,
          timeout
        }
      });
      
      res.json({
        success: true,
        data: testResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to test secure connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test secure connection'
      });
    }
  });

  // Get connection statistics
  router.get('/security/connection-stats', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const modelStatus = llmService.getModelStatus();
      
      if (!modelStatus.secureConnection) {
        return res.status(400).json({
          success: false,
          error: 'Secure connection not enabled'
        });
      }
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'connection_stats_check',
        resource: 'ollama_security',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'low'
      });
      
      res.json({
        success: true,
        data: {
          connectionStats: modelStatus.connectionStats,
          securityConfig: modelStatus.securityConfig
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get connection stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve connection statistics'
      });
    }
  });

  // Security audit endpoint
  router.get('/security/audit', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const securityStatus = llmService.getSecurityStatus();
      const modelStatus = llmService.getModelStatus();
      
      const auditReport = {
        certificatePinning: {
          enabled: securityStatus.certificatePinningEnabled,
          certificateCount: securityStatus.securityConfig?.pinnedCertificateCount || 0,
          lastValidation: securityStatus.connectionStats?.lastConnectionTime
        },
        connectionSecurity: {
          totalConnections: securityStatus.connectionStats?.totalConnections || 0,
          successfulConnections: securityStatus.connectionStats?.successfulConnections || 0,
          failedConnections: securityStatus.connectionStats?.failedConnections || 0,
          certificateErrors: securityStatus.connectionStats?.certificateErrors || 0,
          successRate: securityStatus.connectionStats?.totalConnections > 0 
            ? (securityStatus.connectionStats.successfulConnections / securityStatus.connectionStats.totalConnections) * 100 
            : 0
        },
        configuration: {
          verifyHostname: securityStatus.securityConfig?.verifyHostname,
          timeout: securityStatus.securityConfig?.timeout,
          clientCertAuth: !!(securityStatus.securityConfig?.clientCertPath),
          customCA: !!(securityStatus.securityConfig?.caCertPath)
        },
        recommendations: [] as string[]
      };
      
      // Add security recommendations
      if (!securityStatus.certificatePinningEnabled) {
        auditReport.recommendations.push('Enable certificate pinning for enhanced security');
      }
      
      if (auditReport.connectionSecurity.certificateErrors > 0) {
        auditReport.recommendations.push('Review certificate errors and validate pinned certificates');
      }
      
      if (auditReport.connectionSecurity.successRate < 95) {
        auditReport.recommendations.push('Investigate connection failures - success rate below 95%');
      }
      
      await auditLogger.logEvent({
        userId: req.userId,
        eventType: AuditEventType.SYSTEM_ADMIN,
        action: 'security_audit_report',
        resource: 'ollama_security',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        risk_level: 'low',
        metadata: {
          auditSummary: {
            certificatePinningEnabled: auditReport.certificatePinning.enabled,
            connectionSuccessRate: auditReport.connectionSecurity.successRate,
            recommendationCount: auditReport.recommendations.length
          }
        }
      });
      
      res.json({
        success: true,
        data: auditReport,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to generate security audit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate security audit report'
      });
    }
  });

  return router;
}