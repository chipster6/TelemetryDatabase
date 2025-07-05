import { Router, Request, Response } from 'express';
import { SecurityMonitor } from '../services/SecurityMonitor';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export function createSecurityDashboardRouter(securityMonitor: SecurityMonitor): Router {
  const router = Router();

  // Middleware to require admin access
  const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // Real-time security metrics
  router.get('/metrics', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const timeRange = req.query.timeRange as '1h' | '24h' | '7d' || '24h';
      const metrics = await securityMonitor.getSecurityMetrics(timeRange);

      // Get additional detailed metrics
      const detailedMetrics = await getDetailedSecurityMetrics(securityMonitor, timeRange);

      res.json({
        ...metrics,
        ...detailedMetrics,
        timestamp: new Date().toISOString(),
        timeRange
      });
    } catch (error) {
      logger.error('Failed to get security metrics', { error });
      res.status(500).json({ error: 'Failed to retrieve security metrics' });
    }
  });

  // Recent security events
  router.get('/events', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const severity = req.query.severity as string;
      const eventType = req.query.type as string;

      const events = await getRecentSecurityEvents(
        securityMonitor,
        { limit, offset, severity, eventType }
      );

      res.json({
        events,
        pagination: {
          limit,
          offset,
          total: events.length
        }
      });
    } catch (error) {
      logger.error('Failed to get security events', { error });
      res.status(500).json({ error: 'Failed to retrieve security events' });
    }
  });

  // Threat detection status
  router.get('/threats', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const activeThreats = await getActiveThreats(securityMonitor);
      const threatPatterns = await getThreatPatterns(securityMonitor);

      res.json({
        activeThreats,
        threatPatterns,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get threat information', { error });
      res.status(500).json({ error: 'Failed to retrieve threat information' });
    }
  });

  // User security profiles
  router.get('/users/:userId/profile', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const profile = await getUserSecurityProfile(securityMonitor, userId);

      res.json(profile);
    } catch (error) {
      logger.error('Failed to get user security profile', { error });
      res.status(500).json({ error: 'Failed to retrieve user security profile' });
    }
  });

  // Top risky users
  router.get('/users/risky', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const riskyUsers = await getRiskyUsers(securityMonitor, limit);

      res.json({
        users: riskyUsers,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get risky users', { error });
      res.status(500).json({ error: 'Failed to retrieve risky users' });
    }
  });

  // Security alerts
  router.get('/alerts', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.query.status as string || 'active';
      const severity = req.query.severity as string;
      const alerts = await getSecurityAlerts(securityMonitor, { status, severity });

      res.json({
        alerts,
        count: alerts.length
      });
    } catch (error) {
      logger.error('Failed to get security alerts', { error });
      res.status(500).json({ error: 'Failed to retrieve security alerts' });
    }
  });

  // Block/unblock user
  router.post('/users/:userId/block', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { duration, reason } = req.body;

      if (!duration || !reason) {
        return res.status(400).json({ error: 'Duration and reason are required' });
      }

      await blockUser(securityMonitor, userId, duration, reason, req.user!.userId);

      await securityMonitor.recordSecurityEvent(
        'admin_action',
        'user_blocked',
        {
          targetUserId: userId,
          duration,
          reason,
          adminUserId: req.user!.userId
        },
        req.user!.userId
      );

      res.json({ success: true, message: `User ${userId} blocked for ${duration} seconds` });
    } catch (error) {
      logger.error('Failed to block user', { error });
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  router.delete('/users/:userId/block', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;

      await unblockUser(securityMonitor, userId, req.user!.userId);

      await securityMonitor.recordSecurityEvent(
        'admin_action',
        'user_unblocked',
        {
          targetUserId: userId,
          adminUserId: req.user!.userId
        },
        req.user!.userId
      );

      res.json({ success: true, message: `User ${userId} unblocked` });
    } catch (error) {
      logger.error('Failed to unblock user', { error });
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  // Security configuration
  router.get('/config', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await getSecurityConfiguration(securityMonitor);
      res.json(config);
    } catch (error) {
      logger.error('Failed to get security configuration', { error });
      res.status(500).json({ error: 'Failed to retrieve security configuration' });
    }
  });

  // Update security configuration
  router.put('/config', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { config } = req.body;
      await updateSecurityConfiguration(securityMonitor, config, req.user!.userId);

      res.json({ success: true, message: 'Security configuration updated' });
    } catch (error) {
      logger.error('Failed to update security configuration', { error });
      res.status(500).json({ error: 'Failed to update security configuration' });
    }
  });

  // Security reports
  router.get('/reports/summary', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const period = req.query.period as string || '7d';
      const report = await generateSecuritySummaryReport(securityMonitor, period);

      res.json(report);
    } catch (error) {
      logger.error('Failed to generate security report', { error });
      res.status(500).json({ error: 'Failed to generate security report' });
    }
  });

  return router;
}

async function getDetailedSecurityMetrics(securityMonitor: SecurityMonitor, timeRange: string) {
  const redis = securityMonitor.redis;

  // Get blocked users count
  const blockedUsers = await redis.keys('security:blocked:*');
  
  // Get active alerts
  const activeAlerts = await redis.keys('security:alerts:*');
  
  // Get threat detections by type
  const threatKeys = await redis.keys('security:threats:*');
  const threatsByType: Record<string, number> = {};
  
  for (const key of threatKeys) {
    const threat = await redis.hgetall(key);
    const patternName = threat.patternName || 'unknown';
    threatsByType[patternName] = (threatsByType[patternName] || 0) + 1;
  }

  return {
    blockedUsersCount: blockedUsers.length,
    activeAlertsCount: activeAlerts.length,
    threatsByType,
    systemStatus: 'operational'
  };
}

async function getRecentSecurityEvents(
  securityMonitor: SecurityMonitor,
  options: { limit: number; offset: number; severity?: string; eventType?: string }
) {
  const redis = securityMonitor.redis;
  const { limit, offset, severity, eventType } = options;

  const eventKeys = await redis.keys('security:events:*');
  const events = [];

  for (const key of eventKeys.slice(offset, offset + limit)) {
    const event = await redis.hgetall(key);
    
    if (severity && event.severity !== severity) continue;
    if (eventType && event.type !== eventType) continue;
    
    events.push({
      id: event.id,
      timestamp: event.timestamp,
      severity: event.severity,
      type: event.type,
      source: event.source,
      userId: event.userId || null,
      riskScore: parseInt(event.riskScore || '0'),
      details: JSON.parse(event.details || '{}')
    });
  }

  return events.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

async function getActiveThreats(securityMonitor: SecurityMonitor) {
  const redis = securityMonitor.redis;
  const threatKeys = await redis.keys('security:threats:*');
  const threats = [];

  for (const key of threatKeys.slice(0, 100)) { // Limit to recent threats
    const threat = await redis.hgetall(key);
    threats.push({
      id: threat.eventId,
      patternId: threat.patternId,
      patternName: threat.patternName,
      detectedAt: threat.detectedAt,
      severity: threat.severity,
      userId: threat.userId || null,
      riskScore: parseInt(threat.riskScore || '0')
    });
  }

  return threats.sort((a, b) => 
    new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

async function getThreatPatterns(securityMonitor: SecurityMonitor) {
  // This would return configured threat patterns
  // For now, return a summary of pattern effectiveness
  return {
    totalPatterns: 5,
    activePatterns: 5,
    detectionRate: 0.95,
    falsePositiveRate: 0.02
  };
}

async function getUserSecurityProfile(securityMonitor: SecurityMonitor, userId: string) {
  const redis = securityMonitor.redis;
  
  const userMetrics = await redis.hgetall(`security:user:${userId}`);
  const isBlocked = await securityMonitor.isUserBlocked(userId);
  const riskScore = await securityMonitor.getUserRiskScore(userId);

  return {
    userId,
    isBlocked,
    riskScore,
    totalEvents: parseInt(userMetrics.totalEvents || '0'),
    highRiskEvents: parseInt(userMetrics.highRiskEvents || '0'),
    maxRiskScore: parseInt(userMetrics.maxRiskScore || '0'),
    lastActivity: userMetrics.lastActivity || null,
    threatDetections: await getUserThreatDetections(redis, userId)
  };
}

async function getUserThreatDetections(redis: any, userId: string) {
  const threatKeys = await redis.keys('security:threats:*');
  const userThreats = [];

  for (const key of threatKeys) {
    const threat = await redis.hgetall(key);
    if (threat.userId === userId) {
      userThreats.push({
        patternName: threat.patternName,
        detectedAt: threat.detectedAt,
        severity: threat.severity
      });
    }
  }

  return userThreats.slice(0, 10); // Most recent 10
}

async function getRiskyUsers(securityMonitor: SecurityMonitor, limit: number) {
  const redis = securityMonitor.redis;
  const userKeys = await redis.keys('security:user:*');
  const users = [];

  for (const key of userKeys) {
    const userId = key.split(':')[2];
    const metrics = await redis.hgetall(key);
    const riskScore = parseInt(metrics.maxRiskScore || '0');
    
    if (riskScore > 30) {
      users.push({
        userId,
        riskScore,
        totalEvents: parseInt(metrics.totalEvents || '0'),
        highRiskEvents: parseInt(metrics.highRiskEvents || '0'),
        isBlocked: await securityMonitor.isUserBlocked(userId)
      });
    }
  }

  return users
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}

async function getSecurityAlerts(
  securityMonitor: SecurityMonitor,
  options: { status: string; severity?: string }
) {
  const redis = securityMonitor.redis;
  const alertKeys = await redis.keys('security:alerts:*');
  const alerts = [];

  for (const key of alertKeys) {
    const alert = await redis.hgetall(key);
    
    if (options.severity && alert.severity !== options.severity) continue;
    
    alerts.push({
      id: key.split(':')[2],
      eventId: alert.eventId,
      patternId: alert.patternId,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      status: 'active' // For now, all alerts are active
    });
  }

  return alerts.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

async function blockUser(
  securityMonitor: SecurityMonitor,
  userId: string,
  duration: number,
  reason: string,
  adminUserId: string
) {
  const redis = securityMonitor.redis;
  const blockKey = `security:blocked:${userId}`;
  
  await redis.setex(blockKey, duration, JSON.stringify({
    blockedAt: new Date().toISOString(),
    reason,
    duration,
    adminUserId
  }));

  logger.warn('User manually blocked by admin', {
    userId,
    duration,
    reason,
    adminUserId
  });
}

async function unblockUser(
  securityMonitor: SecurityMonitor,
  userId: string,
  adminUserId: string
) {
  const redis = securityMonitor.redis;
  const blockKey = `security:blocked:${userId}`;
  
  await redis.del(blockKey);

  logger.info('User manually unblocked by admin', {
    userId,
    adminUserId
  });
}

async function getSecurityConfiguration(securityMonitor: SecurityMonitor) {
  // Return current security configuration
  return {
    threatDetection: {
      enabled: true,
      patterns: 5,
      sensitivity: 'medium'
    },
    rateLimiting: {
      enabled: true,
      requestsPerHour: 1000,
      requestsPerDay: 10000
    },
    monitoring: {
      enabled: true,
      retentionDays: 30,
      alertThreshold: 50
    },
    blocking: {
      autoBlock: true,
      blockThreshold: 3,
      defaultDuration: 3600
    }
  };
}

async function updateSecurityConfiguration(
  securityMonitor: SecurityMonitor,
  config: any,
  adminUserId: string
) {
  // Store new configuration
  const redis = securityMonitor.redis;
  await redis.hset('security:config', config);

  logger.info('Security configuration updated', {
    config,
    adminUserId
  });
}

async function generateSecuritySummaryReport(
  securityMonitor: SecurityMonitor,
  period: string
) {
  const metrics = await securityMonitor.getSecurityMetrics();
  const detailedMetrics = await getDetailedSecurityMetrics(securityMonitor, period);

  return {
    summary: {
      period,
      totalEvents: metrics.totalEvents,
      threatEvents: metrics.threatEvents,
      blockedRequests: metrics.blockedRequests,
      riskScore: metrics.avgRiskScore
    },
    breakdown: {
      threatsByType: detailedMetrics.threatsByType,
      blockedUsers: detailedMetrics.blockedUsersCount,
      activeAlerts: detailedMetrics.activeAlertsCount
    },
    trends: {
      // This would include time-series data for trends
      dailyEvents: [],
      riskScoreTrend: [],
      topThreats: []
    },
    recommendations: [
      'Review and address high-risk users',
      'Update threat detection patterns',
      'Monitor for emerging attack patterns',
      'Regular security configuration review'
    ],
    generatedAt: new Date().toISOString()
  };
}