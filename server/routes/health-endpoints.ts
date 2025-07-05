import { Request, Response } from 'express';
import { healthCheckService } from '../services/HealthCheckService';
import { HTTP_STATUS } from '../constants/ApplicationConstants';

/**
 * Health monitoring endpoints
 * Provides comprehensive health status for all system components
 */
export class HealthEndpoints {

  /**
   * Comprehensive health check endpoint
   * Returns detailed status of all services
   */
  static getComprehensiveHealth = async (req: Request, res: Response) => {
    try {
      const healthReport = await healthCheckService.performHealthCheck();
      
      // Set appropriate HTTP status based on overall health
      let httpStatus = HTTP_STATUS.OK;
      if (healthReport.overall === 'degraded') {
        httpStatus = HTTP_STATUS.OK; // Still OK but with degraded status
      } else if (healthReport.overall === 'unhealthy') {
        httpStatus = HTTP_STATUS.SERVICE_UNAVAILABLE; // 503
      }

      res.status(httpStatus).json(healthReport);
    } catch (error) {
      console.error('Comprehensive health check failed:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        overall: 'unhealthy',
        error: 'Health check system failure',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Quick health check endpoint
   * Returns basic status for load balancer health checks
   */
  static getQuickHealth = async (req: Request, res: Response) => {
    try {
      const quickHealth = await healthCheckService.quickHealthCheck();
      
      const httpStatus = quickHealth.status === 'healthy' 
        ? HTTP_STATUS.OK 
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(httpStatus).json(quickHealth);
    } catch (error) {
      console.error('Quick health check failed:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Legacy health endpoint
   * Maintains backward compatibility with existing health check
   */
  static getLegacyHealth = async (req: Request, res: Response) => {
    try {
      const quickHealth = await healthCheckService.quickHealthCheck();
      
      // Legacy format for backward compatibility
      res.json({
        status: quickHealth.status,
        timestamp: quickHealth.timestamp,
        uptime: process.uptime()
      });
    } catch (error) {
      console.error('Legacy health check failed:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    }
  };

  /**
   * Database-specific health check
   */
  static getDatabaseHealth = async (req: Request, res: Response) => {
    try {
      const fullHealth = await healthCheckService.performHealthCheck();
      const dbHealth = fullHealth.services.find(s => s.service === 'database');

      if (!dbHealth) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Database health check not available'
        });
      }

      const httpStatus = dbHealth.status === 'healthy' 
        ? HTTP_STATUS.OK 
        : dbHealth.status === 'degraded'
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(httpStatus).json(dbHealth);
    } catch (error) {
      console.error('Database health check failed:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        service: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Redis-specific health check
   */
  static getRedisHealth = async (req: Request, res: Response) => {
    try {
      const fullHealth = await healthCheckService.performHealthCheck();
      const redisHealth = fullHealth.services.find(s => s.service === 'redis');

      if (!redisHealth) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Redis health check not available'
        });
      }

      const httpStatus = redisHealth.status === 'healthy' 
        ? HTTP_STATUS.OK 
        : redisHealth.status === 'degraded'
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(httpStatus).json(redisHealth);
    } catch (error) {
      console.error('Redis health check failed:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        service: 'redis',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Redis health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Weaviate-specific health check
   */
  static getWeaviateHealth = async (req: Request, res: Response) => {
    try {
      const fullHealth = await healthCheckService.performHealthCheck();
      const weaviateHealth = fullHealth.services.find(s => s.service === 'weaviate');

      if (!weaviateHealth) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Weaviate health check not available'
        });
      }

      const httpStatus = weaviateHealth.status === 'healthy' 
        ? HTTP_STATUS.OK 
        : weaviateHealth.status === 'degraded'
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(httpStatus).json(weaviateHealth);
    } catch (error) {
      console.error('Weaviate health check failed:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        service: 'weaviate',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Weaviate health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * System readiness check
   * Returns 200 only when ALL critical services are healthy
   */
  static getReadiness = async (req: Request, res: Response) => {
    try {
      const healthReport = await healthCheckService.performHealthCheck();
      
      // Check if critical services (database, redis) are healthy
      const criticalServices = healthReport.services.filter(s => 
        s.service === 'database' || s.service === 'redis'
      );
      
      const allCriticalHealthy = criticalServices.every(s => s.status === 'healthy');
      
      if (allCriticalHealthy) {
        res.json({
          ready: true,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          ready: false,
          criticalServices: criticalServices.map(s => ({
            service: s.service,
            status: s.status
          })),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Readiness check failed:', error);
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        ready: false,
        error: 'Readiness check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Liveness check
   * Simple endpoint to verify the service is running
   */
  static getLiveness = (req: Request, res: Response) => {
    res.json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  };
}