import { Redis } from 'ioredis';
import winston from 'winston';
import { EventEmitter } from 'events';

interface SecurityEvent {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  source: string;
  userId?: string;
  details: Record<string, any>;
  riskScore: number;
}

interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | ((event: SecurityEvent) => boolean);
  severity: SecurityEvent['severity'];
  actions: ThreatAction[];
}

interface ThreatAction {
  type: 'block' | 'alert' | 'log' | 'rate_limit' | 'notify';
  parameters: Record<string, any>;
}

interface SecurityMetrics {
  totalEvents: number;
  threatEvents: number;
  blockedRequests: number;
  suspiciousUsers: number;
  avgRiskScore: number;
}

export class SecurityMonitor extends EventEmitter {
  public redis: Redis;
  private logger: winston.Logger;
  private threatPatterns: Map<string, ThreatPattern> = new Map();
  private isMonitoring: boolean = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(redis: Redis, logger: winston.Logger) {
    super();
    this.redis = redis;
    this.logger = logger;
    this.initializeThreatPatterns();
  }

  private initializeThreatPatterns(): void {
    const patterns: ThreatPattern[] = [
      {
        id: 'prompt_injection',
        name: 'Prompt Injection Attack',
        description: 'Detects potential prompt injection attempts',
        pattern: /(?:ignore|forget|system|admin|override|bypass|jailbreak|role|instruction)/i,
        severity: 'high',
        actions: [
          { type: 'block', parameters: { duration: 3600 } },
          { type: 'alert', parameters: { channel: 'security' } },
          { type: 'log', parameters: { level: 'warn' } }
        ]
      },
      {
        id: 'excessive_requests',
        name: 'Excessive Request Pattern',
        description: 'Detects unusual request volume from single user',
        pattern: (event: SecurityEvent) => {
          return event.type === 'request' && 
                 event.details.requestCount > 100 && 
                 event.details.timeWindow < 60;
        },
        severity: 'medium',
        actions: [
          { type: 'rate_limit', parameters: { duration: 300, limit: 10 } },
          { type: 'log', parameters: { level: 'warn' } }
        ]
      },
      {
        id: 'authentication_failure',
        name: 'Authentication Failure Pattern',
        description: 'Detects brute force authentication attempts',
        pattern: (event: SecurityEvent) => {
          return event.type === 'auth_failure' && 
                 event.details.failureCount >= 5;
        },
        severity: 'high',
        actions: [
          { type: 'block', parameters: { duration: 1800 } },
          { type: 'alert', parameters: { channel: 'security' } }
        ]
      },
      {
        id: 'data_exfiltration',
        name: 'Data Exfiltration Attempt',
        description: 'Detects potential data exfiltration patterns',
        pattern: /(?:export|download|copy|extract|dump|backup|archive)/i,
        severity: 'critical',
        actions: [
          { type: 'block', parameters: { duration: 7200 } },
          { type: 'alert', parameters: { channel: 'critical' } },
          { type: 'notify', parameters: { escalate: true } }
        ]
      },
      {
        id: 'anomalous_behavior',
        name: 'Anomalous User Behavior',
        description: 'Detects behavioral anomalies using ML patterns',
        pattern: (event: SecurityEvent) => {
          return event.riskScore > 85;
        },
        severity: 'medium',
        actions: [
          { type: 'log', parameters: { level: 'info' } },
          { type: 'alert', parameters: { channel: 'anomaly' } }
        ]
      }
    ];

    patterns.forEach(pattern => {
      this.threatPatterns.set(pattern.id, pattern);
    });
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.logger.info('Security monitoring started');

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute

    // Listen for security events from Redis streams
    this.subscribeToSecurityEvents();
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.logger.info('Security monitoring stopped');
  }

  async recordSecurityEvent(
    type: string,
    source: string,
    details: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity: 'low',
      type,
      source,
      userId,
      details,
      riskScore: this.calculateRiskScore(type, details, userId)
    };

    // Store event in Redis
    await this.storeEvent(event);

    // Analyze for threats
    await this.analyzeEvent(event);

    this.emit('securityEvent', event);
  }

  private calculateRiskScore(
    type: string,
    details: Record<string, any>,
    userId?: string
  ): number {
    let score = 0;

    // Base scores by event type
    const typeScores: Record<string, number> = {
      'auth_failure': 20,
      'request': 5,
      'admin_access': 15,
      'prompt_injection': 50,
      'rate_limit_exceeded': 25,
      'suspicious_content': 30
    };

    score += typeScores[type] || 10;

    // Increase score for suspicious patterns
    if (details.prompt && typeof details.prompt === 'string') {
      const suspiciousPatterns = [
        /system|admin|root|bypass/i,
        /password|token|secret|key/i,
        /inject|exploit|hack|attack/i
      ];

      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(details.prompt)) {
          score += 15;
        }
      });
    }

    // Increase score for repeated failures
    if (details.failureCount && details.failureCount > 3) {
      score += details.failureCount * 5;
    }

    // Increase score for high request rates
    if (details.requestRate && details.requestRate > 50) {
      score += Math.min(details.requestRate, 200) / 4;
    }

    return Math.min(score, 100);
  }

  private async storeEvent(event: SecurityEvent): Promise<void> {
    const key = `security:events:${event.id}`;
    const streamKey = 'security:stream';

    // Store full event details
    await this.redis.hset(key, {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      severity: event.severity,
      type: event.type,
      source: event.source,
      userId: event.userId || '',
      details: JSON.stringify(event.details),
      riskScore: event.riskScore
    });

    // Add to stream for real-time processing
    await this.redis.xadd(streamKey, '*', 'eventId', event.id);

    // Set expiry for events (30 days)
    await this.redis.expire(key, 30 * 24 * 60 * 60);

    // Update user-specific metrics if userId provided
    if (event.userId) {
      await this.updateUserMetrics(event.userId, event);
    }
  }

  private async updateUserMetrics(userId: string, event: SecurityEvent): Promise<void> {
    const key = `security:user:${userId}`;
    
    await this.redis.hincrby(key, 'totalEvents', 1);
    await this.redis.hincrby(key, `${event.type}Count`, 1);
    
    if (event.riskScore > 50) {
      await this.redis.hincrby(key, 'highRiskEvents', 1);
    }

    // Update max risk score
    const currentMaxRisk = await this.redis.hget(key, 'maxRiskScore');
    if (!currentMaxRisk || event.riskScore > parseInt(currentMaxRisk)) {
      await this.redis.hset(key, 'maxRiskScore', event.riskScore);
    }

    // Set expiry for user metrics (7 days)
    await this.redis.expire(key, 7 * 24 * 60 * 60);
  }

  private async analyzeEvent(event: SecurityEvent): Promise<void> {
    for (const [patternId, pattern] of this.threatPatterns) {
      let matches = false;

      if (pattern.pattern instanceof RegExp) {
        const textContent = JSON.stringify(event.details);
        matches = pattern.pattern.test(textContent);
      } else if (typeof pattern.pattern === 'function') {
        matches = pattern.pattern(event);
      }

      if (matches) {
        await this.handleThreatDetection(event, pattern);
      }
    }
  }

  private async handleThreatDetection(
    event: SecurityEvent,
    pattern: ThreatPattern
  ): Promise<void> {
    this.logger.warn('Threat detected', {
      eventId: event.id,
      patternId: pattern.id,
      patternName: pattern.name,
      severity: pattern.severity,
      userId: event.userId,
      riskScore: event.riskScore
    });

    // Update event severity
    event.severity = pattern.severity;

    // Execute threat actions
    for (const action of pattern.actions) {
      await this.executeThreatAction(action, event, pattern);
    }

    // Store threat detection
    await this.storeThreatDetection(event, pattern);

    this.emit('threatDetected', { event, pattern });
  }

  private async executeThreatAction(
    action: ThreatAction,
    event: SecurityEvent,
    pattern: ThreatPattern
  ): Promise<void> {
    try {
      switch (action.type) {
        case 'block':
          if (event.userId) {
            await this.blockUser(event.userId, action.parameters.duration);
          }
          break;

        case 'rate_limit':
          if (event.userId) {
            await this.applyRateLimit(event.userId, action.parameters);
          }
          break;

        case 'alert':
          await this.sendAlert(event, pattern, action.parameters);
          break;

        case 'log':
          this.logger.log(action.parameters.level || 'info', 'Security action executed', {
            action: action.type,
            eventId: event.id,
            patternId: pattern.id
          });
          break;

        case 'notify':
          await this.sendNotification(event, pattern, action.parameters);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to execute threat action', {
        action: action.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async blockUser(userId: string, duration: number): Promise<void> {
    const key = `security:blocked:${userId}`;
    await this.redis.setex(key, duration, JSON.stringify({
      blockedAt: new Date().toISOString(),
      reason: 'Threat detection',
      duration
    }));

    this.logger.warn('User blocked due to security threat', {
      userId,
      duration
    });
  }

  private async applyRateLimit(
    userId: string,
    parameters: Record<string, any>
  ): Promise<void> {
    const key = `security:ratelimit:${userId}`;
    await this.redis.setex(key, parameters.duration, parameters.limit);

    this.logger.info('Rate limit applied to user', {
      userId,
      limit: parameters.limit,
      duration: parameters.duration
    });
  }

  private async sendAlert(
    event: SecurityEvent,
    pattern: ThreatPattern,
    parameters: Record<string, any>
  ): Promise<void> {
    // Store alert for dashboard/notification system
    const alertKey = `security:alerts:${Date.now()}`;
    await this.redis.hset(alertKey, {
      eventId: event.id,
      patternId: pattern.id,
      severity: event.severity,
      channel: parameters.channel || 'general',
      timestamp: new Date().toISOString(),
      message: `Security threat detected: ${pattern.name}`
    });

    await this.redis.expire(alertKey, 7 * 24 * 60 * 60); // 7 days
  }

  private async sendNotification(
    event: SecurityEvent,
    pattern: ThreatPattern,
    parameters: Record<string, any>
  ): Promise<void> {
    // Implementation would integrate with notification system (email, Slack, etc.)
    this.logger.error('Critical security notification', {
      eventId: event.id,
      patternId: pattern.id,
      escalate: parameters.escalate,
      userId: event.userId,
      details: event.details
    });
  }

  private async storeThreatDetection(
    event: SecurityEvent,
    pattern: ThreatPattern
  ): Promise<void> {
    const key = `security:threats:${event.id}`;
    await this.redis.hset(key, {
      eventId: event.id,
      patternId: pattern.id,
      patternName: pattern.name,
      detectedAt: new Date().toISOString(),
      severity: pattern.severity,
      userId: event.userId || '',
      riskScore: event.riskScore
    });

    await this.redis.expire(key, 30 * 24 * 60 * 60); // 30 days
  }

  private async subscribeToSecurityEvents(): Promise<void> {
    // Implementation for real-time event stream processing
    const streamKey = 'security:stream';
    
    // This would run in a separate process/worker in production
    setInterval(async () => {
      if (!this.isMonitoring) return;

      try {
        const events = await this.redis.xread('BLOCK', '1000', 'STREAMS', streamKey, '$');
        // Process events from stream
      } catch (error) {
        this.logger.error('Error reading security event stream', { error });
      }
    }, 5000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: SecurityMetrics = {
        totalEvents: 0,
        threatEvents: 0,
        blockedRequests: 0,
        suspiciousUsers: 0,
        avgRiskScore: 0
      };

      // Collect metrics from Redis
      const keys = await this.redis.keys('security:events:*');
      metrics.totalEvents = keys.length;

      const threatKeys = await this.redis.keys('security:threats:*');
      metrics.threatEvents = threatKeys.length;

      const blockedKeys = await this.redis.keys('security:blocked:*');
      metrics.blockedRequests = blockedKeys.length;

      // Store current metrics
      await this.redis.hset('security:metrics:current', metrics);

      this.emit('metricsCollected', metrics);
    } catch (error) {
      this.logger.error('Error collecting security metrics', { error });
    }
  }

  async getSecurityMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<SecurityMetrics> {
    const metrics = await this.redis.hgetall('security:metrics:current');
    
    return {
      totalEvents: parseInt(metrics.totalEvents || '0'),
      threatEvents: parseInt(metrics.threatEvents || '0'),
      blockedRequests: parseInt(metrics.blockedRequests || '0'),
      suspiciousUsers: parseInt(metrics.suspiciousUsers || '0'),
      avgRiskScore: parseFloat(metrics.avgRiskScore || '0')
    };
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    const blocked = await this.redis.get(`security:blocked:${userId}`);
    return Boolean(blocked);
  }

  async getUserRiskScore(userId: string): Promise<number> {
    const maxRisk = await this.redis.hget(`security:user:${userId}`, 'maxRiskScore');
    return parseInt(maxRisk || '0');
  }
}