import { EventEmitter } from 'events';
import type { WeaviateClient } from 'weaviate-client';
import Redis from 'redis';
import { BiometricDataPoint, ProcessingResult, RealtimeAnalytics, Alert } from '../BiometricPipelineService';
import { StreamProcessor } from './StreamProcessor';
import { DataValidator } from './DataValidator';
import { BiometricCalculator } from './BiometricCalculator';
import { MetricsCollector } from './MetricsCollector';

export interface PipelineConfig {
  enablePrivacyProtection: boolean;
  enableNeurodivergentAnalysis: boolean;
  maxProcessingLoad: number;
  batchStorageEnabled: boolean;
  realtimeAnalyticsEnabled: boolean;
}

export interface PrivacyManager {
  protectData(data: BiometricDataPoint): Promise<BiometricDataPoint>;
}

export interface NeurodivergentPatternDetector {
  analyzePatterns(dataPoint: BiometricDataPoint): Promise<void>;
  analyzeHistoricalPatterns(userId: string, timeRange: { start: Date; end: Date }): Promise<any>;
}

/**
 * Privacy manager for data protection
 */
class PrivacyManagerImpl implements PrivacyManager {
  async protectData(data: BiometricDataPoint): Promise<BiometricDataPoint> {
    // Apply differential privacy and other protections
    return {
      ...data,
      // Add noise to sensitive metrics
      heartRate: this.addNoise(data.heartRate, 2),
      hrv: this.addNoise(data.hrv, 5),
      // Keep some fields as-is for functionality
      timestamp: data.timestamp,
      userId: data.userId,
      sessionId: data.sessionId
    };
  }
  
  private addNoise(value: number, scale: number): number {
    const noise = (Math.random() - 0.5) * scale;
    return Math.max(0, value + noise);
  }
}

/**
 * Neurodivergent pattern detector (placeholder for full implementation)
 */
class NeurodivergentPatternDetectorImpl extends EventEmitter implements NeurodivergentPatternDetector {
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType
  ) {
    super();
  }
  
  async analyzePatterns(dataPoint: BiometricDataPoint): Promise<void> {
    // Placeholder for neurodivergent pattern analysis
    // This would include hyperfocus detection, attention cycling, etc.
    // Integration point for the actual NeurodivergentAnalyticsService
  }
  
  async analyzeHistoricalPatterns(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    // Placeholder for historical pattern analysis
    return {};
  }
}

/**
 * Training data exporter for AI model training
 */
class TrainingDataExporter {
  constructor(private weaviate: WeaviateClient) {}
  
  async exportForPersonalizedAI(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    // Placeholder for training data export
    return {
      userId,
      dateRange,
      dataPoints: 0,
      patterns: {},
      exportedAt: new Date()
    };
  }
}

/**
 * Orchestrates the entire biometric data processing pipeline
 */
export class PipelineOrchestrator extends EventEmitter {
  private streamProcessor: StreamProcessor;
  private dataValidator: DataValidator;
  private biometricCalculator: BiometricCalculator;
  private metricsCollector: MetricsCollector;
  private privacyManager: PrivacyManager;
  private ndPatternDetector: NeurodivergentPatternDetector;
  private trainingDataExporter: TrainingDataExporter;
  private config: PipelineConfig;

  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType,
    streamProcessor: StreamProcessor,
    dataValidator: DataValidator,
    biometricCalculator: BiometricCalculator,
    metricsCollector: MetricsCollector,
    config: Partial<PipelineConfig> = {}
  ) {
    super();
    
    this.streamProcessor = streamProcessor;
    this.dataValidator = dataValidator;
    this.biometricCalculator = biometricCalculator;
    this.metricsCollector = metricsCollector;
    
    this.config = {
      enablePrivacyProtection: true,
      enableNeurodivergentAnalysis: true,
      maxProcessingLoad: 100,
      batchStorageEnabled: true,
      realtimeAnalyticsEnabled: true,
      ...config
    };
    
    // Initialize additional components
    this.privacyManager = new PrivacyManagerImpl();
    this.ndPatternDetector = new NeurodivergentPatternDetectorImpl(weaviate, redis);
    this.trainingDataExporter = new TrainingDataExporter(weaviate);
    
    this.setupEventHandlers();
  }

  /**
   * Main orchestration method - processes biometric data through the pipeline
   */
  async processBiometricData(rawData: BiometricDataPoint): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Validate and sanitize input
      const validationResult = await this.dataValidator.validateInput(rawData);
      if (!validationResult.isValid) {
        this.metricsCollector.recordValidationFailure(validationResult.error);
        return { success: false, error: validationResult.error };
      }

      // Sanitize data if validation passed with warnings
      const sanitizedData = this.dataValidator.sanitizeData(rawData);
      
      // Step 2: Apply privacy protections if enabled
      let protectedData = sanitizedData;
      if (this.config.enablePrivacyProtection) {
        protectedData = await this.privacyManager.protectData(sanitizedData);
      }
      
      // Step 3: Performance check
      if (!this.metricsCollector.canProcess()) {
        // Queue for later processing
        await this.streamProcessor.queueForLaterProcessing(protectedData);
        this.metricsCollector.recordQueuedProcessing();
        return { success: true, dataPoint: protectedData };
      }
      
      // Step 4: Real-time analytics (if enabled)
      let analytics: RealtimeAnalytics | undefined;
      if (this.config.realtimeAnalyticsEnabled) {
        const window = this.streamProcessor.addToWindow(protectedData);
        analytics = await this.biometricCalculator.calculateRealTimeAnalytics(window);
        
        // Cache analytics
        await this.biometricCalculator.cacheAnalytics(protectedData.userId, analytics);
      }
      
      // Step 5: Neurodivergent pattern detection (async, if enabled)
      if (this.config.enableNeurodivergentAnalysis) {
        this.ndPatternDetector.analyzePatterns(protectedData).catch(error => {
          console.error('Neurodivergent analysis error:', error);
          this.emit('ndAnalysisError', error);
        });
      }
      
      // Step 6: Batch processing for storage (if enabled)
      if (this.config.batchStorageEnabled) {
        await this.streamProcessor.addToBatch(protectedData);
      }
      
      // Step 7: Check for alerts
      const alerts = analytics ? await this.metricsCollector.checkAlerts(protectedData, analytics) : [];
      
      // Step 8: Broadcast updates
      if (analytics) {
        this.streamProcessor.broadcastUpdate(protectedData, analytics, alerts);
      }
      
      // Step 9: Record metrics
      const processingTime = Date.now() - startTime;
      this.metricsCollector.recordSuccessfulProcessing(processingTime, protectedData.userId);
      
      // Step 10: Emit events
      this.emit('dataProcessed', { 
        dataPoint: protectedData, 
        analytics, 
        alerts,
        processingTime,
        validationWarnings: validationResult.warnings
      });
      
      return {
        success: true,
        dataPoint: protectedData,
        analytics,
        alerts
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.metricsCollector.recordProcessingError(error, processingTime);
      
      console.error('Biometric processing error:', error);
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current analytics for a user
   */
  async getCurrentAnalytics(userId: string): Promise<RealtimeAnalytics | null> {
    return await this.biometricCalculator.getCurrentAnalytics(userId);
  }

  /**
   * Analyze historical patterns
   */
  async analyzeHistoricalPatterns(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    if (!this.config.enableNeurodivergentAnalysis) {
      throw new Error('Neurodivergent analysis is disabled');
    }
    
    return await this.ndPatternDetector.analyzeHistoricalPatterns(userId, timeRange);
  }

  /**
   * Export training data for personalized AI
   */
  async exportTrainingData(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    return await this.trainingDataExporter.exportForPersonalizedAI(userId, dateRange);
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): any {
    return {
      ...this.metricsCollector.getMetrics(),
      streamProcessor: {
        activeWindows: this.streamProcessor.getUserWindow ? 'available' : 'not available',
        batchProcessing: this.config.batchStorageEnabled
      },
      config: this.config,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    issues: string[];
  } {
    const checks = {
      redis: true, // Would implement actual Redis health check
      weaviate: true, // Would implement actual Weaviate health check
      memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024, // < 500MB
      processing: this.metricsCollector.canProcess()
    };

    const issues: string[] = [];
    Object.entries(checks).forEach(([check, healthy]) => {
      if (!healthy) {
        issues.push(`${check} is unhealthy`);
      }
    });

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 2 ? 'unhealthy' : 'degraded';
    }

    return { status, checks, issues };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Process queued data points (for recovery/catch-up processing)
   */
  async processQueuedData(userId: string, maxItems: number = 100): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const queueKey = `biometric_queue:${userId}`;
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < maxItems; i++) {
        const queuedData = await this.redis.rPop(queueKey);
        if (!queuedData) break;

        try {
          const dataPoint: BiometricDataPoint = JSON.parse(queuedData);
          const result = await this.processBiometricData(dataPoint);
          
          if (result.success) {
            processed++;
          } else {
            failed++;
            if (result.error) errors.push(result.error);
          }
        } catch (parseError) {
          failed++;
          errors.push(`Parse error: ${parseError.message}`);
        }
      }
    } catch (error) {
      errors.push(`Queue processing error: ${error.message}`);
    }

    return { processed, failed, errors };
  }

  /**
   * Setup event handlers for component communication
   */
  private setupEventHandlers(): void {
    // Handle batch processing completion
    this.streamProcessor.on('batchReady', (batchInfo) => {
      this.storeBatch(batchInfo.batch).catch(error => {
        console.error('Batch storage error:', error);
        this.emit('batchStorageError', error);
      });
    });
    
    // Handle pattern detection results
    this.ndPatternDetector.on('patternsDetected', (patterns) => {
      this.emit('patternsDetected', patterns);
    });
    
    // Handle critical alerts
    this.metricsCollector.on('criticalAlert', (alert) => {
      this.emit('criticalAlert', alert);
      this.streamProcessor.broadcastCriticalAlert(alert);
    });

    // Handle performance warnings
    this.metricsCollector.on('performanceWarning', (warning) => {
      this.emit('performanceWarning', warning);
    });
  }

  /**
   * Store processed batch in Weaviate
   */
  private async storeBatch(batch: any[]): Promise<void> {
    try {
      const weaviateObjects = batch.map(dataPoint => ({
        class: 'NexisBiometricPattern',
        properties: dataPoint
      }));
      
      await this.weaviate.batch
        .objectsBatcher()
        .withObjects(...weaviateObjects)
        .do();
      
      this.emit('batchStored', {
        size: batch.length,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Batch storage error:', error);
      this.emit('batchStorageError', { error, batchSize: batch.length });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down PipelineOrchestrator...');
    
    // Shutdown components in reverse order
    await this.streamProcessor.shutdown();
    await this.metricsCollector.shutdown();
    
    // Remove event listeners
    this.removeAllListeners();
    this.ndPatternDetector.removeAllListeners();
    
    console.log('PipelineOrchestrator shutdown complete');
  }
}