import { WebSocket } from 'ws';
import { z } from 'zod';
import crypto from 'crypto';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/Logger.js';

export interface WebSocketMessage {
  type: string;
  requestId?: string;
  userId?: string;
  data?: any;
  timestamp?: number;
}

export interface WebSocketSecurityConfig {
  maxMessageSize?: number;
  maxMessagesPerMinute?: number;
  allowedMessageTypes?: string[];
  requireAuthentication?: boolean;
  enableContentValidation?: boolean;
  redisUrl?: string;
  sessionTimeout?: number;
}

export interface WebSocketSession {
  id: string;
  userId?: string;
  authenticated: boolean;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
}

// Message schemas for validation
const BaseMessageSchema = z.object({
  type: z.string().min(1).max(50),
  requestId: z.string().optional(),
  timestamp: z.number().optional()
});

const PingMessageSchema = BaseMessageSchema.extend({
  type: z.literal('ping')
});

const AuthMessageSchema = BaseMessageSchema.extend({
  type: z.literal('auth'),
  data: z.object({
    token: z.string().min(1),
    userId: z.string().min(1).max(100)
  })
});

const SubscribeMessageSchema = BaseMessageSchema.extend({
  type: z.literal('subscribe'),
  data: z.object({
    channel: z.string().min(1).max(100),
    filters: z.record(z.any()).optional()
  })
});

const LLMRequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal('llm_request'),
  data: z.object({
    userId: z.string().min(1).max(100),
    prompt: z.string().min(1).max(10000),
    stream: z.boolean().optional().default(false),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(4096).optional()
  })
});

export class SecureWebSocketValidator {
  private sessions = new Map<WebSocket, WebSocketSession>();
  private rateLimiter: RateLimiterRedis;
  private redis: Redis;
  private config: Required<WebSocketSecurityConfig>;
  private blockedPatterns: RegExp[];

  constructor(config: WebSocketSecurityConfig = {}) {
    this.config = {
      maxMessageSize: 64 * 1024, // 64KB
      maxMessagesPerMinute: 60,
      allowedMessageTypes: ['ping', 'auth', 'subscribe', 'unsubscribe', 'llm_request'],
      requireAuthentication: true,
      enableContentValidation: true,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      ...config
    };

    this.redis = new Redis(this.config.redisUrl);
    
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'ws_rate_limit',
      points: this.config.maxMessagesPerMinute,
      duration: 60, // 60 seconds
      blockDuration: 300, // 5 minutes
      execEvenly: true,
    });

    this.blockedPatterns = [
      // Script injection patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // Command injection patterns  
      /exec\s*\(/gi,
      /eval\s*\(/gi,
      /system\s*\(/gi,
      
      // Path traversal
      /\.\.\//g,
      /\.\.\\+/g,
      
      // SQL injection patterns
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      
      // Suspicious protocols
      /file:\/\//gi,
      /ftp:\/\//gi,
      /ldap:\/\//gi,
      
      // Control characters
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
    ];

    this.startSessionCleanup();
  }

  async validateConnection(ws: WebSocket, request: any): Promise<boolean> {
    try {
      // Create session
      const session: WebSocketSession = {
        id: this.generateSessionId(),
        authenticated: false,
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        subscriptions: new Set(),
        metadata: {
          ip: this.getClientIp(request),
          userAgent: request.headers['user-agent'] || 'unknown',
          origin: request.headers.origin
        }
      };

      this.sessions.set(ws, session);

      // Validate origin if specified
      if (request.headers.origin && !this.isValidOrigin(request.headers.origin)) {
        logger.warn('WebSocket connection rejected - invalid origin', {
          origin: request.headers.origin,
          ip: session.metadata.ip
        });
        return false;
      }

      // Check rate limits
      try {
        await this.rateLimiter.consume(session.metadata.ip);
      } catch (rateLimiterRes) {
        logger.warn('WebSocket connection rejected - rate limit exceeded', {
          ip: session.metadata.ip,
          retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
        });
        return false;
      }

      logger.info('WebSocket connection established', {
        sessionId: session.id,
        ip: session.metadata.ip
      });

      return true;
    } catch (error) {
      logger.error('Error validating WebSocket connection:', error);
      return false;
    }
  }

  async validateMessage(ws: WebSocket, rawMessage: Buffer | string): Promise<{
    valid: boolean;
    message?: WebSocketMessage;
    error?: string;
    shouldBlock?: boolean;
  }> {
    const session = this.sessions.get(ws);
    if (!session) {
      return { valid: false, error: 'No session found', shouldBlock: true };
    }

    try {
      // Check message size
      const messageSize = Buffer.isBuffer(rawMessage) ? rawMessage.length : Buffer.byteLength(rawMessage, 'utf8');
      if (messageSize > this.config.maxMessageSize) {
        logger.warn('WebSocket message rejected - size limit exceeded', {
          sessionId: session.id,
          size: messageSize,
          limit: this.config.maxMessageSize
        });
        return { valid: false, error: 'Message too large', shouldBlock: false };
      }

      // Parse message
      let message: any;
      try {
        const messageStr = rawMessage.toString();
        message = JSON.parse(messageStr);
      } catch (parseError) {
        logger.warn('WebSocket message rejected - invalid JSON', {
          sessionId: session.id,
          error: parseError.message
        });
        return { valid: false, error: 'Invalid JSON', shouldBlock: false };
      }

      // Basic structure validation
      const baseValidation = BaseMessageSchema.safeParse(message);
      if (!baseValidation.success) {
        logger.warn('WebSocket message rejected - invalid structure', {
          sessionId: session.id,
          errors: baseValidation.error.errors
        });
        return { valid: false, error: 'Invalid message structure', shouldBlock: false };
      }

      // Check allowed message types
      if (!this.config.allowedMessageTypes.includes(message.type)) {
        logger.warn('WebSocket message rejected - unauthorized message type', {
          sessionId: session.id,
          type: message.type
        });
        return { valid: false, error: 'Unauthorized message type', shouldBlock: true };
      }

      // Authentication check for protected operations
      if (this.config.requireAuthentication && 
          message.type !== 'auth' && 
          message.type !== 'ping' && 
          !session.authenticated) {
        logger.warn('WebSocket message rejected - authentication required', {
          sessionId: session.id,
          type: message.type
        });
        return { valid: false, error: 'Authentication required', shouldBlock: false };
      }

      // Rate limiting check
      try {
        await this.rateLimiter.consume(session.metadata.ip);
      } catch (rateLimiterRes) {
        logger.warn('WebSocket message rejected - rate limit exceeded', {
          sessionId: session.id,
          ip: session.metadata.ip
        });
        return { valid: false, error: 'Rate limit exceeded', shouldBlock: false };
      }

      // Content validation
      if (this.config.enableContentValidation) {
        const contentValidation = this.validateContent(message);
        if (!contentValidation.valid) {
          logger.warn('WebSocket message rejected - content validation failed', {
            sessionId: session.id,
            type: message.type,
            reason: contentValidation.reason
          });
          return { 
            valid: false, 
            error: contentValidation.reason, 
            shouldBlock: contentValidation.shouldBlock 
          };
        }
      }

      // Type-specific validation
      const typeValidation = this.validateMessageType(message);
      if (!typeValidation.valid) {
        logger.warn('WebSocket message rejected - type validation failed', {
          sessionId: session.id,
          type: message.type,
          error: typeValidation.error
        });
        return { valid: false, error: typeValidation.error, shouldBlock: false };
      }

      // Sanitize message
      const sanitizedMessage = this.sanitizeMessage(message);

      // Update session
      session.lastActivity = new Date();
      session.messageCount++;

      return { valid: true, message: sanitizedMessage };

    } catch (error) {
      logger.error('Error validating WebSocket message:', error);
      return { valid: false, error: 'Validation error', shouldBlock: false };
    }
  }

  private validateContent(message: any): { valid: boolean; reason?: string; shouldBlock?: boolean } {
    const messageStr = JSON.stringify(message);

    // Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(messageStr)) {
        return { 
          valid: false, 
          reason: 'Message contains blocked pattern', 
          shouldBlock: true 
        };
      }
    }

    // Check for excessively nested objects (potential DoS)
    const depth = this.getObjectDepth(message);
    if (depth > 10) {
      return { 
        valid: false, 
        reason: 'Message too deeply nested', 
        shouldBlock: true 
      };
    }

    // Check for excessive array lengths
    if (this.hasLargeArrays(message, 1000)) {
      return { 
        valid: false, 
        reason: 'Message contains overly large arrays', 
        shouldBlock: true 
      };
    }

    return { valid: true };
  }

  private validateMessageType(message: any): { valid: boolean; error?: string } {
    try {
      switch (message.type) {
        case 'ping':
          return { valid: PingMessageSchema.safeParse(message).success };
        
        case 'auth':
          return { valid: AuthMessageSchema.safeParse(message).success };
        
        case 'subscribe':
        case 'unsubscribe':
          return { valid: SubscribeMessageSchema.safeParse(message).success };
        
        case 'llm_request':
          const validation = LLMRequestMessageSchema.safeParse(message);
          if (!validation.success) {
            return { 
              valid: false, 
              error: validation.error.errors.map(e => e.message).join(', ') 
            };
          }
          return { valid: true };
        
        default:
          return { valid: false, error: 'Unknown message type' };
      }
    } catch (error) {
      return { valid: false, error: 'Type validation error' };
    }
  }

  private sanitizeMessage(message: any): WebSocketMessage {
    // Deep clone to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(message));

    // Sanitize string fields
    this.sanitizeObject(sanitized);

    // Add timestamp if not present
    if (!sanitized.timestamp) {
      sanitized.timestamp = Date.now();
    }

    return sanitized;
  }

  private sanitizeObject(obj: any): void {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'string') {
          obj[index] = this.sanitizeString(item);
        } else if (typeof item === 'object' && item !== null) {
          this.sanitizeObject(item);
        }
      });
      return;
    }

    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = this.sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.sanitizeObject(obj[key]);
        }
      });
    }
  }

  private sanitizeString(str: string): string {
    return str
      // Remove control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
      // Limit length
      .substring(0, 10000);
  }

  private getObjectDepth(obj: any, depth = 0): number {
    if (depth > 20) return depth; // Prevent stack overflow
    
    if (typeof obj !== 'object' || obj === null) {
      return depth;
    }

    if (Array.isArray(obj)) {
      return Math.max(...obj.map(item => this.getObjectDepth(item, depth + 1)));
    }

    return Math.max(...Object.values(obj).map(value => this.getObjectDepth(value, depth + 1)));
  }

  private hasLargeArrays(obj: any, maxSize: number): boolean {
    if (Array.isArray(obj)) {
      if (obj.length > maxSize) return true;
      return obj.some(item => this.hasLargeArrays(item, maxSize));
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => this.hasLargeArrays(value, maxSize));
    }

    return false;
  }

  async authenticateSession(ws: WebSocket, userId: string, token: string): Promise<boolean> {
    const session = this.sessions.get(ws);
    if (!session) return false;

    try {
      // Here you would validate the token against your auth system
      // For now, we'll do basic validation
      if (!token || token.length < 10) {
        return false;
      }

      session.authenticated = true;
      session.userId = userId;
      session.lastActivity = new Date();

      logger.info('WebSocket session authenticated', {
        sessionId: session.id,
        userId
      });

      return true;
    } catch (error) {
      logger.error('Error authenticating WebSocket session:', error);
      return false;
    }
  }

  getSession(ws: WebSocket): WebSocketSession | undefined {
    return this.sessions.get(ws);
  }

  closeSession(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (session) {
      logger.info('WebSocket session closed', {
        sessionId: session.id,
        userId: session.userId,
        duration: Date.now() - session.createdAt.getTime()
      });
      this.sessions.delete(ws);
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private getClientIp(request: any): string {
    return request.socket.remoteAddress || 
           request.connection.remoteAddress || 
           request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           'unknown';
  }

  private isValidOrigin(origin: string): boolean {
    const allowedOrigins = process.env.ALLOWED_WEBSOCKET_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://localhost:3000'
    ];
    
    return allowedOrigins.includes(origin);
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expired: WebSocket[] = [];

      this.sessions.forEach((session, ws) => {
        if (now.getTime() - session.lastActivity.getTime() > this.config.sessionTimeout) {
          expired.push(ws);
        }
      });

      expired.forEach(ws => {
        logger.info('Cleaning up expired WebSocket session');
        this.closeSession(ws);
        if (ws.readyState === ws.OPEN) {
          ws.close(1000, 'Session timeout');
        }
      });
    }, 60000); // Check every minute
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  getStats(): {
    activeSessions: number;
    authenticatedSessions: number;
    totalMessages: number;
  } {
    let authenticatedCount = 0;
    let totalMessages = 0;

    this.sessions.forEach(session => {
      if (session.authenticated) authenticatedCount++;
      totalMessages += session.messageCount;
    });

    return {
      activeSessions: this.sessions.size,
      authenticatedSessions: authenticatedCount,
      totalMessages
    };
  }
}