import { Request, Response, NextFunction } from 'express';
import { performanceMonitoringService } from '../services/performance/PerformanceMonitoringService';
import { environmentConfig } from '../config/EnvironmentConfig';

/**
 * Enhanced request object with performance tracking
 */
interface PerformanceRequest extends Request {
  performanceId?: string;
  startTime?: number;
}

/**
 * Performance monitoring middleware
 * Automatically tracks HTTP request performance metrics
 */
export class PerformanceMiddleware {
  private static isEnabled: boolean = environmentConfig.get('monitoring').enablePerformanceTracking;
  private static requestTracker = new Map<string, { startTime: number; endpoint: string }>();

  /**
   * Main performance monitoring middleware
   */
  static monitor() {
    return (req: PerformanceRequest, res: Response, next: NextFunction) => {
      if (!PerformanceMiddleware.isEnabled) {
        return next();
      }

      try {
        // Record request start
        const requestId = performanceMonitoringService.recordRequestStart();
        const startTime = Date.now();
        
        req.performanceId = requestId;
        req.startTime = startTime;

        // Track endpoint
        const endpoint = `${req.method} ${req.route?.path || req.path}`;
        PerformanceMiddleware.requestTracker.set(requestId, { startTime, endpoint });

        // Monitor response
        const originalSend = res.send;
        res.send = function(data?: any) {
          // Record request completion
          if (req.performanceId) {
            performanceMonitoringService.recordRequestEnd(req.performanceId, res.statusCode);
            PerformanceMiddleware.requestTracker.delete(req.performanceId);
          }

          // Add performance headers
          const responseTime = Date.now() - (req.startTime || Date.now());
          res.setHeader('X-Response-Time', `${responseTime}ms`);
          res.setHeader('X-Request-ID', req.performanceId || 'unknown');

          return originalSend.call(this, data);
        };

        // Handle connection abort
        req.on('close', () => {
          if (req.performanceId && PerformanceMiddleware.requestTracker.has(req.performanceId)) {
            performanceMonitoringService.recordRequestEnd(req.performanceId, res.statusCode || 499);
            PerformanceMiddleware.requestTracker.delete(req.performanceId);
          }
        });

        next();

      } catch (error) {
        console.error('Performance middleware error:', error);
        next(); // Continue even if performance tracking fails
      }
    };
  }

  /**
   * Database query performance monitoring
   */
  static monitorDatabaseQuery(queryName: string) {
    return async <T>(queryFunction: () => Promise<T>): Promise<T> => {
      if (!PerformanceMiddleware.isEnabled) {
        return queryFunction();
      }

      const startTime = Date.now();
      const timerId = `db_query_${queryName}_${Date.now()}`;

      try {
        const result = await queryFunction();
        const duration = Date.now() - startTime;
        
        // Log slow queries
        const slowQueryThreshold = environmentConfig.getPath<number>('database.slowQueryThreshold') || 1000;
        if (duration > slowQueryThreshold) {
          console.warn(`🐌 Slow database query detected: ${queryName} took ${duration}ms`);
        }

        // Emit query performance event
        performanceMonitoringService.emit('databaseQuery', {
          queryName,
          duration,
          success: true,
          timestamp: Date.now()
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        
        performanceMonitoringService.emit('databaseQuery', {
          queryName,
          duration,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });

        throw error;
      }
    };
  }

  /**
   * Redis operation performance monitoring
   */
  static monitorRedisOperation(operationName: string) {
    return async <T>(operationFunction: () => Promise<T>): Promise<T> => {
      if (!PerformanceMiddleware.isEnabled) {
        return operationFunction();
      }

      const startTime = Date.now();

      try {
        const result = await operationFunction();
        const duration = Date.now() - startTime;

        performanceMonitoringService.emit('redisOperation', {
          operationName,
          duration,
          success: true,
          timestamp: Date.now()
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        
        performanceMonitoringService.emit('redisOperation', {
          operationName,
          duration,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });

        throw error;
      }
    };
  }

  /**
   * Weaviate operation performance monitoring
   */
  static monitorWeaviateOperation(operationName: string) {
    return async <T>(operationFunction: () => Promise<T>): Promise<T> => {
      if (!PerformanceMiddleware.isEnabled) {
        return operationFunction();
      }

      const startTime = Date.now();

      try {
        const result = await operationFunction();
        const duration = Date.now() - startTime;

        performanceMonitoringService.emit('weaviateOperation', {
          operationName,
          duration,
          success: true,
          timestamp: Date.now()
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        
        performanceMonitoringService.emit('weaviateOperation', {
          operationName,
          duration,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });

        throw error;
      }
    };
  }

  /**
   * Biometric processing performance monitoring
   */
  static monitorBiometricProcessing(operationName: string) {
    return async <T>(processingFunction: () => Promise<T>): Promise<T> => {
      if (!PerformanceMiddleware.isEnabled) {
        return processingFunction();
      }

      const startTime = Date.now();

      try {
        const result = await processingFunction();
        const duration = Date.now() - startTime;

        performanceMonitoringService.emit('biometricProcessing', {
          operationName,
          duration,
          success: true,
          timestamp: Date.now()
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        
        performanceMonitoringService.emit('biometricProcessing', {
          operationName,
          duration,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });

        throw error;
      }
    };
  }

  /**
   * Custom operation performance monitoring
   */
  static monitorOperation(operationName: string, category: string = 'general') {
    return async <T>(operationFunction: () => Promise<T>): Promise<T> => {
      if (!PerformanceMiddleware.isEnabled) {
        return operationFunction();
      }

      const startTime = Date.now();

      try {
        const result = await operationFunction();
        const duration = Date.now() - startTime;

        performanceMonitoringService.emit('customOperation', {
          operationName,
          category,
          duration,
          success: true,
          timestamp: Date.now()
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        
        performanceMonitoringService.emit('customOperation', {
          operationName,
          category,
          duration,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });

        throw error;
      }
    };
  }

  /**
   * Rate limiting performance middleware
   */
  static rateLimitMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!PerformanceMiddleware.isEnabled) {
        return next();
      }

      const originalSend = res.send;
      res.send = function(data?: any) {
        // Track rate limiting events
        if (res.statusCode === 429) {
          performanceMonitoringService.emit('rateLimitHit', {
            endpoint: `${req.method} ${req.path}`,
            ip: req.ip,
            timestamp: Date.now()
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Memory usage monitoring middleware
   */
  static memoryMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!PerformanceMiddleware.isEnabled) {
        return next();
      }

      const beforeMemory = process.memoryUsage();

      const originalSend = res.send;
      res.send = function(data?: any) {
        const afterMemory = process.memoryUsage();
        const memoryDelta = {
          heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
          heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
          rss: afterMemory.rss - beforeMemory.rss,
          external: afterMemory.external - beforeMemory.external
        };

        // Log significant memory increases
        if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
          console.warn(`🧠 Large memory increase detected: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB for ${req.method} ${req.path}`);
        }

        performanceMonitoringService.emit('memoryUsage', {
          endpoint: `${req.method} ${req.path}`,
          memoryDelta,
          timestamp: Date.now()
        });

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Error performance impact monitoring
   */
  static errorMonitor() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      if (PerformanceMiddleware.isEnabled) {
        performanceMonitoringService.emit('errorOccurred', {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          endpoint: `${req.method} ${req.path}`,
          timestamp: Date.now(),
          statusCode: res.statusCode || 500
        });
      }

      next(error);
    };
  }

  /**
   * Get current request tracking statistics
   */
  static getRequestTrackingStats(): {
    activeRequests: number;
    averageRequestAge: number;
    oldestRequest: number;
  } {
    const now = Date.now();
    const activeRequests = PerformanceMiddleware.requestTracker.size;
    
    if (activeRequests === 0) {
      return { activeRequests: 0, averageRequestAge: 0, oldestRequest: 0 };
    }

    const requestAges = Array.from(PerformanceMiddleware.requestTracker.values())
      .map(req => now - req.startTime);

    const averageRequestAge = requestAges.reduce((a, b) => a + b, 0) / requestAges.length;
    const oldestRequest = Math.max(...requestAges);

    return { activeRequests, averageRequestAge, oldestRequest };
  }

  /**
   * Enable or disable performance monitoring
   */
  static setEnabled(enabled: boolean): void {
    PerformanceMiddleware.isEnabled = enabled;
    console.log(`📊 Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if performance monitoring is enabled
   */
  static isPerformanceMonitoringEnabled(): boolean {
    return PerformanceMiddleware.isEnabled;
  }

  /**
   * Cleanup old request tracking data
   */
  static cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [requestId, data] of PerformanceMiddleware.requestTracker.entries()) {
      if (now - data.startTime > maxAge) {
        PerformanceMiddleware.requestTracker.delete(requestId);
        console.warn(`🧹 Cleaned up stale request tracking: ${requestId}`);
      }
    }
  }
}

// Start periodic cleanup
if (PerformanceMiddleware.isPerformanceMonitoringEnabled()) {
  setInterval(PerformanceMiddleware.cleanup, 60000); // Every minute
}