import { EventEmitter } from 'events';
import { PerformanceMonitor } from '../../utils/performance';
import { MetricsCollector, PerformanceMetrics } from '../biometric/MetricsCollector';
import { healthCheckService } from '../HealthCheckService';
import { redisConnectionManager } from '../RedisConnectionManager';
import { environmentConfig } from '../../config/EnvironmentConfig';

/**
 * System-wide performance metrics
 */
export interface SystemPerformanceMetrics {
  // Request/Response metrics
  requests: {
    total: number;
    active: number;
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    slowRequestsCount: number;
  };

  // Database metrics
  database: {
    connectionPoolSize: number;
    activeConnections: number;
    queryCount: number;
    averageQueryTime: number;
    slowQueriesCount: number;
    connectionErrors: number;
  };

  // Redis metrics
  redis: {
    connected: boolean;
    memoryUsage: string;
    operationsPerSecond: number;
    averageLatency: number;
    connectionErrors: number;
  };

  // Weaviate metrics
  weaviate: {
    connected: boolean;
    vectorOperations: number;
    averageSearchTime: number;
    indexSize: number;
    connectionErrors: number;
  };

  // Memory metrics
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    memoryPressure: number;
    gcStats: {
      collections: number;
      avgGcTime: number;
      lastGcTime: number;
    };
  };

  // CPU metrics
  cpu: {
    usage: number;
    loadAverage: number[];
    eventLoopDelay: number;
    eventLoopUtilization: number;
  };

  // Security metrics
  security: {
    encryptionOperations: number;
    averageEncryptionTime: number;
    securityEvents: number;
    threatDetections: number;
    blockedRequests: number;
  };

  // Application metrics
  application: {
    uptime: number;
    version: string;
    environment: string;
    nodeVersion: string;
    lastRestart: number;
  };
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlert {
  id: string;
  name: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq';
  metricPath: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldownMs: number;
}

/**
 * Performance trend data
 */
export interface PerformanceTrend {
  metric: string;
  current: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  timeWindow: string;
}

/**
 * Comprehensive Performance Monitoring Service
 * Collects, analyzes, and reports on all system performance metrics
 */
export class PerformanceMonitoringService extends EventEmitter {
  private static instance: PerformanceMonitoringService;
  private metricsCollector: MetricsCollector;
  private performanceMonitor: typeof PerformanceMonitor;
  private isEnabled: boolean;
  private collectionInterval: NodeJS.Timeout | null = null;
  private alertsMap: Map<string, PerformanceAlert> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private metricsHistory: SystemPerformanceMetrics[] = [];
  private maxHistorySize = 1000;
  private gcStats = { collections: 0, totalTime: 0, lastTime: 0 };
  private requestMetrics = {
    total: 0,
    active: 0,
    responseTimes: [] as number[],
    errors: 0,
    slowRequests: 0
  };

  private constructor() {
    super();
    this.metricsCollector = new MetricsCollector();
    this.performanceMonitor = PerformanceMonitor;
    this.isEnabled = environmentConfig.get('monitoring').enablePerformanceTracking;
    
    this.initializeAlerts();
    this.setupGCMonitoring();
    
    if (this.isEnabled) {
      this.startCollection();
      console.log('📊 Performance Monitoring Service initialized');
    }
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  /**
   * Start performance data collection
   */
  private startCollection(): void {
    if (this.collectionInterval) return;

    const interval = environmentConfig.get('monitoring').healthCheckInterval;
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    console.log(`📊 Performance metrics collection started (interval: ${interval}ms)`);
  }

  /**
   * Stop performance data collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      console.log('📊 Performance metrics collection stopped');
    }
  }

  /**
   * Collect comprehensive system performance metrics
   */
  async collectMetrics(): Promise<SystemPerformanceMetrics> {
    try {
      const startTime = Date.now();
      
      // Collect all metrics in parallel for efficiency
      const [healthReport, redisInfo, memoryUsage] = await Promise.allSettled([
        healthCheckService.performHealthCheck(),
        this.getRedisMetrics(),
        this.getDetailedMemoryUsage()
      ]);

      const cpuMetrics = this.getCPUMetrics();
      const biometricMetrics = this.metricsCollector.getMetrics();
      
      const metrics: SystemPerformanceMetrics = {
        requests: {
          total: this.requestMetrics.total,
          active: this.requestMetrics.active,
          averageResponseTime: this.calculateAverageResponseTime(),
          requestsPerSecond: this.calculateRequestsPerSecond(),
          errorRate: this.calculateErrorRate(),
          slowRequestsCount: this.requestMetrics.slowRequests
        },

        database: this.extractDatabaseMetrics(healthReport),
        redis: this.extractRedisMetrics(redisInfo, healthReport),
        weaviate: this.extractWeaviateMetrics(healthReport),
        memory: memoryUsage.status === 'fulfilled' ? memoryUsage.value : this.getBasicMemoryUsage(),
        cpu: cpuMetrics,
        security: this.getSecurityMetrics(),

        application: {
          uptime: process.uptime() * 1000,
          version: process.env.npm_package_version || '1.0.0',
          environment: environmentConfig.get('nodeEnv'),
          nodeVersion: process.version,
          lastRestart: Date.now() - (process.uptime() * 1000)
        }
      };

      // Store in history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // Check for alerts
      await this.checkPerformanceAlerts(metrics);

      // Emit metrics update
      this.emit('metricsUpdated', metrics);

      const collectionTime = Date.now() - startTime;
      if (collectionTime > 1000) {
        console.warn(`⚠️  Metrics collection took ${collectionTime}ms - consider optimization`);
      }

      return metrics;

    } catch (error) {
      console.error('❌ Error collecting performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): SystemPerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(timeWindowMinutes: number = 60): PerformanceTrend[] {
    if (this.metricsHistory.length < 2) return [];

    const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
    const relevantMetrics = this.metricsHistory.filter((_, index) => {
      const metricsTime = Date.now() - ((this.metricsHistory.length - index - 1) * 30000); // Assuming 30s intervals
      return metricsTime >= cutoffTime;
    });

    if (relevantMetrics.length < 2) return [];

    const trends: PerformanceTrend[] = [];
    const current = relevantMetrics[relevantMetrics.length - 1];
    const previous = relevantMetrics[0];

    // Define key metrics to track
    const keyMetrics = [
      { path: 'requests.averageResponseTime', name: 'Average Response Time' },
      { path: 'requests.requestsPerSecond', name: 'Requests Per Second' },
      { path: 'requests.errorRate', name: 'Error Rate' },
      { path: 'memory.heapUsed', name: 'Memory Usage' },
      { path: 'cpu.usage', name: 'CPU Usage' },
      { path: 'database.averageQueryTime', name: 'Database Query Time' },
      { path: 'redis.averageLatency', name: 'Redis Latency' }
    ];

    for (const metric of keyMetrics) {
      const currentValue = this.getNestedValue(current, metric.path);
      const previousValue = this.getNestedValue(previous, metric.path);

      if (currentValue !== null && previousValue !== null && previousValue !== 0) {
        const changePercent = ((currentValue - previousValue) / previousValue) * 100;
        let trend: 'increasing' | 'decreasing' | 'stable';

        if (Math.abs(changePercent) < 5) {
          trend = 'stable';
        } else if (changePercent > 0) {
          trend = 'increasing';
        } else {
          trend = 'decreasing';
        }

        trends.push({
          metric: metric.name,
          current: currentValue,
          trend,
          changePercent: Math.abs(changePercent),
          timeWindow: `${timeWindowMinutes}m`
        });
      }
    }

    return trends;
  }

  /**
   * Record HTTP request metrics
   */
  recordRequestStart(): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.requestMetrics.total++;
    this.requestMetrics.active++;
    this.performanceMonitor.startTimer(`request_${requestId}`);
    return requestId;
  }

  /**
   * Record HTTP request completion
   */
  recordRequestEnd(requestId: string, statusCode: number): void {
    const responseTime = this.performanceMonitor.endTimer(`request_${requestId}`);
    this.requestMetrics.active = Math.max(0, this.requestMetrics.active - 1);
    
    if (responseTime > 0) {
      this.requestMetrics.responseTimes.push(responseTime);
      
      // Keep only recent response times
      if (this.requestMetrics.responseTimes.length > 1000) {
        this.requestMetrics.responseTimes.shift();
      }

      // Track slow requests
      const slowThreshold = environmentConfig.getPath<number>('monitoring.processingTimeWarningThreshold') || 1000;
      if (responseTime > slowThreshold) {
        this.requestMetrics.slowRequests++;
      }
    }

    // Track errors
    if (statusCode >= 400) {
      this.requestMetrics.errors++;
    }
  }

  /**
   * Add performance alert
   */
  addAlert(alert: PerformanceAlert): void {
    this.alertsMap.set(alert.id, alert);
    console.log(`📊 Performance alert added: ${alert.name}`);
  }

  /**
   * Remove performance alert
   */
  removeAlert(alertId: string): boolean {
    const removed = this.alertsMap.delete(alertId);
    if (removed) {
      console.log(`📊 Performance alert removed: ${alertId}`);
    }
    return removed;
  }

  /**
   * Get all performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return Array.from(this.alertsMap.values());
  }

  /**
   * Get performance summary for dashboards
   */
  getPerformanceSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    keyMetrics: {
      responseTime: number;
      throughput: number;
      errorRate: number;
      memoryUsage: number;
      cpuUsage: number;
    };
    alerts: number;
    trends: PerformanceTrend[];
  } {
    const current = this.getCurrentMetrics();
    if (!current) {
      return {
        status: 'warning',
        score: 0,
        keyMetrics: { responseTime: 0, throughput: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0 },
        alerts: 0,
        trends: []
      };
    }

    // Calculate health score
    let score = 100;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Response time impact
    if (current.requests.averageResponseTime > 2000) {
      score -= 20;
      status = 'critical';
    } else if (current.requests.averageResponseTime > 1000) {
      score -= 10;
      if (status === 'healthy') status = 'warning';
    }

    // Error rate impact
    if (current.requests.errorRate > 0.05) {
      score -= 25;
      status = 'critical';
    } else if (current.requests.errorRate > 0.01) {
      score -= 10;
      if (status === 'healthy') status = 'warning';
    }

    // Memory usage impact
    const memoryUsagePercent = (current.memory.heapUsed / current.memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      score -= 20;
      status = 'critical';
    } else if (memoryUsagePercent > 80) {
      score -= 10;
      if (status === 'healthy') status = 'warning';
    }

    // CPU usage impact
    if (current.cpu.usage > 90) {
      score -= 15;
      status = 'critical';
    } else if (current.cpu.usage > 80) {
      score -= 8;
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      score: Math.max(0, score),
      keyMetrics: {
        responseTime: current.requests.averageResponseTime,
        throughput: current.requests.requestsPerSecond,
        errorRate: current.requests.errorRate * 100,
        memoryUsage: memoryUsagePercent,
        cpuUsage: current.cpu.usage
      },
      alerts: this.alertsMap.size,
      trends: this.getPerformanceTrends(30) // Last 30 minutes
    };
  }

  /**
   * Export performance data for analysis
   */
  exportMetricsData(timeRangeMinutes: number = 60): {
    metadata: {
      exportTime: string;
      timeRange: string;
      environment: string;
      nodeVersion: string;
    };
    metrics: SystemPerformanceMetrics[];
    summary: any;
  } {
    const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
    const relevantMetrics = this.metricsHistory.filter((_, index) => {
      const metricsTime = Date.now() - ((this.metricsHistory.length - index - 1) * 30000);
      return metricsTime >= cutoffTime;
    });

    return {
      metadata: {
        exportTime: new Date().toISOString(),
        timeRange: `${timeRangeMinutes} minutes`,
        environment: environmentConfig.get('nodeEnv'),
        nodeVersion: process.version
      },
      metrics: relevantMetrics,
      summary: this.getPerformanceSummary()
    };
  }

  // ==================== Private Helper Methods ====================

  private initializeAlerts(): void {
    // Default performance alerts
    const defaultAlerts: PerformanceAlert[] = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        threshold: 2000,
        comparison: 'gt',
        metricPath: 'requests.averageResponseTime',
        severity: 'warning',
        enabled: true,
        cooldownMs: 5 * 60 * 1000
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        threshold: 0.05,
        comparison: 'gt',
        metricPath: 'requests.errorRate',
        severity: 'critical',
        enabled: true,
        cooldownMs: 2 * 60 * 1000
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        threshold: 0.9,
        comparison: 'gt',
        metricPath: 'memory.heapUsed',
        severity: 'warning',
        enabled: true,
        cooldownMs: 10 * 60 * 1000
      },
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        threshold: 80,
        comparison: 'gt',
        metricPath: 'cpu.usage',
        severity: 'warning',
        enabled: true,
        cooldownMs: 5 * 60 * 1000
      }
    ];

    defaultAlerts.forEach(alert => this.alertsMap.set(alert.id, alert));
  }

  private setupGCMonitoring(): void {
    if (typeof global.gc === 'function') {
      const originalGC = global.gc;
      global.gc = () => {
        const start = Date.now();
        originalGC();
        const duration = Date.now() - start;
        
        this.gcStats.collections++;
        this.gcStats.totalTime += duration;
        this.gcStats.lastTime = duration;
      };
    }
  }

  private async getRedisMetrics(): Promise<any> {
    try {
      const client = redisConnectionManager.getClient();
      if (client) {
        const info = await client.info('memory');
        return this.parseRedisInfo(info);
      }
    } catch (error) {
      console.warn('Failed to get Redis metrics:', error.message);
    }
    return null;
  }

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

  private async getDetailedMemoryUsage(): Promise<SystemPerformanceMetrics['memory']> {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      memoryPressure: memUsage.heapUsed / memUsage.heapTotal,
      gcStats: {
        collections: this.gcStats.collections,
        avgGcTime: this.gcStats.collections > 0 ? this.gcStats.totalTime / this.gcStats.collections : 0,
        lastGcTime: this.gcStats.lastTime
      }
    };
  }

  private getBasicMemoryUsage(): SystemPerformanceMetrics['memory'] {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      memoryPressure: memUsage.heapUsed / memUsage.heapTotal,
      gcStats: { collections: 0, avgGcTime: 0, lastGcTime: 0 }
    };
  }

  private getCPUMetrics(): SystemPerformanceMetrics['cpu'] {
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    const uptime = process.uptime();
    const usage = (totalUsage / uptime) * 100;

    return {
      usage: Math.min(100, usage),
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
      eventLoopDelay: 0, // Would need additional monitoring
      eventLoopUtilization: 0 // Would need additional monitoring
    };
  }

  private getSecurityMetrics(): SystemPerformanceMetrics['security'] {
    // This would integrate with security services
    return {
      encryptionOperations: 0,
      averageEncryptionTime: 0,
      securityEvents: 0,
      threatDetections: 0,
      blockedRequests: 0
    };
  }

  private extractDatabaseMetrics(healthResult: PromiseSettledResult<any>): SystemPerformanceMetrics['database'] {
    if (healthResult.status === 'fulfilled') {
      const dbHealth = healthResult.value.services.find(s => s.service === 'database');
      if (dbHealth && dbHealth.details) {
        return {
          connectionPoolSize: dbHealth.details.totalConnections || 0,
          activeConnections: dbHealth.details.totalConnections - dbHealth.details.idleConnections || 0,
          queryCount: 0, // Would need to track separately
          averageQueryTime: dbHealth.latency || 0,
          slowQueriesCount: 0, // Would need to track separately
          connectionErrors: 0 // Would need to track separately
        };
      }
    }

    return {
      connectionPoolSize: 0,
      activeConnections: 0,
      queryCount: 0,
      averageQueryTime: 0,
      slowQueriesCount: 0,
      connectionErrors: 0
    };
  }

  private extractRedisMetrics(redisInfo: any, healthResult: PromiseSettledResult<any>): SystemPerformanceMetrics['redis'] {
    const redisHealth = healthResult.status === 'fulfilled' 
      ? healthResult.value.services.find(s => s.service === 'redis')
      : null;

    return {
      connected: redisHealth?.status === 'healthy' || false,
      memoryUsage: redisInfo?.used_memory_human || '0B',
      operationsPerSecond: 0, // Would need to track separately
      averageLatency: redisHealth?.latency || 0,
      connectionErrors: 0 // Would need to track separately
    };
  }

  private extractWeaviateMetrics(healthResult: PromiseSettledResult<any>): SystemPerformanceMetrics['weaviate'] {
    const weaviateHealth = healthResult.status === 'fulfilled' 
      ? healthResult.value.services.find(s => s.service === 'weaviate')
      : null;

    return {
      connected: weaviateHealth?.status === 'healthy' || false,
      vectorOperations: 0, // Would need to track separately
      averageSearchTime: weaviateHealth?.latency || 0,
      indexSize: 0, // Would need to track separately
      connectionErrors: 0 // Would need to track separately
    };
  }

  private calculateAverageResponseTime(): number {
    if (this.requestMetrics.responseTimes.length === 0) return 0;
    const sum = this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.requestMetrics.responseTimes.length;
  }

  private calculateRequestsPerSecond(): number {
    const uptime = process.uptime();
    return uptime > 0 ? this.requestMetrics.total / uptime : 0;
  }

  private calculateErrorRate(): number {
    return this.requestMetrics.total > 0 
      ? this.requestMetrics.errors / this.requestMetrics.total 
      : 0;
  }

  private async checkPerformanceAlerts(metrics: SystemPerformanceMetrics): Promise<void> {
    const now = Date.now();

    for (const [alertId, alert] of this.alertsMap.entries()) {
      if (!alert.enabled) continue;

      // Check cooldown
      const lastAlertTime = this.lastAlertTimes.get(alertId) || 0;
      if (now - lastAlertTime < alert.cooldownMs) continue;

      // Get metric value
      const value = this.getNestedValue(metrics, alert.metricPath);
      if (value === null) continue;

      // Check condition
      let triggered = false;
      switch (alert.comparison) {
        case 'gt':
          triggered = value > alert.threshold;
          break;
        case 'lt':
          triggered = value < alert.threshold;
          break;
        case 'eq':
          triggered = value === alert.threshold;
          break;
      }

      if (triggered) {
        this.lastAlertTimes.set(alertId, now);
        this.emit('performanceAlert', {
          alert,
          value,
          timestamp: now,
          metrics
        });

        console.warn(`⚠️  Performance Alert: ${alert.name} - ${value} ${alert.comparison} ${alert.threshold}`);
      }
    }
  }

  private getNestedValue(obj: any, path: string): number | null {
    const keys = path.split('.');
    let value: any = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return typeof value === 'number' ? value : null;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.stopCollection();
    await this.metricsCollector.shutdown();
    this.removeAllListeners();
    console.log('📊 Performance Monitoring Service shutdown complete');
  }
}

// Export singleton instance
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();