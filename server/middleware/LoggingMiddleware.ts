import { Request, Response, NextFunction } from "express";
import { log } from "../vite";
import { REQUEST, TIME, HTTP_STATUS, RATE_LIMITING } from "../constants/ApplicationConstants";
import { Logger } from "../utils/Logger";

/**
 * Logging middleware collection for Express application
 * Handles request logging, error handling, and audit logging
 */
export class LoggingMiddleware {
  private static logger = Logger.getInstance();

  /**
   * Request logging middleware with performance monitoring
   * Extracted from index.ts lines 142-170
   */
  static requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const path = req.path;
      let capturedJsonResponse: Record<string, any> | undefined = undefined;

      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
          if (capturedJsonResponse) {
            logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
          }

          if (logLine.length > REQUEST.MAX_LOG_LENGTH) {
            logLine = logLine.slice(0, REQUEST.MAX_LOG_LENGTH - 1) + "…";
          }

          log(logLine);
        }
      });

      next();
    };
  }

  /**
   * Enhanced request logger with configurable options
   */
  static enhancedRequestLogger(options: {
    logAllRequests?: boolean;
    maxLogLength?: number;
    includeHeaders?: boolean;
    includeBody?: boolean;
    sensitiveFields?: string[];
  } = {}) {
    const {
      logAllRequests = false,
      maxLogLength = REQUEST.ENHANCED_LOG_LENGTH,
      includeHeaders = false,
      includeBody = false,
      sensitiveFields = ['password', 'token', 'secret', 'key']
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const path = req.path;
      const method = req.method;
      const userAgent = req.get('User-Agent');
      const ip = req.ip || req.connection.remoteAddress;
      
      let capturedJsonResponse: Record<string, any> | undefined = undefined;

      // Capture response
      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        const duration = Date.now() - start;
        const shouldLog = logAllRequests || path.startsWith("/api");

        if (shouldLog) {
          let logData: any = {
            timestamp: new Date().toISOString(),
            method,
            path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip,
            userAgent
          };

          if (includeHeaders) {
            logData.headers = this.sanitizeObject(req.headers, sensitiveFields);
          }

          if (includeBody && req.body) {
            logData.requestBody = this.sanitizeObject(req.body, sensitiveFields);
          }

          if (capturedJsonResponse) {
            logData.responseBody = this.sanitizeObject(capturedJsonResponse, sensitiveFields);
          }

          if (req.session?.userId) {
            logData.userId = req.session.userId;
          }

          let logLine = JSON.stringify(logData);
          if (logLine.length > maxLogLength) {
            logLine = logLine.slice(0, maxLogLength - 1) + "…";
          }

          log(logLine);
        }
      });

      next();
    };
  }

  /**
   * Error handling middleware with security considerations
   * Extracted from index.ts lines 175-218
   */
  static errorHandler() {
    return (err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      
      // SECURITY FIX: Prevent stack trace disclosure in production
      let message = "Internal Server Error";
      if (process.env.NODE_ENV === "development") {
        message = err.message || "Internal Server Error";
      } else {
        // In production, only return generic error messages for security
        switch (status) {
          case HTTP_STATUS.BAD_REQUEST:
            message = "Bad Request";
            break;
          case HTTP_STATUS.UNAUTHORIZED:
            message = "Unauthorized";
            break;
          case HTTP_STATUS.FORBIDDEN:
            message = "Forbidden";
            break;
          case HTTP_STATUS.NOT_FOUND:
            message = "Not Found";
            break;
          case HTTP_STATUS.TOO_MANY_REQUESTS:
            message = "Too Many Requests";
            break;
          default:
            message = "Internal Server Error";
        }
      }

      // Log error details server-side but don't expose to client
      this.logger.error(`Error ${status} on ${req.method} ${req.path}`, err, {
        statusCode: status,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.session?.userId,
        correlationId: req.correlationId
      });

      res.status(status).json({ 
        error: message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    };
  }

  /**
   * Audit logging middleware for sensitive operations
   */
  static auditLogger(operationType: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const auditData = {
        timestamp: new Date().toISOString(),
        operationType,
        userId: req.session?.userId || 'anonymous',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        method: req.method,
        path: req.path,
        sessionId: req.sessionID
      };

      // Log before processing
      this.logger.audit(operationType, req.session?.userId || 'anonymous', req.path, auditData);

      // Capture response for audit trail
      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        const responseData = {
          ...auditData,
          statusCode: res.statusCode,
          success: res.statusCode < 400,
          responseSize: JSON.stringify(bodyJson).length
        };

        LoggingMiddleware.logger.audit(`${operationType} completed`, responseData.userId, req.path, responseData);
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  static performanceMonitor(slowRequestThreshold: number = REQUEST.SLOW_REQUEST_THRESHOLD) {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const startMemory = process.memoryUsage();

      res.on("finish", () => {
        const duration = Date.now() - start;
        const endMemory = process.memoryUsage();

        if (duration > slowRequestThreshold) {
          const performanceData = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            duration: `${duration}ms`,
            statusCode: res.statusCode,
            userId: req.session?.userId,
            memoryUsage: {
              heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
              heapTotal: endMemory.heapTotal,
              external: endMemory.external
            }
          };

          this.logger.performance(
            `Slow request: ${req.method} ${req.path}`,
            duration,
            'ms',
            performanceData
          );
        }
      });

      next();
    };
  }

  /**
   * Security event logging middleware
   */
  static securityLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const securityEvents: string[] = [];

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /script[^>]*>/i,
        /javascript:/i,
        /vbscript:/i,
        /onload/i,
        /onerror/i,
        /<iframe/i,
        /\.\./,  // Path traversal
        /union.*select/i,  // SQL injection
        /drop.*table/i,
        /exec.*xp_/i
      ];

      const checkForSuspiciousContent = (obj: any, path: string = '') => {
        if (typeof obj === 'string') {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(obj)) {
              securityEvents.push(`Suspicious pattern detected in ${path}: ${pattern.toString()}`);
            }
          }
        } else if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            checkForSuspiciousContent(value, `${path}.${key}`);
          }
        }
      };

      // Check request body
      if (req.body) {
        checkForSuspiciousContent(req.body, 'body');
      }

      // Check query parameters
      if (req.query) {
        checkForSuspiciousContent(req.query, 'query');
      }

      // Check headers for suspicious values
      const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'user-agent', 'referer'];
      for (const header of suspiciousHeaders) {
        const value = req.get(header);
        if (value) {
          checkForSuspiciousContent(value, `header.${header}`);
        }
      }

      if (securityEvents.length > 0) {
        const securityAlert = {
          timestamp: new Date().toISOString(),
          type: 'SECURITY_ALERT',
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          method: req.method,
          path: req.path,
          userId: req.session?.userId,
          events: securityEvents
        };

        this.logger.security('Potential threat detected', 'high', securityAlert);
      }

      next();
    };
  }

  /**
   * Request correlation middleware for distributed tracing
   */
  static correlationId() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Use existing request ID or generate new one
      const correlationId = req.headers['x-request-id'] || 
                           req.headers['x-correlation-id'] || 
                           this.generateCorrelationId();

      // Add to request headers
      req.headers['x-request-id'] = correlationId as string;
      
      // Add to response headers
      res.setHeader('x-request-id', correlationId);

      // Make available to other middleware
      (req as any).correlationId = correlationId;

      next();
    };
  }

  /**
   * Request rate monitoring middleware
   */
  static rateMonitor() {
    const requests = new Map<string, number[]>();
    const windowMs = TIME.MINUTE; // 1 minute window

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      if (!requests.has(key)) {
        requests.set(key, []);
      }
      
      const userRequests = requests.get(key)!;
      
      // Remove old requests outside the window
      const cutoff = now - windowMs;
      const recentRequests = userRequests.filter(time => time > cutoff);
      recentRequests.push(now);
      
      requests.set(key, recentRequests);
      
      // Log high-frequency users
      if (recentRequests.length > RATE_LIMITING.HIGH_FREQUENCY_THRESHOLD) {
        this.logger.warn(`High request frequency from ${key}: ${recentRequests.length} requests in last minute`, {
          ip: key,
          requestCount: recentRequests.length,
          timeWindow: 'last_minute'
        });
      }
      
      next();
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Sanitize object by removing sensitive fields
   */
  private static sanitizeObject(obj: any, sensitiveFields: string[]): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, sensitiveFields);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Generate unique correlation ID
   */
  private static generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Format log message with consistent structure
   */
  static formatLogMessage(level: string, message: string, metadata?: object): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...metadata
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Create custom logger with specific format
   */
  static createLogger(prefix: string) {
    const serviceLogger = Logger.createServiceLogger(prefix);
    return {
      info: (message: string, metadata?: object) => {
        serviceLogger.info(`[${prefix}] ${message}`, metadata);
      },
      warn: (message: string, metadata?: object) => {
        serviceLogger.warn(`[${prefix}] ${message}`, metadata);
      },
      error: (message: string, metadata?: object) => {
        serviceLogger.error(`[${prefix}] ${message}`, undefined, metadata);
      },
      debug: (message: string, metadata?: object) => {
        serviceLogger.debug(`[${prefix}] ${message}`, metadata);
      }
    };
  }
}