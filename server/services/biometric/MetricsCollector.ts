import { EventEmitter } from 'events';
import { BiometricDataPoint, RealtimeAnalytics, Alert } from '../BiometricPipelineService';

export interface PerformanceMetrics {
  processingCount: number;
  averageProcessingTime: number;
  errorRate: number;
  throughput: number;
  queuedItems: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  lastProcessedAt?: number;
}

export interface ProcessingStats {
  totalProcessed: number;
  totalErrors: number;
  totalValidationFailures: number;
  totalQueuedProcessing: number;
  averageProcessingTimeMs: number;
  hourlyThroughput: number;
  peakProcessingTime: number;
  errorsByType: Map<string, number>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (dataPoint: BiometricDataPoint, analytics: RealtimeAnalytics) => boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  action: string;
  cooldownMs: number;
  enabled: boolean;
}

export interface MetricsConfig {
  maxConcurrentProcessing: number;
  performanceWarningThreshold: number;
  errorRateThreshold: number;
  memoryWarningThreshold: number;
  processingTimeWarningThreshold: number;
  metricsRetentionMs: number;
}

/**
 * Comprehensive metrics collection, alerting, and performance monitoring
 */
export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private processingCount = 0;
  private stats: ProcessingStats;
  private processingTimes: number[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private startTime: number;

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentProcessing: 100,
      performanceWarningThreshold: 5000, // 5 seconds
      errorRateThreshold: 0.05, // 5%
      memoryWarningThreshold: 500 * 1024 * 1024, // 500MB
      processingTimeWarningThreshold: 1000, // 1 second
      metricsRetentionMs: 60 * 60 * 1000, // 1 hour
      ...config
    };

    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      totalValidationFailures: 0,
      totalQueuedProcessing: 0,
      averageProcessingTimeMs: 0,
      hourlyThroughput: 0,
      peakProcessingTime: 0,
      errorsByType: new Map()
    };

    this.startTime = Date.now();
    this.initializeDefaultAlertRules();
    this.startMetricsCleanup();
  }

  /**
   * Check if system can process more requests
   */
  canProcess(): boolean {
    return this.processingCount < this.config.maxConcurrentProcessing;
  }

  /**
   * Record successful processing
   */
  recordSuccessfulProcessing(processingTimeMs: number, userId: string): void {
    this.processingCount = Math.max(0, this.processingCount - 1);
    this.stats.totalProcessed++;
    
    // Update processing time metrics
    this.processingTimes.push(processingTimeMs);
    this.stats.averageProcessingTimeMs = this.calculateAverageProcessingTime();
    this.stats.peakProcessingTime = Math.max(this.stats.peakProcessingTime, processingTimeMs);
    
    // Calculate hourly throughput
    this.stats.hourlyThroughput = this.calculateHourlyThroughput();
    
    // Performance warnings
    if (processingTimeMs > this.config.processingTimeWarningThreshold) {
      this.emit('performanceWarning', {
        type: 'slow_processing',
        processingTime: processingTimeMs,
        threshold: this.config.processingTimeWarningThreshold,
        userId
      });
    }
    
    // Check system health
    this.checkSystemHealth();
  }

  /**
   * Record processing error
   */
  recordProcessingError(error: Error, processingTimeMs: number): void {
    this.processingCount = Math.max(0, this.processingCount - 1);
    this.stats.totalErrors++;
    
    // Track errors by type
    const errorType = error.name || 'UnknownError';
    this.stats.errorsByType.set(errorType, (this.stats.errorsByType.get(errorType) || 0) + 1);
    
    // Update processing time even for errors
    this.processingTimes.push(processingTimeMs);
    this.stats.averageProcessingTimeMs = this.calculateAverageProcessingTime();
    
    // Check error rate
    const errorRate = this.getErrorRate();
    if (errorRate > this.config.errorRateThreshold) {
      this.emit('performanceWarning', {
        type: 'high_error_rate',
        errorRate,
        threshold: this.config.errorRateThreshold,
        totalErrors: this.stats.totalErrors,
        totalProcessed: this.stats.totalProcessed
      });
    }
  }

  /**
   * Record validation failure
   */
  recordValidationFailure(error?: string): void {
    this.stats.totalValidationFailures++;
    
    if (error) {
      this.stats.errorsByType.set('ValidationError', (this.stats.errorsByType.get('ValidationError') || 0) + 1);
    }
  }

  /**
   * Record queued processing
   */
  recordQueuedProcessing(): void {
    this.stats.totalQueuedProcessing++;
  }

  /**
   * Start processing (increment counter)
   */
  startProcessing(): void {
    this.processingCount++;
  }

  /**
   * Check for alerts based on data and analytics
   */
  async checkAlerts(
    dataPoint: BiometricDataPoint,
    analytics: RealtimeAnalytics
  ): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const now = Date.now();

    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      const lastAlertTime = this.lastAlertTimes.get(ruleId) || 0;
      if (now - lastAlertTime < rule.cooldownMs) continue;

      // Evaluate condition
      try {
        if (rule.condition(dataPoint, analytics)) {
          const alert: Alert = {
            type: rule.severity,
            message: rule.message,
            action: rule.action,
            timestamp: now,
            userId: dataPoint.userId
          };

          alerts.push(alert);
          this.lastAlertTimes.set(ruleId, now);

          // Emit critical alerts immediately
          if (rule.severity === 'critical') {
            this.emit('criticalAlert', alert);
          }
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${ruleId}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      processingCount: this.processingCount,
      averageProcessingTime: this.stats.averageProcessingTimeMs,
      errorRate: this.getErrorRate(),
      throughput: this.stats.hourlyThroughput,
      queuedItems: this.stats.totalQueuedProcessing,
      memoryUsage,
      uptime,
      lastProcessedAt: this.stats.totalProcessed > 0 ? Date.now() : undefined
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): ProcessingStats & {
    errorRatePercentage: number;
    uptimeHours: number;
    memoryUsageMB: number;
    processingCapacityUsed: number;
  } {
    const memoryUsageMB = process.memoryUsage().heapUsed / (1024 * 1024);
    const uptimeHours = (Date.now() - this.startTime) / (60 * 60 * 1000);
    const processingCapacityUsed = (this.processingCount / this.config.maxConcurrentProcessing) * 100;

    return {
      ...this.stats,
      errorRatePercentage: this.getErrorRate() * 100,
      uptimeHours,
      memoryUsageMB,
      processingCapacityUsed
    };
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  /**
   * Enable/disable alert rule
   */
  toggleAlertRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Reset metrics and statistics
   */
  resetMetrics(): void {
    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      totalValidationFailures: 0,
      totalQueuedProcessing: 0,
      averageProcessingTimeMs: 0,
      hourlyThroughput: 0,
      peakProcessingTime: 0,
      errorsByType: new Map()
    };
    
    this.processingTimes = [];
    this.lastAlertTimes.clear();
    this.startTime = Date.now();
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check error rate
    const errorRate = this.getErrorRate();
    if (errorRate > this.config.errorRateThreshold) {
      score -= 30;
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate recent errors and address root causes');
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage().heapUsed;
    if (memoryUsage > this.config.memoryWarningThreshold) {
      score -= 20;
      issues.push(`High memory usage: ${(memoryUsage / (1024 * 1024)).toFixed(1)}MB`);
      recommendations.push('Consider restarting the service or optimizing memory usage');
    }

    // Check processing capacity
    const capacityUsed = (this.processingCount / this.config.maxConcurrentProcessing) * 100;
    if (capacityUsed > 80) {
      score -= 15;
      issues.push(`High processing load: ${capacityUsed.toFixed(1)}%`);
      recommendations.push('Consider scaling up processing capacity');
    }

    // Check average processing time
    if (this.stats.averageProcessingTimeMs > this.config.processingTimeWarningThreshold) {
      score -= 10;
      issues.push(`Slow processing: ${this.stats.averageProcessingTimeMs.toFixed(0)}ms average`);
      recommendations.push('Investigate performance bottlenecks');
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 50) status = 'critical';
    else if (score < 80) status = 'warning';

    return { status, score, issues, recommendations };
  }

  // ==================== Private Methods ====================

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    // Critical cognitive overload
    this.addAlertRule({
      id: 'critical_cognitive_overload',
      name: 'Critical Cognitive Overload',
      condition: (dataPoint) => dataPoint.cognitiveLoad > 95,
      severity: 'critical',
      message: 'Critical cognitive overload detected',
      action: 'immediate_break_required',
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // Sustained high stress
    this.addAlertRule({
      id: 'sustained_high_stress',
      name: 'Sustained High Stress',
      condition: (_, analytics) => analytics.stressAnalysis.pattern === 'sustained_high',
      severity: 'warning',
      message: 'Sustained high stress detected',
      action: 'stress_intervention_recommended',
      cooldownMs: 15 * 60 * 1000, // 15 minutes
      enabled: true
    });

    // Extreme heart rate
    this.addAlertRule({
      id: 'extreme_heart_rate',
      name: 'Extreme Heart Rate',
      condition: (dataPoint) => dataPoint.heartRate > 180 || dataPoint.heartRate < 40,
      severity: 'critical',
      message: 'Extreme heart rate detected',
      action: 'medical_attention_recommended',
      cooldownMs: 2 * 60 * 1000, // 2 minutes
      enabled: true
    });

    // Low attention with high cognitive load
    this.addAlertRule({
      id: 'attention_cognitive_mismatch',
      name: 'Attention-Cognitive Load Mismatch',
      condition: (dataPoint) => dataPoint.attentionLevel < 30 && dataPoint.cognitiveLoad > 80,
      severity: 'warning',
      message: 'Low attention with high cognitive load',
      action: 'focus_intervention_recommended',
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });
  }

  /**
   * Calculate current error rate
   */
  private getErrorRate(): number {
    const total = this.stats.totalProcessed + this.stats.totalErrors;
    return total > 0 ? this.stats.totalErrors / total : 0;
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return sum / this.processingTimes.length;
  }

  /**
   * Calculate hourly throughput
   */
  private calculateHourlyThroughput(): number {
    const uptimeHours = (Date.now() - this.startTime) / (60 * 60 * 1000);
    return uptimeHours > 0 ? this.stats.totalProcessed / uptimeHours : 0;
  }

  /**
   * Check overall system health
   */
  private checkSystemHealth(): void {
    const memoryUsage = process.memoryUsage().heapUsed;
    
    // Memory warning
    if (memoryUsage > this.config.memoryWarningThreshold) {
      this.emit('performanceWarning', {
        type: 'high_memory_usage',
        memoryUsageMB: memoryUsage / (1024 * 1024),
        thresholdMB: this.config.memoryWarningThreshold / (1024 * 1024)
      });
    }

    // Processing capacity warning
    const capacityUsed = (this.processingCount / this.config.maxConcurrentProcessing) * 100;
    if (capacityUsed > 90) {
      this.emit('performanceWarning', {
        type: 'high_processing_load',
        capacityUsed,
        maxCapacity: this.config.maxConcurrentProcessing
      });
    }
  }

  /**
   * Cleanup old metrics data
   */
  private startMetricsCleanup(): void {
    setInterval(() => {
      // Keep only recent processing times
      const cutoff = Date.now() - this.config.metricsRetentionMs;
      const maxEntries = 1000; // Keep last 1000 entries
      
      if (this.processingTimes.length > maxEntries) {
        this.processingTimes = this.processingTimes.slice(-maxEntries);
      }
      
      // Clear old alert times
      for (const [ruleId, time] of this.lastAlertTimes.entries()) {
        if (time < cutoff) {
          this.lastAlertTimes.delete(ruleId);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    // Clear any timers or intervals here if needed
  }
}