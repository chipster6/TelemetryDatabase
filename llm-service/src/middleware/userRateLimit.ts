import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

interface UserRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxRequestsPerUser: number;
  redisUrl?: string;
  blockDuration?: number;
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export class UserRateLimit {
  private ipLimiter: RateLimiterRedis;
  private userLimiter: RateLimiterRedis;
  private redis: Redis;

  constructor(config: UserRateLimitConfig) {
    this.redis = new Redis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // IP-based rate limiter (fallback protection)
    this.ipLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_ip',
      points: config.maxRequests,
      duration: Math.floor(config.windowMs / 1000),
      blockDuration: config.blockDuration || 900, // 15 minutes
      execEvenly: true,
    });

    // User-based rate limiter (primary protection)
    this.userLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_user',
      points: config.maxRequestsPerUser,
      duration: Math.floor(config.windowMs / 1000),
      blockDuration: config.blockDuration || 900, // 15 minutes
      execEvenly: true,
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error for rate limiter:', error);
    });
  }

  middleware() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const clientIp = this.getClientIp(req);
        const userId = this.getUserId(req);

        // Always check IP rate limit as base protection
        try {
          await this.ipLimiter.consume(clientIp);
        } catch (rateLimiterRes: any) {
          const secs = Math.round((rateLimiterRes?.msBeforeNext || 1000) / 1000) || 1;
          res.set('Retry-After', String(secs));
          res.status(429).json({
            success: false,
            error: 'Too many requests from this IP address',
            retryAfter: secs
          });
          return;
        }

        // Check user-specific rate limit if user is identified
        if (userId) {
          try {
            await this.userLimiter.consume(userId);
          } catch (rateLimiterRes: any) {
            const secs = Math.round((rateLimiterRes?.msBeforeNext || 1000) / 1000) || 1;
            res.set('Retry-After', String(secs));
            
            // Log rate limit violation for security monitoring
            logger.warn('User rate limit exceeded', {
              userId,
              ip: clientIp,
              userAgent: req.get('User-Agent'),
              endpoint: req.path,
              method: req.method,
              retryAfter: secs
            });

            res.status(429).json({
              success: false,
              error: 'Rate limit exceeded for user',
              retryAfter: secs
            });
            return;
          }
        }

        next();
      } catch (error) {
        logger.error('Rate limiter error:', error);
        // In case of rate limiter failure, allow request but log the error
        next();
      }
    };
  }

  private getClientIp(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  private getUserId(req: AuthenticatedRequest): string | null {
    // Try to extract user ID from various sources
    if (req.userId) return req.userId;
    if (req.user?.id) return req.user.id;
    if (req.body?.userId) return req.body.userId;
    if (req.query?.userId) return req.query.userId as string;
    
    // Try to extract from JWT token if present
    const authHeader = req.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // This is a simplified token parsing - in production, use proper JWT verification
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.userId || payload.sub;
      } catch (error) {
        logger.debug('Failed to parse JWT for user ID:', error);
      }
    }

    return null;
  }

  async getRemainingPoints(userId: string): Promise<number> {
    try {
      const result = await this.userLimiter.get(userId);
      return result ? result.remainingPoints : 0;
    } catch (error) {
      logger.error('Failed to get remaining points:', error);
      return 0;
    }
  }

  async resetUserLimit(userId: string): Promise<void> {
    try {
      await this.userLimiter.delete(userId);
      logger.info('Reset rate limit for user', { userId });
    } catch (error) {
      logger.error('Failed to reset user rate limit:', error);
      throw error;
    }
  }

  async getStats(userId?: string): Promise<any> {
    try {
      if (userId) {
        const userStats = await this.userLimiter.get(userId);
        return {
          userId,
          remainingPoints: userStats?.remainingPoints || 0,
          msBeforeNext: userStats?.msBeforeNext || 0,
          totalHits: (userStats as any)?.totalHits || 0
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to get rate limit stats:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Factory function for easy setup
export function createUserRateLimit(config?: Partial<UserRateLimitConfig>): UserRateLimit {
  const defaultConfig: UserRateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // per IP
    maxRequestsPerUser: 100, // per user
    blockDuration: 900, // 15 minutes
  };

  return new UserRateLimit({ ...defaultConfig, ...config });
}