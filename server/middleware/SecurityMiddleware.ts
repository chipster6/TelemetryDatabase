import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { ConfigurationManager } from "../config/ConfigurationManager";
import { productionSecurityConfig } from "../config/ProductionSecurityConfig";
import { RATE_LIMITING, SECURITY, TIME, HTTP_STATUS, SESSION } from "../constants/ApplicationConstants";

/**
 * Security middleware collection for Express application
 * Handles helmet security headers, CORS configuration, and rate limiting
 */
export class SecurityMiddleware {
  
  /**
   * Configure Helmet security headers with production hardening
   */
  static helmet() {
    const cspConfig = productionSecurityConfig.getCSPConfig();
    const securityHeaders = productionSecurityConfig.getSecurityHeaders();
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return helmet({
      contentSecurityPolicy: {
        directives: cspConfig,
        reportOnly: false // Enforce CSP in production
      },
      hsts: {
        maxAge: SECURITY.HSTS_MAX_AGE,
        includeSubDomains: true,
        preload: true
      },
      // Cross-origin policies for production hardening
      crossOriginEmbedderPolicy: !isDevelopment,
      crossOriginOpenerPolicy: !isDevelopment,
      crossOriginResourcePolicy: !isDevelopment,
      // Additional Helmet options for enhanced security
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permittedCrossDomainPolicies: false,
      hidePoweredBy: true
    });
  }

  /**
   * Configure CORS with production-hardened origin checking
   */
  static cors(config: ConfigurationManager) {
    const corsConfig = productionSecurityConfig.getCorsConfig();
    
    return cors({
      origin: (origin, callback) => {
        // Allow same-origin requests (no origin header) for local requests
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in production-validated allowed list
        if (corsConfig.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, allow common development origins if no origins configured
        if (process.env.NODE_ENV === 'development' && corsConfig.allowedOrigins.length === 0) {
          const defaultDevOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173', 
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5000',
            'http://127.0.0.1:5000'
          ];
          if (defaultDevOrigins.includes(origin)) {
            return callback(null, true);
          }
        }

        // Enhanced error logging for production debugging
        console.warn(`🚫 CORS: Origin "${origin}" rejected. Allowed origins:`, corsConfig.allowedOrigins);
        return callback(new Error(`CORS: Origin ${origin} not allowed by security policy`));
      },
      credentials: corsConfig.credentials,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      exposedHeaders: corsConfig.exposedHeaders,
      maxAge: corsConfig.maxAge,
      // Production hardening options
      preflightContinue: false,
      optionsSuccessStatus: 204
    });
  }

  /**
   * Configure production-hardened rate limiting
   */
  static rateLimiting() {
    const rateLimitConfig = productionSecurityConfig.getRateLimitConfig();
    const trustedProxies = productionSecurityConfig.getTrustedProxies();
    
    return {
      // General rate limiter with production hardening
      general: rateLimit({
        windowMs: rateLimitConfig.windowMs,
        max: rateLimitConfig.maxRequests,
        message: {
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: rateLimitConfig.windowMs / 1000,
          timestamp: new Date().toISOString()
        },
        standardHeaders: rateLimitConfig.standardHeaders,
        legacyHeaders: rateLimitConfig.legacyHeaders,
        trustProxy: trustedProxies,
        skip: (req) => {
          // Skip rate limiting for health checks
          return req.path === '/health' || req.path === '/api/health';
        },
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      }),

      // API rate limiter (more restrictive for production)
      api: rateLimit({
        windowMs: rateLimitConfig.windowMs,
        max: rateLimitConfig.apiMaxRequests,
        message: {
          error: 'API rate limit exceeded. Please try again later.',
          limit: rateLimitConfig.apiMaxRequests,
          window: `${rateLimitConfig.windowMs / 1000}s`,
          timestamp: new Date().toISOString()
        },
        standardHeaders: rateLimitConfig.standardHeaders,
        legacyHeaders: rateLimitConfig.legacyHeaders,
        trustProxy: trustedProxies,
        skipSuccessfulRequests: rateLimitConfig.skipSuccessfulRequests,
        skipFailedRequests: rateLimitConfig.skipFailedRequests
      }),

      // Strict rate limiter for sensitive endpoints
      strict: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: process.env.NODE_ENV === 'production' ? 5 : 20, // Very restrictive in production
        message: {
          error: 'Sensitive endpoint rate limit exceeded. Access temporarily restricted.',
          timestamp: new Date().toISOString()
        },
        standardHeaders: true,
        legacyHeaders: false,
        trustProxy: trustedProxies,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
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
   * IP whitelisting middleware for sensitive endpoints with production configuration
   */
  static ipWhitelist(customAllowedIps?: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const allowedIps = customAllowedIps || productionSecurityConfig.getIPWhitelist();
      
      // If no whitelist configured, allow all (but log in production)
      if (allowedIps.length === 0) {
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️  IP whitelist not configured for sensitive endpoint:', req.path);
        }
        return next();
      }

      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const ipString = Array.isArray(clientIp) ? clientIp[0] : clientIp as string;
      
      if (!ipString || !allowedIps.includes(ipString)) {
        console.warn(`🚫 IP whitelist rejection: ${ipString} attempted to access ${req.path}`);
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied: IP address not authorized for this endpoint',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
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

  /**
   * Security validation endpoint middleware
   * Provides real-time security configuration validation
   */
  static securityValidationEndpoint() {
    return (req: Request, res: Response) => {
      try {
        const securityReport = productionSecurityConfig.generateSecurityReport();
        
        // Add runtime security metrics
        const runtimeMetrics = {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        };

        res.json({
          ...securityReport,
          runtime: runtimeMetrics,
          endpoints: {
            rateLimitStatus: 'active',
            corsStatus: 'configured',
            helmetStatus: 'active',
            sessionStatus: 'configured'
          }
        });
      } catch (error) {
        console.error('Security validation endpoint error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Security validation failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Security monitoring middleware
   * Logs security events and suspicious activity
   */
  static securityMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Monitor for suspicious patterns
      const suspiciousPatterns = [
        /\b(union|select|insert|delete|drop|create|alter)\b/i, // SQL injection attempts
        /<script|javascript:|on\w+=/i, // XSS attempts
        /\.\.\//g, // Path traversal attempts
        /proc\/self|\/etc\/passwd/i, // File inclusion attempts
      ];

      const userAgent = req.get('User-Agent') || '';
      const path = req.path;
      const query = JSON.stringify(req.query);
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      const testString = `${path} ${query} ${body}`.toLowerCase();
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(testString)) {
          console.warn('🚨 SECURITY ALERT: Suspicious pattern detected', {
            ip: req.ip,
            userAgent,
            path,
            pattern: pattern.toString(),
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          });
          break;
        }
      }

      // Log admin endpoint access
      if (path.includes('/admin') || path.includes('/debug') || path.includes('/security')) {
        console.info('🔐 Admin endpoint access', {
          ip: req.ip,
          userAgent,
          path,
          method: req.method,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }

      next();
    };
  }

  /**
   * Get comprehensive security status
   */
  static getSecurityStatus() {
    const validation = productionSecurityConfig.validateSecurityConfig();
    const corsConfig = productionSecurityConfig.getCorsConfig();
    const sessionConfig = productionSecurityConfig.getSessionConfig();
    const rateLimitConfig = productionSecurityConfig.getRateLimitConfig();

    return {
      overall: validation.isValid ? 'secure' : 'needs_attention',
      validation,
      configuration: {
        cors: {
          originsCount: corsConfig.allowedOrigins.length,
          strictMode: corsConfig.strictMode,
          credentials: corsConfig.credentials
        },
        session: {
          maxAge: sessionConfig.maxAge,
          secure: sessionConfig.secure,
          sameSite: sessionConfig.sameSite,
          httpOnly: sessionConfig.httpOnly
        },
        rateLimit: {
          maxRequests: rateLimitConfig.maxRequests,
          apiMaxRequests: rateLimitConfig.apiMaxRequests,
          windowMs: rateLimitConfig.windowMs
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}