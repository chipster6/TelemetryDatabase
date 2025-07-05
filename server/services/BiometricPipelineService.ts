// Enhanced Biometric Pipeline Service - Refactored Implementation
// Now uses specialized services for better separation of concerns

import { weaviateClient } from './weaviate-client';
import type { WeaviateClient } from 'weaviate-client';
import { WebSocketServer } from 'ws';
import Redis from 'redis';
import { EventEmitter } from 'events';
import { StreamProcessor } from './biometric/StreamProcessor';
import { DataValidator } from './biometric/DataValidator';
import { BiometricCalculator } from './biometric/BiometricCalculator';
import { PipelineOrchestrator } from './biometric/PipelineOrchestrator';
import { MetricsCollector } from './biometric/MetricsCollector';

// ==================== Core Types ====================

export interface BiometricDataPoint {
  timestamp: number;
  userId: string;
  sessionId: string;
  heartRate: number;
  hrv: number;
  hrvVariability?: number;
  skinTemperature: number;
  cognitiveLoad: number;
  attentionLevel: number;
  stressLevel: number;
  environmentalSound?: number;
  lightLevel?: number;
  temperature?: number;
  contextId?: string;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  deviceId?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingResult {
  success: boolean;
  dataPoint?: BiometricDataPoint;
  analytics?: RealtimeAnalytics;
  alerts?: Alert[];
  error?: string;
}

export interface RealtimeAnalytics {
  cognitiveLoad: CognitiveLoadAnalysis;
  attentionTrend: AttentionTrendAnalysis;
  stressAnalysis: StressAnalysis;
  optimalState: OptimalStateAnalysis;
  predictions: PredictedState;
  recommendations: Recommendation[];
  timestamp: number;
}

export interface Alert {
  type: 'critical' | 'warning' | 'info';
  message: string;
  action: string;
  timestamp: number;
  userId: string;
}

// Analytics interfaces
export interface CognitiveLoadAnalysis {
  current: number;
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  sustainabilityScore: number;
  recommendation: string;
}

export interface AttentionTrendAnalysis {
  current: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  stability: number;
  focusQuality: number;
  distractionEvents: number;
}

export interface StressAnalysis {
  currentLevel: number;
  pattern: 'episodic' | 'sustained_high' | 'cyclic' | 'baseline';
  triggers: string[];
  recoveryTime: number;
  recommendations: string[];
}

export interface OptimalStateAnalysis {
  isOptimal: boolean;
  flowScore: number;
  productivityScore: number;
  limitingFactors: string[];
  optimizationSuggestions: string[];
}

export interface PredictedState {
  cognitiveLoad: number;
  attentionLevel: number;
  stressLevel: number;
  confidence: number;
  timeframe: string;
}

export interface Recommendation {
  type: 'break' | 'environment' | 'breathing' | 'focus' | 'task_switch';
  priority: 'high' | 'medium' | 'low';
  message: string;
  duration?: number;
  actions?: string[];
}

// ==================== Enhanced Biometric Pipeline Service ====================

export class BiometricPipelineService extends EventEmitter {
  // OPTIMIZATION: Use lazy loading for expensive services
  private _streamProcessor: StreamProcessor | null = null;
  private _dataValidator: DataValidator | null = null;
  private _biometricCalculator: BiometricCalculator | null = null;
  private _pipelineOrchestrator: PipelineOrchestrator | null = null;
  private _metricsCollector: MetricsCollector | null = null;
  private _initialized = false;
  
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType,
    private wsServer?: WebSocketServer
  ) {
    super();
    
    // OPTIMIZATION: Defer initialization until first use
    // This prevents startup bottlenecks when services aren't immediately needed
    console.log('📦 BiometricPipelineService created (lazy initialization)');
  }
  
  /**
   * OPTIMIZATION: Lazy initialization of services only when needed
   */
  private async ensureInitialized(): Promise<void> {
    if (this._initialized) return;
    
    console.log('🚀 Initializing BiometricPipelineService components...');
    const startTime = Date.now();
    
    try {
      // Initialize services in parallel where possible
      const [streamProcessor, dataValidator, biometricCalculator, metricsCollector] = await Promise.all([
        this.initializeStreamProcessor(),
        this.initializeDataValidator(),
        this.initializeBiometricCalculator(),
        this.initializeMetricsCollector()
      ]);
      
      this._streamProcessor = streamProcessor;
      this._dataValidator = dataValidator;
      this._biometricCalculator = biometricCalculator;
      this._metricsCollector = metricsCollector;
      
      // Initialize orchestrator after all dependencies are ready
      this._pipelineOrchestrator = new PipelineOrchestrator(
        this.weaviate,
        this.redis,
        this._streamProcessor,
        this._dataValidator,
        this._biometricCalculator,
        this._metricsCollector
      );
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this._initialized = true;
      
      const duration = Date.now() - startTime;
      console.log(`✅ BiometricPipelineService initialized in ${duration}ms`);
      
    } catch (error) {
      console.error('❌ Failed to initialize BiometricPipelineService:', error);
      throw new Error('BiometricPipelineService initialization failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
  
  /**
   * OPTIMIZATION: Async factory methods for service initialization
   */
  private async initializeStreamProcessor(): Promise<StreamProcessor> {
    return new Promise((resolve) => {
      // Allow other services to initialize concurrently
      setImmediate(() => {
        resolve(new StreamProcessor(this.redis, this.wsServer));
      });
    });
  }
  
  private async initializeDataValidator(): Promise<DataValidator> {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve(new DataValidator());
      });
    });
  }
  
  private async initializeBiometricCalculator(): Promise<BiometricCalculator> {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve(new BiometricCalculator(this.redis));
      });
    });
  }
  
  private async initializeMetricsCollector(): Promise<MetricsCollector> {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve(new MetricsCollector());
      });
    });
  }
  
  /**
   * Getter methods with lazy initialization
   */
  private async getStreamProcessor(): Promise<StreamProcessor> {
    await this.ensureInitialized();
    return this._streamProcessor!;
  }
  
  private async getDataValidator(): Promise<DataValidator> {
    await this.ensureInitialized();
    return this._dataValidator!;
  }
  
  private async getBiometricCalculator(): Promise<BiometricCalculator> {
    await this.ensureInitialized();
    return this._biometricCalculator!;
  }
  
  private async getPipelineOrchestrator(): Promise<PipelineOrchestrator> {
    await this.ensureInitialized();
    return this._pipelineOrchestrator!;
  }
  
  private async getMetricsCollector(): Promise<MetricsCollector> {
    await this.ensureInitialized();
    return this._metricsCollector!;
  }
  
  /**
   * Main processing method - delegates to the pipeline orchestrator
   * OPTIMIZATION: Ensures initialization only when actually processing data
   */
  async processBiometricData(rawData: BiometricDataPoint): Promise<ProcessingResult> {
    const orchestrator = await this.getPipelineOrchestrator();
    return await orchestrator.processBiometricData(rawData);
  }
  
  /**
   * Get current analytics for a user
   */
  async getCurrentAnalytics(userId: string): Promise<RealtimeAnalytics | null> {
    const orchestrator = await this.getPipelineOrchestrator();
    return await orchestrator.getCurrentAnalytics(userId);
  }
  
  /**
   * Analyze historical patterns
   */
  async analyzeHistoricalPatterns(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    const orchestrator = await this.getPipelineOrchestrator();
    return await orchestrator.analyzeHistoricalPatterns(userId, timeRange);
  }
  
  /**
   * Export training data for personalized AI
   */
  async exportTrainingData(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    const orchestrator = await this.getPipelineOrchestrator();
    return await orchestrator.exportTrainingData(userId, dateRange);
  }
  
  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    const orchestrator = await this.getPipelineOrchestrator();
    return orchestrator.getPerformanceMetrics();
  }
  
  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<any> {
    const orchestrator = await this.getPipelineOrchestrator();
    return orchestrator.getHealthStatus();
  }
  
  /**
   * Process queued data for a user
   */
  async processQueuedData(userId: string, maxItems?: number): Promise<any> {
    const orchestrator = await this.getPipelineOrchestrator();
    return await orchestrator.processQueuedData(userId, maxItems);
  }
  
  /**
   * Update pipeline configuration
   */
  async updateConfig(config: any): Promise<void> {
    const orchestrator = await this.getPipelineOrchestrator();
    orchestrator.updateConfig(config);
  }
  
  // ==================== Private Methods ====================
  
  private setupEventHandlers(): void {
    // Forward events from the pipeline orchestrator (after initialization)
    if (!this._pipelineOrchestrator) {
      console.warn('setupEventHandlers called before orchestrator initialization');
      return;
    }
    
    this._pipelineOrchestrator.on('dataProcessed', (data) => {
      this.emit('dataProcessed', data);
    });
    
    this._pipelineOrchestrator.on('batchStored', (batchInfo) => {
      this.emit('batchStored', batchInfo);
    });
    
    this._pipelineOrchestrator.on('patternsDetected', (patterns) => {
      this.emit('patternsDetected', patterns);
    });
    
    this._pipelineOrchestrator.on('criticalAlert', (alert) => {
      this.emit('criticalAlert', alert);
    });
    
    this._pipelineOrchestrator.on('performanceWarning', (warning) => {
      this.emit('performanceWarning', warning);
    });
    
    this._pipelineOrchestrator.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this._pipelineOrchestrator) {
      await this._pipelineOrchestrator.shutdown();
    }
    this.removeAllListeners();
  }
}

// ==================== Backward Compatibility ====================
// Note: The original supporting classes have been decomposed into separate services:
// - BiometricBatchProcessor -> StreamProcessor
// - RealtimeAnalyticsEngine -> BiometricCalculator
// - NeurodivergentPatternDetector -> External service integration
// - PrivacyManager -> Integrated into PipelineOrchestrator
// - PerformanceOptimizer -> MetricsCollector
// - AlertManager -> MetricsCollector
// - TrainingDataExporter -> Integrated into PipelineOrchestrator

export default BiometricPipelineService;