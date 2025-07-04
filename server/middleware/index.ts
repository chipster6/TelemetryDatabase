/**
 * Middleware exports for easy importing
 * Provides centralized access to all middleware classes
 */

import { SecurityMiddleware } from './SecurityMiddleware';
import { SessionMiddleware } from './SessionMiddleware';
import { LoggingMiddleware } from './LoggingMiddleware';

export { SecurityMiddleware, SessionMiddleware, LoggingMiddleware };

// Type definitions for extended Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
    
    interface Session {
      userId?: number;
      username?: string;
      role?: string;
      userRole?: string;
      lastActivity?: number;
      lastPath?: string;
      requestCount?: number;
      csrfToken?: string;
    }
  }
}

/**
 * Middleware configuration helpers
 */
export class MiddlewareManager {
  
  /**
   * Apply all security middleware in correct order
   */
  static applySecurity(app: any, config: any) {
    // Basic security headers
    app.use(SecurityMiddleware.helmet());
    app.use(SecurityMiddleware.securityHeaders());
    
    // CORS configuration
    app.use(SecurityMiddleware.cors(config));
    
    // Rate limiting
    const rateLimiters = SecurityMiddleware.rateLimiting();
    app.use(rateLimiters.general);
    app.use('/api', rateLimiters.api);
    
    return app;
  }

  /**
   * Apply all session middleware in correct order
   */
  static applySession(app: any, pool: any, config: any) {
    // Session configuration
    app.use(SessionMiddleware.configure(pool, config));
    
    // Session security
    app.use(SessionMiddleware.concurrentSessionLimiter(config));
    app.use(SessionMiddleware.generateCSRFToken());
    app.use(SessionMiddleware.sessionTimeout()); // Uses SESSION.TIMEOUT_MINUTES constant
    
    return app;
  }

  /**
   * Apply all logging middleware in correct order
   */
  static applyLogging(app: any) {
    // Request correlation and logging
    app.use(LoggingMiddleware.correlationId());
    app.use(LoggingMiddleware.requestLogger());
    
    // Monitoring and security
    app.use(LoggingMiddleware.performanceMonitor()); // Uses REQUEST.SLOW_REQUEST_THRESHOLD constant
    app.use(LoggingMiddleware.securityLogger());
    app.use(LoggingMiddleware.rateMonitor());
    
    return app;
  }

  /**
   * Apply error handling middleware (should be last)
   */
  static applyErrorHandling(app: any) {
    app.use(LoggingMiddleware.errorHandler());
    return app;
  }

  /**
   * Apply all middleware in the correct order
   */
  static applyAll(app: any, pool: any, config: any) {
    // Order is important for middleware
    this.applySecurity(app, config);
    this.applySession(app, pool, config);
    this.applyLogging(app);
    
    // Note: Error handling should be applied after routes are registered
    return app;
  }

  /**
   * Get middleware statistics
   */
  static getStats() {
    return {
      sessionStats: SessionMiddleware.getSessionStats(),
      timestamp: new Date().toISOString()
    };
  }
}