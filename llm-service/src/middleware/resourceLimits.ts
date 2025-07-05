import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { ErrorFactory, ErrorType } from '../utils/errorHandler';
import { AuditLogger, AuditEventType } from '../services/AuditLogger.js';

export interface ResourceLimitConfig {
  // Token limits
  maxTokensPerRequest: number;
  maxTokensPerUser: number;
  maxTokensPerUserDaily: number;
  
  // Request limits
  maxConcurrentRequests: number;
  maxConcurrentRequestsPerUser: number;
  
  // Content limits
  maxPromptLength: number;
  maxResponseLength: number;
  
  // Time limits
  maxProcessingTimeMs: number;
  
  // Memory and CPU
  maxMemoryUsageBytes: number;
  
  // Redis configuration
  redisUrl?: string;
}

interface RequestMetrics {
  startTime: number;
  tokensUsed: number;
  promptLength: number;
  memoryUsage: number;
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  metrics?: RequestMetrics;
  resourceLimits?: {
    maxTokens: number;
    maxResponseLength: number;
    timeoutMs: number;
  };
}

export class ResourceLimitManager {
  private config: ResourceLimitConfig;
  private redis: Redis;
  private auditLogger: AuditLogger;
  
  // Rate limiters for different resource types
  private tokenLimiter: RateLimiterRedis;
  private dailyTokenLimiter: RateLimiterRedis;
  private concurrentRequestLimiter: RateLimiterMemory;
  private userConcurrentLimiter: Map<string, number> = new Map();
  
  // Active request tracking
  private activeRequests: Map<string, RequestMetrics> = new Map();
  private totalActiveRequests = 0;

  constructor(config: ResourceLimitConfig, auditLogger: AuditLogger) {
    this.config = config;
    this.auditLogger = auditLogger;
    this.redis = new Redis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Token usage limiter (per hour)
    this.tokenLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_tokens',
      points: config.maxTokensPerUser,
      duration: 3600, // 1 hour
      blockDuration: 3600,
      execEvenly: true,
    });

    // Daily token limiter
    this.dailyTokenLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_tokens_daily',
      points: config.maxTokensPerUserDaily,
      duration: 86400, // 24 hours
      blockDuration: 86400,
      execEvenly: true,
    });

    // Concurrent request limiter (global)
    this.concurrentRequestLimiter = new RateLimiterMemory({
      keyPrefix: 'rl_concurrent',
      points: config.maxConcurrentRequests,
      duration: 1,
      blockDuration: 1,
    });

    this.setupCleanupTasks();
  }

  private setupCleanupTasks(): void {
    // Clean up stale request tracking every 5 minutes
    setInterval(() => {
      this.cleanupStaleRequests();
    }, 5 * 60 * 1000);
  }

  private cleanupStaleRequests(): void {
    const now = Date.now();
    const staleThreshold = this.config.maxProcessingTimeMs * 2;
    
    for (const [requestId, metrics] of this.activeRequests.entries()) {
      if (now - metrics.startTime > staleThreshold) {
        this.activeRequests.delete(requestId);
        this.totalActiveRequests = Math.max(0, this.totalActiveRequests - 1);
        
        logger.warn('Cleaned up stale request tracking', {
          requestId,
          age: now - metrics.startTime
        });
      }
    }
  }

  // Pre-request validation middleware
  preRequestLimits() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const requestId = this.generateRequestId();
      const userId = req.userId || req.ip || 'anonymous';
      const startTime = Date.now();

      try {
        // Validate request format and basic limits
        await this.validateRequestFormat(req);
        
        // Check global concurrent request limit
        await this.checkGlobalConcurrentLimit();
        
        // Check user-specific concurrent request limit
        await this.checkUserConcurrentLimit(userId);
        
        // Check prompt length
        this.validatePromptLength(req.body?.prompt || '');
        
        // Initialize request metrics
        req.metrics = {
          startTime,
          tokensUsed: 0,
          promptLength: req.body?.prompt?.length || 0,
          memoryUsage: process.memoryUsage().heapUsed
        };

        // Set dynamic resource limits based on user tier/history
        req.resourceLimits = await this.calculateUserResourceLimits(userId);
        
        // Track active request
        this.activeRequests.set(requestId, req.metrics);
        this.totalActiveRequests++;
        this.incrementUserConcurrent(userId);

        // Set cleanup for this request
        res.on('finish', () => {
          this.cleanupRequest(requestId, userId);
        });

        res.on('close', () => {
          this.cleanupRequest(requestId, userId);
        });

        next();
      } catch (error) {
        await this.auditLogger.logEvent({
          userId,
          eventType: AuditEventType.SECURITY_VIOLATION,
          action: 'resource_limit_exceeded',
          resource: 'llm_generation',
          sourceIp: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          success: false,
          risk_level: 'medium',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestMetrics: req.metrics
          }
        });

        if (error instanceof ResourceLimitError) {
          res.status(429).json({
            success: false,
            error: error.message,
            code: error.code,
            retryAfter: error.retryAfter
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'Request validation failed'
          });
        }
      }
    };
  }

  // Post-request token consumption tracking
  postRequestLimits() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = req.userId || req.ip || 'anonymous';
      
      try {
        // This will be called after generation, with tokensUsed in req.metrics
        if (req.metrics?.tokensUsed) {
          await this.consumeTokens(userId, req.metrics.tokensUsed);
        }

        next();
      } catch (error) {
        logger.error('Post-request token tracking failed:', error);
        // Don't fail the request, just log the issue
        next();
      }
    };
  }

  private async validateRequestFormat(req: AuthenticatedRequest): Promise<void> {
    const { prompt, maxTokens } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string') {
      throw new ResourceLimitError('Invalid prompt format', 'INVALID_FORMAT');
    }

    if (maxTokens && maxTokens > this.config.maxTokensPerRequest) {
      throw new ResourceLimitError(
        `Max tokens ${maxTokens} exceeds limit of ${this.config.maxTokensPerRequest}`,
        'TOKEN_LIMIT_EXCEEDED'
      );
    }
  }

  private async checkGlobalConcurrentLimit(): Promise<void> {
    if (this.totalActiveRequests >= this.config.maxConcurrentRequests) {
      throw new ResourceLimitError(
        'Server at maximum capacity. Please try again later.',
        'SERVER_OVERLOADED',
        60
      );
    }
  }

  private async checkUserConcurrentLimit(userId: string): Promise<void> {
    const userConcurrent = this.userConcurrentLimiter.get(userId) || 0;
    
    if (userConcurrent >= this.config.maxConcurrentRequestsPerUser) {
      throw new ResourceLimitError(
        `User has ${userConcurrent} concurrent requests. Max allowed: ${this.config.maxConcurrentRequestsPerUser}`,
        'USER_CONCURRENT_LIMIT',
        30
      );
    }
  }

  private validatePromptLength(prompt: string): void {
    if (prompt.length > this.config.maxPromptLength) {
      throw new ResourceLimitError(
        `Prompt length ${prompt.length} exceeds maximum of ${this.config.maxPromptLength} characters`,
        'PROMPT_TOO_LONG'
      );
    }
  }

  private async calculateUserResourceLimits(userId: string): Promise<{
    maxTokens: number;
    maxResponseLength: number;
    timeoutMs: number;
  }> {
    // TODO: Implement user tier system
    // For now, return default limits
    return {
      maxTokens: this.config.maxTokensPerRequest,
      maxResponseLength: this.config.maxResponseLength,
      timeoutMs: this.config.maxProcessingTimeMs
    };
  }

  private async consumeTokens(userId: string, tokens: number): Promise<void> {
    try {
      // Check hourly limit
      await this.tokenLimiter.consume(userId, tokens);
      
      // Check daily limit
      await this.dailyTokenLimiter.consume(userId, tokens);
      
    } catch (rateLimiterRes: any) {
      const isDaily = rateLimiterRes.key?.includes('daily');
      const timeFrame = isDaily ? 'daily' : 'hourly';
      const limit = isDaily ? this.config.maxTokensPerUserDaily : this.config.maxTokensPerUser;
      
      throw new ResourceLimitError(
        `User ${timeFrame} token limit of ${limit} exceeded`,
        isDaily ? 'DAILY_TOKEN_LIMIT' : 'HOURLY_TOKEN_LIMIT',
        Math.round((rateLimiterRes.msBeforeNext || 3600000) / 1000)
      );
    }
  }

  private incrementUserConcurrent(userId: string): void {
    const current = this.userConcurrentLimiter.get(userId) || 0;
    this.userConcurrentLimiter.set(userId, current + 1);
  }

  private cleanupRequest(requestId: string, userId: string): void {
    this.activeRequests.delete(requestId);
    this.totalActiveRequests = Math.max(0, this.totalActiveRequests - 1);
    
    const userConcurrent = this.userConcurrentLimiter.get(userId) || 0;
    if (userConcurrent > 0) {
      this.userConcurrentLimiter.set(userId, userConcurrent - 1);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Monitoring and metrics
  getResourceMetrics(): {
    activeRequests: number;
    totalActiveRequests: number;
    userConcurrentRequests: Record<string, number>;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  } {
    return {
      activeRequests: this.activeRequests.size,
      totalActiveRequests: this.totalActiveRequests,
      userConcurrentRequests: Object.fromEntries(this.userConcurrentLimiter.entries()),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  async getUserTokenUsage(userId: string): Promise<{
    hourlyUsage: number;
    hourlyLimit: number;
    dailyUsage: number;
    dailyLimit: number;
    hourlyResetIn: number;
    dailyResetIn: number;
  }> {
    const hourlyStats = await this.tokenLimiter.get(userId);
    const dailyStats = await this.dailyTokenLimiter.get(userId);
    
    return {
      hourlyUsage: this.config.maxTokensPerUser - (hourlyStats?.remainingPoints || this.config.maxTokensPerUser),
      hourlyLimit: this.config.maxTokensPerUser,
      dailyUsage: this.config.maxTokensPerUserDaily - (dailyStats?.remainingPoints || this.config.maxTokensPerUserDaily),
      dailyLimit: this.config.maxTokensPerUserDaily,
      hourlyResetIn: hourlyStats?.msBeforeNext || 0,
      dailyResetIn: dailyStats?.msBeforeNext || 0
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

class ResourceLimitError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ResourceLimitError';
  }
}

export function createResourceLimits(config: Partial<ResourceLimitConfig>, auditLogger: AuditLogger): ResourceLimitManager {
  const defaultConfig: ResourceLimitConfig = {
    maxTokensPerRequest: 4096,
    maxTokensPerUser: 50000, // per hour
    maxTokensPerUserDaily: 200000,
    maxConcurrentRequests: 100,
    maxConcurrentRequestsPerUser: 5,
    maxPromptLength: 50000,
    maxResponseLength: 100000,
    maxProcessingTimeMs: 300000, // 5 minutes
    maxMemoryUsageBytes: 1024 * 1024 * 1024 // 1GB
  };

  return new ResourceLimitManager({ ...defaultConfig, ...config }, auditLogger);
}