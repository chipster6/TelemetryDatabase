import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { AuditLogger, AuditEventType } from '../services/AuditLogger.js';

export interface AbuseDetectionConfig {
  // Pattern detection thresholds
  maxSimilarPromptsPerHour: number;
  maxRepeatedRequestsPerMinute: number;
  maxErrorRatePerHour: number;
  
  // Content analysis
  enableContentAnalysis: boolean;
  maxSuspiciousKeywords: number;
  
  // Behavioral analysis
  maxTokenVelocity: number; // tokens per minute
  maxRequestBurstSize: number;
  burstWindowMs: number;
  
  // Action thresholds
  warningThreshold: number;
  temporaryBlockThreshold: number;
  permanentBlockThreshold: number;
  
  redisUrl?: string;
}

interface UserBehaviorProfile {
  promptHashes: Set<string>;
  recentErrors: number[];
  tokenUsageHistory: number[];
  requestTimestamps: number[];
  suspiciousActivities: AbuseEvent[];
  riskScore: number;
  lastActivity: number;
}

interface AbuseEvent {
  type: AbuseType;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}

enum AbuseType {
  REPEATED_PROMPTS = 'repeated_prompts',
  HIGH_ERROR_RATE = 'high_error_rate',
  SUSPICIOUS_CONTENT = 'suspicious_content',
  TOKEN_VELOCITY_ABUSE = 'token_velocity_abuse',
  REQUEST_BURST = 'request_burst',
  PROMPT_INJECTION_ATTEMPT = 'prompt_injection_attempt',
  RESOURCE_EXHAUSTION = 'resource_exhaustion'
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  abuseScore?: number;
  isBlocked?: boolean;
}

export class AbuseDetectionManager {
  private config: AbuseDetectionConfig;
  private redis: Redis;
  private auditLogger: AuditLogger;
  
  // User behavior tracking
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  
  // Rate limiters for abuse detection
  private abuseScoreLimiter: RateLimiterRedis;
  private suspiciousPatternKeywords: Set<string>;

  constructor(config: AbuseDetectionConfig, auditLogger: AuditLogger) {
    this.config = config;
    this.auditLogger = auditLogger;
    this.redis = new Redis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Abuse score accumulator (resets daily)
    this.abuseScoreLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'abuse_score',
      points: 1000, // Maximum abuse score before permanent block
      duration: 86400, // 24 hours
      blockDuration: 86400 * 7, // 7 days
    });

    this.suspiciousPatternKeywords = new Set([
      'ignore', 'forget', 'disregard', 'override', 'bypass',
      'jailbreak', 'system prompt', 'instructions',
      'pretend', 'roleplay as', 'act as if',
      'developer mode', 'admin mode', 'god mode',
      'unrestricted', 'uncensored', 'unfiltered'
    ]);

    this.setupCleanupTasks();
  }

  private setupCleanupTasks(): void {
    // Clean up old user profiles every hour
    setInterval(() => {
      this.cleanupStaleProfiles();
    }, 60 * 60 * 1000);
  }

  private cleanupStaleProfiles(): void {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [userId, profile] of this.userProfiles.entries()) {
      if (now - profile.lastActivity > staleThreshold) {
        this.userProfiles.delete(userId);
      }
    }
  }

  // Main abuse detection middleware
  detectAbuse() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = req.userId || req.ip || 'anonymous';
      const now = Date.now();

      try {
        // Get or create user profile
        const profile = this.getUserProfile(userId);
        profile.lastActivity = now;

        // Check if user is currently blocked
        if (await this.isUserBlocked(userId)) {
          req.isBlocked = true;
          return res.status(429).json({
            success: false,
            error: 'Account temporarily suspended due to suspicious activity',
            code: 'ACCOUNT_SUSPENDED'
          });
        }

        // Analyze current request for abuse patterns
        const abuseEvents = await this.analyzeRequest(req, profile);
        
        // Update profile with new events
        profile.suspiciousActivities.push(...abuseEvents);
        
        // Calculate current risk score
        const riskScore = this.calculateRiskScore(profile);
        profile.riskScore = riskScore;
        req.abuseScore = riskScore;

        // Take action based on risk score
        await this.handleRiskScore(userId, riskScore, abuseEvents);

        // Log significant abuse events
        if (abuseEvents.length > 0) {
          await this.logAbuseEvents(userId, abuseEvents, req);
        }

        next();
      } catch (error) {
        logger.error('Abuse detection failed:', error);
        // Don't block request on detection failure, just log
        next();
      }
    };
  }

  private getUserProfile(userId: string): UserBehaviorProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        promptHashes: new Set(),
        recentErrors: [],
        tokenUsageHistory: [],
        requestTimestamps: [],
        suspiciousActivities: [],
        riskScore: 0,
        lastActivity: Date.now()
      });
    }
    return this.userProfiles.get(userId)!;
  }

  private async isUserBlocked(userId: string): Promise<boolean> {
    try {
      await this.abuseScoreLimiter.consume(userId, 0);
      return false;
    } catch {
      return true;
    }
  }

  private async analyzeRequest(req: AuthenticatedRequest, profile: UserBehaviorProfile): Promise<AbuseEvent[]> {
    const events: AbuseEvent[] = [];
    const now = Date.now();
    const { prompt } = req.body || {};

    // Analyze prompt repetition
    if (prompt) {
      const promptHash = this.hashPrompt(prompt);
      if (profile.promptHashes.has(promptHash)) {
        events.push({
          type: AbuseType.REPEATED_PROMPTS,
          timestamp: now,
          severity: 'medium',
          details: { promptHash, repetitionCount: this.countPromptRepetitions(profile, promptHash) }
        });
      }
      profile.promptHashes.add(promptHash);
    }

    // Analyze request burst patterns
    profile.requestTimestamps.push(now);
    const recentRequests = profile.requestTimestamps.filter(
      ts => now - ts < this.config.burstWindowMs
    );
    
    if (recentRequests.length > this.config.maxRequestBurstSize) {
      events.push({
        type: AbuseType.REQUEST_BURST,
        timestamp: now,
        severity: 'high',
        details: { 
          requestCount: recentRequests.length,
          windowMs: this.config.burstWindowMs
        }
      });
    }

    // Clean old timestamps
    profile.requestTimestamps = recentRequests;

    // Analyze suspicious content patterns
    if (this.config.enableContentAnalysis && prompt) {
      const suspiciousKeywords = this.detectSuspiciousKeywords(prompt);
      if (suspiciousKeywords.length > this.config.maxSuspiciousKeywords) {
        events.push({
          type: AbuseType.SUSPICIOUS_CONTENT,
          timestamp: now,
          severity: 'high',
          details: { 
            suspiciousKeywords,
            keywordCount: suspiciousKeywords.length
          }
        });
      }

      // Check for prompt injection patterns
      if (this.detectPromptInjection(prompt)) {
        events.push({
          type: AbuseType.PROMPT_INJECTION_ATTEMPT,
          timestamp: now,
          severity: 'critical',
          details: { prompt: prompt.substring(0, 200) + '...' }
        });
      }
    }

    // Analyze token velocity
    const tokenVelocity = this.calculateTokenVelocity(profile);
    if (tokenVelocity > this.config.maxTokenVelocity) {
      events.push({
        type: AbuseType.TOKEN_VELOCITY_ABUSE,
        timestamp: now,
        severity: 'medium',
        details: { 
          tokenVelocity,
          maxAllowed: this.config.maxTokenVelocity
        }
      });
    }

    return events;
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for prompt similarity detection
    return Buffer.from(prompt.toLowerCase().replace(/\s+/g, ' ')).toString('base64');
  }

  private countPromptRepetitions(profile: UserBehaviorProfile, promptHash: string): number {
    // Count recent similar prompts (implementation would track this)
    return Array.from(profile.promptHashes).filter(hash => hash === promptHash).length;
  }

  private detectSuspiciousKeywords(prompt: string): string[] {
    const lowerPrompt = prompt.toLowerCase();
    return Array.from(this.suspiciousPatternKeywords).filter(
      keyword => lowerPrompt.includes(keyword)
    );
  }

  private detectPromptInjection(prompt: string): boolean {
    const injectionPatterns = [
      /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i,
      /system\s*:\s*you\s+are\s+now/i,
      /\[\s*system\s*\]/i,
      /forget\s+everything\s+(above|before)/i,
      /new\s+instructions?\s*:/i,
      /override\s+your\s+programming/i,
      /jailbreak\s+mode/i,
      /developer\s+mode\s+enabled/i
    ];

    return injectionPatterns.some(pattern => pattern.test(prompt));
  }

  private calculateTokenVelocity(profile: UserBehaviorProfile): number {
    const now = Date.now();
    const recentTokens = profile.tokenUsageHistory.filter(
      timestamp => now - timestamp < 60000 // last minute
    );
    return recentTokens.length;
  }

  private calculateRiskScore(profile: UserBehaviorProfile): number {
    const now = Date.now();
    const recentEvents = profile.suspiciousActivities.filter(
      event => now - event.timestamp < 60 * 60 * 1000 // last hour
    );

    let score = 0;
    
    for (const event of recentEvents) {
      switch (event.severity) {
        case 'low': score += 1; break;
        case 'medium': score += 5; break;
        case 'high': score += 15; break;
        case 'critical': score += 50; break;
      }
    }

    return Math.min(score, 1000); // Cap at 1000
  }

  private async handleRiskScore(userId: string, riskScore: number, events: AbuseEvent[]): Promise<void> {
    if (riskScore >= this.config.permanentBlockThreshold) {
      await this.blockUser(userId, 86400 * 7); // 7 days
      logger.warn('User permanently blocked for high abuse score', {
        userId,
        riskScore,
        recentEvents: events
      });
    } else if (riskScore >= this.config.temporaryBlockThreshold) {
      await this.blockUser(userId, 3600); // 1 hour
      logger.warn('User temporarily blocked for abuse', {
        userId,
        riskScore,
        recentEvents: events
      });
    } else if (riskScore >= this.config.warningThreshold) {
      logger.warn('User approaching abuse threshold', {
        userId,
        riskScore,
        recentEvents: events
      });
    }
  }

  private async blockUser(userId: string, durationSeconds: number): Promise<void> {
    try {
      // Consume a large number of points to trigger rate limiter block
      await this.abuseScoreLimiter.consume(userId, 1000);
    } catch {
      // User is now blocked
    }
  }

  private async logAbuseEvents(userId: string, events: AbuseEvent[], req: AuthenticatedRequest): Promise<void> {
    for (const event of events) {
      await this.auditLogger.logEvent({
        userId,
        eventType: AuditEventType.SECURITY_VIOLATION,
        action: `abuse_detected_${event.type}`,
        resource: 'llm_generation',
        sourceIp: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: false,
        risk_level: event.severity === 'critical' ? 'critical' : 'high',
        metadata: {
          abuseType: event.type,
          severity: event.severity,
          details: event.details,
          timestamp: event.timestamp
        }
      });
    }
  }

  // Management methods
  async getUserRiskProfile(userId: string): Promise<{
    riskScore: number;
    recentEvents: AbuseEvent[];
    isBlocked: boolean;
    profile: UserBehaviorProfile | null;
  }> {
    const profile = this.userProfiles.get(userId);
    const isBlocked = await this.isUserBlocked(userId);
    
    return {
      riskScore: profile?.riskScore || 0,
      recentEvents: profile?.suspiciousActivities.slice(-10) || [],
      isBlocked,
      profile: profile || null
    };
  }

  async unblockUser(userId: string): Promise<void> {
    await this.redis.del(`abuse_score:${userId}`);
    logger.info('User manually unblocked', { userId });
  }

  getAbuseMetrics(): {
    totalUsers: number;
    blockedUsers: number;
    highRiskUsers: number;
    recentAbuseEvents: number;
  } {
    const profiles = Array.from(this.userProfiles.values());
    const now = Date.now();
    
    return {
      totalUsers: profiles.length,
      blockedUsers: 0, // Would need to query Redis for accurate count
      highRiskUsers: profiles.filter(p => p.riskScore > this.config.warningThreshold).length,
      recentAbuseEvents: profiles.reduce((total, profile) => {
        return total + profile.suspiciousActivities.filter(
          event => now - event.timestamp < 60 * 60 * 1000
        ).length;
      }, 0)
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export function createAbuseDetection(config: Partial<AbuseDetectionConfig>, auditLogger: AuditLogger): AbuseDetectionManager {
  const defaultConfig: AbuseDetectionConfig = {
    maxSimilarPromptsPerHour: 10,
    maxRepeatedRequestsPerMinute: 20,
    maxErrorRatePerHour: 50,
    enableContentAnalysis: true,
    maxSuspiciousKeywords: 3,
    maxTokenVelocity: 1000, // tokens per minute
    maxRequestBurstSize: 10,
    burstWindowMs: 60000, // 1 minute
    warningThreshold: 25,
    temporaryBlockThreshold: 50,
    permanentBlockThreshold: 100
  };

  return new AbuseDetectionManager({ ...defaultConfig, ...config }, auditLogger);
}