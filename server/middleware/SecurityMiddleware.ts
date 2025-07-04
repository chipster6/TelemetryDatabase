import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { ConfigurationManager } from "../config/ConfigurationManager";
import { RATE_LIMITING, SECURITY, TIME, HTTP_STATUS, SESSION } from "../constants/ApplicationConstants";

/**
 * Security middleware collection for Express application
 * Handles helmet security headers, CORS configuration, and rate limiting
 */
export class SecurityMiddleware {
  
  /**
   * Configure Helmet security headers
   * Extracted from index.ts lines 22-37
   */
  static helmet() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isDevelopment 
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Allow Vite dev scripts only in development
            : ["'self'"],
          styleSrc: isDevelopment
            ? ["'self'", "'unsafe-inline'"] // Allow inline styles only in development
            : ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: isDevelopment
            ? ["'self'", "ws:", "wss:"] // WebSocket for dev server
            : ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: SECURITY.HSTS_MAX_AGE,
        includeSubDomains: true,
        preload: true
      },
      // Additional security headers for production
      crossOriginEmbedderPolicy: !isDevelopment,
      crossOriginOpenerPolicy: !isDevelopment,
      crossOriginResourcePolicy: !isDevelopment
    });
  }

  /**
   * Configure CORS with dynamic origin checking from environment
   * Reads allowed origins from environment variables for better security
   */
  static cors(config: ConfigurationManager) {
    return cors({
      origin: (origin, callback) => {
        // Get allowed origins from environment variables
        const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
          ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
          : config.get<string[]>('security.allowedOrigins', []);

        // Allow same-origin requests (no origin header)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, allow common development origins if not explicitly configured
        if (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) {
          const defaultDevOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173', 
            'http://localhost:3000',
            'http://127.0.0.1:3000'
          ];
          if (defaultDevOrigins.includes(origin)) {
            return callback(null, true);
          }
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-csrf-token',
        'x-request-id',
        'x-correlation-id'
      ],
      exposedHeaders: ['x-request-id', 'x-correlation-id'],
      maxAge: 86400 // 24 hours preflight cache
    });
  }

  /**
   * Configure rate limiting for general and API endpoints
   * Extracted from index.ts lines 68-89
   */
  static rateLimiting() {
    return {
      // General rate limiter
      general: rateLimit({
        windowMs: RATE_LIMITING.WINDOW_MS,
        max: RATE_LIMITING.MAX_REQUESTS,
        message: {
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: RATE_LIMITING.WINDOW_MS / 1000 // seconds
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),

      // API rate limiter (more restrictive)
      api: rateLimit({
        windowMs: RATE_LIMITING.WINDOW_MS,
        max: RATE_LIMITING.API_MAX_REQUESTS,
        message: {
          error: 'Too many API requests, please try again later.'
        }
      })
    };
  }

  /**
   * Configure custom rate limiting with specific parameters
   */
  static customRateLimit(options: {
    windowMs?: number;
    max?: number;
    message?: string | object;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  }) {
    return rateLimit({
      windowMs: options.windowMs || RATE_LIMITING.WINDOW_MS,
      max: options.max || RATE_LIMITING.MAX_REQUESTS,
      message: options.message || {
        error: 'Rate limit exceeded, please try again later.'
      },
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Security headers middleware for additional protection
   */
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Remove server header
      res.removeHeader('X-Powered-By');
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      next();
    };
  }

  /**
   * IP whitelisting middleware for sensitive endpoints
   */
  static ipWhitelist(allowedIps: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      
      if (!clientIp || !allowedIps.includes(clientIp as string)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied: IP not whitelisted',
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  }

  /**
   * Request size limiting middleware
   */
  static requestSizeLimit(maxSize: string = '10mb') {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength, 10);
        const maxSizeInBytes = this.parseSize(maxSize);
        
        if (sizeInBytes > maxSizeInBytes) {
          return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
            error: 'Request entity too large',
            maxSize,
            receivedSize: this.formatBytes(sizeInBytes),
            timestamp: new Date().toISOString()
          });
        }
      }
      
      next();
    };
  }

  /**
   * Enhanced double-submit CSRF protection middleware
   * Uses both session storage and signed cookie for additional security
   */
  static csrfProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF check for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      const headerToken = req.headers['x-csrf-token'] as string;
      const cookieToken = req.cookies['csrf-token'];
      const sessionToken = req.session?.csrfToken;
      
      // Double-submit cookie pattern: token must match both session and cookie
      if (!headerToken || !sessionToken || !cookieToken) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'CSRF token missing',
          timestamp: new Date().toISOString()
        });
      }
      
      if (headerToken !== sessionToken || headerToken !== cookieToken) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'CSRF token mismatch',
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  }

  /**
   * Generate and set CSRF tokens (both session and cookie)
   */
  static generateCSRFTokens() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session && !req.session.csrfToken) {
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        
        // Store in session
        req.session.csrfToken = token;
        
        // Set as httpOnly cookie for double-submit pattern
        res.cookie('csrf-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: SESSION.MAX_AGE
        });
        
        // Also expose in response header for client to read
        res.setHeader('X-CSRF-Token', token);
      }
      
      next();
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Parse size string to bytes
   */
  private static parseSize(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };
    
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }
    
    const [, value, unit = 'b'] = match;
    return Math.floor(parseFloat(value) * units[unit]);
  }

  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}