import { redisConnectionManager } from './RedisConnectionManager';
import { weaviateConnectionManager } from './WeaviateConnectionManager';
import { pool as dbPool } from '../db';
import { secureMemoryManager } from './security/SecureMemoryManager';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency?: number;
  details?: any;
  error?: string;
  timestamp: string;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthCheckResult[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
  uptime: number;
  timestamp: string;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private startTime: number = Date.now();

  private constructor() {}

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Perform comprehensive health check of all services
   */
  async performHealthCheck(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    
    // Run all health checks in parallel for better performance
    const [
      databaseHealth,
      redisHealth,
      weaviateHealth,
      memoryHealth,
      systemHealth
    ] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkWeaviateHealth(),
      this.checkMemoryHealth(),
      this.checkSystemHealth()
    ]);

    const services: HealthCheckResult[] = [
      this.extractResult(databaseHealth, 'database'),
      this.extractResult(redisHealth, 'redis'),
      this.extractResult(weaviateHealth, 'weaviate'),
      this.extractResult(memoryHealth, 'memory'),
      this.extractResult(systemHealth, 'system')
    ];

    // Calculate summary
    const summary = {
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      total: services.length
    };

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overall = 'unhealthy';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      services,
      summary,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Quick health check for basic monitoring
   */
  async quickHealthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      // Just check if critical services are responding
      const [dbCheck, redisCheck] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkRedisHealth()
      ]);

      const dbHealthy = dbCheck.status === 'fulfilled' && dbCheck.value.status !== 'unhealthy';
      const redisHealthy = redisCheck.status === 'fulfilled' && redisCheck.value.status !== 'unhealthy';

      const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
      
      return {
        status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const result = await dbPool.query('SELECT 1 as health_check');
      const latency = Date.now() - startTime;

      // Check pool stats
      const poolStats = {
        totalConnections: dbPool.totalCount,
        idleConnections: dbPool.idleCount,
        waitingClients: dbPool.waitingCount
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (latency > 1000) { // > 1 second is degraded
        status = 'degraded';
      }
      if (latency > 5000) { // > 5 seconds is unhealthy
        status = 'unhealthy';
      }

      return {
        service: 'database',
        status,
        latency,
        details: poolStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const client = redisConnectionManager.getClient();
      if (!client) {
        throw new Error('Redis client not available');
      }

      // Test basic connectivity with ping
      await client.ping();
      const latency = Date.now() - startTime;

      // Get Redis info
      const info = await client.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (latency > 500) { // > 500ms is degraded
        status = 'degraded';
      }
      if (latency > 2000) { // > 2 seconds is unhealthy
        status = 'unhealthy';
      }

      return {
        service: 'redis',
        status,
        latency,
        details: {
          connected: true,
          memoryUsed: memoryInfo.used_memory_human,
          maxMemory: memoryInfo.maxmemory_human || 'unlimited'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Redis connection failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check Weaviate connectivity and performance
   */
  private async checkWeaviateHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const client = await weaviateConnectionManager.getClient();
      
      // Test basic connectivity
      const meta = await client.misc.metaGetter().do();
      const latency = Date.now() - startTime;

      // Get pool stats
      const poolStats = weaviateConnectionManager.getPoolStats();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (latency > 1000 || poolStats.failedConnections > 0) {
        status = 'degraded';
      }
      if (latency > 3000 || poolStats.activeConnections === 0) {
        status = 'unhealthy';
      }

      return {
        service: 'weaviate',
        status,
        latency,
        details: {
          version: meta.version,
          poolStats
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'weaviate',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Weaviate connection failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check secure memory manager status
   */
  private async checkMemoryHealth(): Promise<HealthCheckResult> {
    try {
      const memoryStats = secureMemoryManager.getMemoryStats();
      const processMemory = process.memoryUsage();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (memoryStats.memoryPressure > 0.8) {
        status = 'degraded';
      }
      if (memoryStats.memoryPressure > 0.95) {
        status = 'unhealthy';
      }

      return {
        service: 'memory',
        status,
        details: {
          secureBuffers: memoryStats.totalBuffers,
          memoryPressure: memoryStats.memoryPressure,
          processMemory: {
            rss: Math.round(processMemory.rss / 1024 / 1024),
            heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024)
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Memory check failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check overall system health
   */
  private async checkSystemHealth(): Promise<HealthCheckResult> {
    try {
      const processMemory = process.memoryUsage();
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();

      // Calculate memory usage percentage (rough estimate)
      const memoryUsagePercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (memoryUsagePercent > 80 || uptime < 60) { // High memory or recently restarted
        status = 'degraded';
      }
      if (memoryUsagePercent > 95) {
        status = 'unhealthy';
      }

      return {
        service: 'system',
        status,
        details: {
          uptime: Math.floor(uptime),
          memoryUsage: {
            heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024),
            usagePercent: Math.round(memoryUsagePercent)
          },
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'system',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'System check failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract result from Promise.allSettled
   */
  private extractResult(
    result: PromiseSettledResult<HealthCheckResult>,
    serviceName: string
  ): HealthCheckResult {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        service: serviceName,
        status: 'unhealthy',
        error: result.reason?.message || 'Service check failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse Redis INFO output
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = value;
      }
    }
    
    return parsed;
  }
}

export const healthCheckService = HealthCheckService.getInstance();