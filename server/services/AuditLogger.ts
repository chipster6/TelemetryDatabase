import { EventEmitter } from 'events';
import { logger } from '../utils/Logger.js';
import Redis from 'ioredis';
import crypto from 'crypto';

export interface AuditEvent {
  eventId: string;
  userId?: string;
  sessionId?: string;
  eventType: AuditEventType;
  action: string;
  resource: string;
  timestamp: Date;
  sourceIp: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, any>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  sensitive_data_accessed?: boolean;
}

export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  LLM_GENERATION = 'llm_generation',
  BIOMETRIC_ACCESS = 'biometric_access',
  DATA_EXPORT = 'data_export',
  SYSTEM_ADMIN = 'system_admin',
  SECURITY_VIOLATION = 'security_violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  PROMPT_INJECTION_DETECTED = 'prompt_injection_detected',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

export interface AuditLoggerConfig {
  redisUrl?: string;
  retentionDays?: number;
  enableRealTimeAlerts?: boolean;
  securityWebhookUrl?: string;
  encryptSensitiveData?: boolean;
  encryptionKey?: string;
}

export class AuditLogger extends EventEmitter {
  private redis: Redis;
  private config: AuditLoggerConfig;
  private encryptionKey?: Buffer;

  constructor(config: AuditLoggerConfig = {}) {
    super();
    this.config = {
      retentionDays: 90,
      enableRealTimeAlerts: true,
      encryptSensitiveData: true,
      ...config
    };

    this.redis = new Redis(this.config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    if (this.config.encryptSensitiveData && this.config.encryptionKey) {
      this.encryptionKey = Buffer.from(this.config.encryptionKey, 'hex');
    }

    this.setupCleanupJob();
  }

  async logEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date()
    };

    try {
      // Store in Redis with TTL based on retention policy
      const ttl = this.config.retentionDays! * 24 * 60 * 60; // seconds
      const eventData = this.prepareEventData(auditEvent);
      
      await Promise.all([
        // Store individual event
        this.redis.setex(
          `audit:event:${auditEvent.eventId}`,
          ttl,
          JSON.stringify(eventData)
        ),
        // Add to user-specific log
        this.redis.lpush(`audit:user:${auditEvent.userId || 'anonymous'}`, auditEvent.eventId),
        this.redis.expire(`audit:user:${auditEvent.userId || 'anonymous'}`, ttl),
        // Add to type-specific log
        this.redis.lpush(`audit:type:${auditEvent.eventType}`, auditEvent.eventId),
        this.redis.expire(`audit:type:${auditEvent.eventType}`, ttl),
        // Add to daily log for analytics
        this.redis.lpush(`audit:daily:${this.getDayKey()}`, auditEvent.eventId),
        this.redis.expire(`audit:daily:${this.getDayKey()}`, ttl)
      ]);

      // Log to standard logger for immediate visibility
      this.logToStandardLogger(auditEvent);

      // Handle security alerts
      if (this.shouldTriggerAlert(auditEvent)) {
        await this.triggerSecurityAlert(auditEvent);
      }

      this.emit('audit_logged', auditEvent);
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      // Fallback to standard logging
      this.logToStandardLogger(auditEvent, error);
    }
  }

  async logLLMGeneration(data: {
    userId: string;
    prompt: string;
    response: string;
    model: string;
    tokensUsed: number;
    cognitiveAdaptations: string[];
    sourceIp: string;
    userAgent?: string;
    processingTimeMs: number;
  }): Promise<void> {
    const sensitiveMetadata = this.config.encryptSensitiveData ? {
      prompt_hash: this.hashSensitiveData(data.prompt),
      response_hash: this.hashSensitiveData(data.response),
      prompt_length: data.prompt.length,
      response_length: data.response.length
    } : {
      prompt: data.prompt,
      response: data.response
    };

    await this.logEvent({
      userId: data.userId,
      eventType: AuditEventType.LLM_GENERATION,
      action: 'generate_response',
      resource: `llm:${data.model}`,
      sourceIp: data.sourceIp,
      userAgent: data.userAgent,
      success: true,
      risk_level: this.assessPromptRiskLevel(data.prompt),
      sensitive_data_accessed: true,
      metadata: {
        ...sensitiveMetadata,
        model: data.model,
        tokensUsed: data.tokensUsed,
        cognitiveAdaptations: data.cognitiveAdaptations,
        processingTimeMs: data.processingTimeMs,
        promptInjectionRisk: this.detectPromptInjectionRisk(data.prompt)
      }
    });
  }

  async logBiometricAccess(data: {
    userId: string;
    action: string;
    dataTypes: string[];
    sourceIp: string;
    userAgent?: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.logEvent({
      userId: data.userId,
      eventType: AuditEventType.BIOMETRIC_ACCESS,
      action: data.action,
      resource: `biometric:${data.dataTypes.join(',')}`,
      sourceIp: data.sourceIp,
      userAgent: data.userAgent,
      success: data.success,
      risk_level: data.dataTypes.includes('sensitive') ? 'high' : 'medium',
      sensitive_data_accessed: true,
      metadata: {
        dataTypes: data.dataTypes,
        error: data.error
      }
    });
  }

  async logSecurityViolation(data: {
    userId?: string;
    violationType: string;
    description: string;
    sourceIp: string;
    userAgent?: string;
    blocked: boolean;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logEvent({
      userId: data.userId,
      eventType: AuditEventType.SECURITY_VIOLATION,
      action: data.violationType,
      resource: 'security',
      sourceIp: data.sourceIp,
      userAgent: data.userAgent,
      success: false,
      risk_level: 'critical',
      metadata: {
        description: data.description,
        blocked: data.blocked,
        ...data.metadata
      }
    });
  }

  private generateEventId(): string {
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private getDayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private prepareEventData(event: AuditEvent): any {
    const data = { ...event };
    
    // Encrypt sensitive metadata if configured
    if (this.config.encryptSensitiveData && this.encryptionKey && event.sensitive_data_accessed) {
      if (data.metadata) {
        data.metadata = this.encryptData(JSON.stringify(data.metadata));
      }
    }

    return data;
  }

  private encryptData(data: string): string {
    if (!this.encryptionKey) return data;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private assessPromptRiskLevel(prompt: string): 'low' | 'medium' | 'high' | 'critical' {
    const riskIndicators = [
      /ignore.*previous.*instructions/i,
      /system.*prompt/i,
      /jailbreak/i,
      /assistant.*rules/i,
      /\$\{.*\}/,
      /<script>/i,
      /exec\(/i,
      /eval\(/i
    ];

    const matches = riskIndicators.filter(pattern => pattern.test(prompt));
    
    if (matches.length >= 3) return 'critical';
    if (matches.length >= 2) return 'high';
    if (matches.length >= 1) return 'medium';
    return 'low';
  }

  private detectPromptInjectionRisk(prompt: string): number {
    const injectionPatterns = [
      /ignore.*instructions/i,
      /forget.*conversation/i,
      /new.*task/i,
      /system.*message/i,
      /\[.*SYSTEM.*\]/i,
      /\<\|.*\|\>/,
      /assistant.*is.*now/i
    ];

    return injectionPatterns.filter(pattern => pattern.test(prompt)).length;
  }

  private shouldTriggerAlert(event: AuditEvent): boolean {
    return this.config.enableRealTimeAlerts && (
      event.risk_level === 'critical' ||
      event.eventType === AuditEventType.SECURITY_VIOLATION ||
      event.eventType === AuditEventType.PROMPT_INJECTION_DETECTED ||
      (event.eventType === AuditEventType.LLM_GENERATION && 
       event.metadata?.promptInjectionRisk > 2)
    );
  }

  private async triggerSecurityAlert(event: AuditEvent): Promise<void> {
    try {
      logger.warn('Security alert triggered', event);
      this.emit('security_alert', event);

      // Send webhook notification if configured
      if (this.config.securityWebhookUrl) {
        // Implementation would depend on your webhook service
        // For now, just log that we would send an alert
        logger.info('Would send security webhook for event', { eventId: event.eventId });
      }
    } catch (error) {
      logger.error('Failed to trigger security alert:', error);
    }
  }

  private logToStandardLogger(event: AuditEvent, error?: any): void {
    const logData = {
      audit_event: true,
      event_id: event.eventId,
      user_id: event.userId,
      event_type: event.eventType,
      action: event.action,
      resource: event.resource,
      success: event.success,
      risk_level: event.risk_level,
      source_ip: event.sourceIp,
      timestamp: event.timestamp
    };

    if (event.success) {
      logger.info('Audit event logged', logData);
    } else {
      logger.warn('Audit event - failure', logData);
    }

    if (error) {
      logger.error('Audit logging error', { ...logData, error });
    }
  }

  private setupCleanupJob(): void {
    // Run cleanup every 24 hours
    setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        logger.error('Audit log cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  private async cleanup(): Promise<void> {
    // Redis TTL handles most cleanup automatically
    // This could be extended for additional cleanup tasks
    logger.info('Audit log cleanup completed');
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}