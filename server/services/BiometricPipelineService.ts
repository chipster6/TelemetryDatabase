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
  private streamProcessor: StreamProcessor;
  private dataValidator: DataValidator;
  private biometricCalculator: BiometricCalculator;
  private pipelineOrchestrator: PipelineOrchestrator;
  private metricsCollector: MetricsCollector;
  
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType,
    private wsServer?: WebSocketServer
  ) {
    super();
    
    // Initialize specialized services
    this.streamProcessor = new StreamProcessor(redis, wsServer);
    this.dataValidator = new DataValidator();
    this.biometricCalculator = new BiometricCalculator(redis);
    this.metricsCollector = new MetricsCollector();
    
    // Initialize orchestrator with all services
    this.pipelineOrchestrator = new PipelineOrchestrator(
      weaviate,
      redis,
      this.streamProcessor,
      this.dataValidator,
      this.biometricCalculator,
      this.metricsCollector
    );
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Main processing method - delegates to the pipeline orchestrator
   */
  async processBiometricData(rawData: BiometricDataPoint): Promise<ProcessingResult> {
    return await this.pipelineOrchestrator.processBiometricData(rawData);
  }
  
  /**
   * Get current analytics for a user
   */
  async getCurrentAnalytics(userId: string): Promise<RealtimeAnalytics | null> {
    return await this.pipelineOrchestrator.getCurrentAnalytics(userId);
  }
  
  /**
   * Analyze historical patterns
   */
  async analyzeHistoricalPatterns(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    return await this.pipelineOrchestrator.analyzeHistoricalPatterns(userId, timeRange);
  }
  
  /**
   * Export training data for personalized AI
   */
  async exportTrainingData(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    return await this.pipelineOrchestrator.exportTrainingData(userId, dateRange);
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return this.pipelineOrchestrator.getPerformanceMetrics();
  }
  
  /**
   * Get system health status
   */
  getHealthStatus(): any {
    return this.pipelineOrchestrator.getHealthStatus();
  }
  
  /**
   * Process queued data for a user
   */
  async processQueuedData(userId: string, maxItems?: number): Promise<any> {
    return await this.pipelineOrchestrator.processQueuedData(userId, maxItems);
  }
  
  /**
   * Update pipeline configuration
   */
  updateConfig(config: any): void {
    this.pipelineOrchestrator.updateConfig(config);
  }
  
  // ==================== Private Methods ====================
  
  private setupEventHandlers(): void {
    // Forward events from the pipeline orchestrator
    this.pipelineOrchestrator.on('dataProcessed', (data) => {
      this.emit('dataProcessed', data);
    });
    
    this.pipelineOrchestrator.on('batchStored', (batchInfo) => {
      this.emit('batchStored', batchInfo);
    });
    
    this.pipelineOrchestrator.on('patternsDetected', (patterns) => {
      this.emit('patternsDetected', patterns);
    });
    
    this.pipelineOrchestrator.on('criticalAlert', (alert) => {
      this.emit('criticalAlert', alert);
    });
    
    this.pipelineOrchestrator.on('performanceWarning', (warning) => {
      this.emit('performanceWarning', warning);
    });
    
    this.pipelineOrchestrator.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    await this.pipelineOrchestrator.shutdown();
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