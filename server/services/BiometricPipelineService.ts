// Enhanced Biometric Pipeline Service - Consensus Implementation
// Integrates advanced analytics, privacy, and neurodivergent pattern detection

import { WeaviateClient } from 'weaviate-ts-client';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'redis';
import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';

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
  private batchProcessor: BiometricBatchProcessor;
  private analyticsEngine: RealtimeAnalyticsEngine;
  private ndPatternDetector: NeurodivergentPatternDetector;
  private privacyManager: PrivacyManager;
  private performanceOptimizer: PerformanceOptimizer;
  private alertManager: AlertManager;
  
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType,
    private wsServer?: WebSocketServer
  ) {
    super();
    
    // Initialize components
    this.batchProcessor = new BiometricBatchProcessor(weaviate);
    this.analyticsEngine = new RealtimeAnalyticsEngine(redis);
    this.ndPatternDetector = new NeurodivergentPatternDetector(weaviate, redis);
    this.privacyManager = new PrivacyManager();
    this.performanceOptimizer = new PerformanceOptimizer();
    this.alertManager = new AlertManager();
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Main processing method - handles incoming biometric data
   */
  async processBiometricData(rawData: BiometricDataPoint): Promise<ProcessingResult> {
    try {
      // 1. Validate and sanitize input
      const validationResult = await this.validateInput(rawData);
      if (!validationResult.isValid) {
        return { success: false, error: validationResult.error };
      }
      
      // 2. Apply privacy protections
      const protectedData = await this.privacyManager.protectData(rawData);
      
      // 3. Performance check
      if (!this.performanceOptimizer.canProcess()) {
        // Queue for later processing
        await this.queueForLaterProcessing(protectedData);
        return { success: true, dataPoint: protectedData };
      }
      
      // 4. Real-time analytics
      const analytics = await this.analyticsEngine.processRealtime(protectedData);
      
      // 5. Pattern detection (async)
      this.ndPatternDetector.analyzePatterns(protectedData).catch(console.error);
      
      // 6. Batch processing for storage
      await this.batchProcessor.addToBatch(protectedData);
      
      // 7. Check for alerts
      const alerts = await this.alertManager.checkAlerts(protectedData, analytics);
      
      // 8. Broadcast updates
      if (this.wsServer) {
        this.broadcastUpdate(protectedData, analytics, alerts);
      }
      
      // 9. Emit events
      this.emit('dataProcessed', { dataPoint: protectedData, analytics, alerts });
      
      return {
        success: true,
        dataPoint: protectedData,
        analytics,
        alerts
      };
      
    } catch (error) {
      console.error('Biometric processing error:', error);
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get current analytics for a user
   */
  async getCurrentAnalytics(userId: string): Promise<RealtimeAnalytics | null> {
    return await this.analyticsEngine.getCurrentAnalytics(userId);
  }
  
  /**
   * Analyze historical patterns
   */
  async analyzeHistoricalPatterns(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    return await this.ndPatternDetector.analyzeHistoricalPatterns(userId, timeRange);
  }
  
  /**
   * Export training data for personalized AI
   */
  async exportTrainingData(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    const trainingExporter = new TrainingDataExporter(this.weaviate);
    return await trainingExporter.exportForPersonalizedAI(userId, dateRange);
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return this.performanceOptimizer.getMetrics();
  }
  
  // ==================== Private Methods ====================
  
  private async validateInput(data: BiometricDataPoint): Promise<{ isValid: boolean; error?: string }> {
    // Comprehensive validation
    if (!data.timestamp || data.timestamp > Date.now() + 60000) { // Allow 1 minute future
      return { isValid: false, error: 'Invalid timestamp' };
    }
    
    if (!data.userId || typeof data.userId !== 'string') {
      return { isValid: false, error: 'Invalid userId' };
    }
    
    // Physiological range validation
    if (data.heartRate < 30 || data.heartRate > 250) {
      return { isValid: false, error: 'Heart rate out of physiological range' };
    }
    
    if (data.cognitiveLoad < 0 || data.cognitiveLoad > 100) {
      return { isValid: false, error: 'Cognitive load must be 0-100' };
    }
    
    if (data.attentionLevel < 0 || data.attentionLevel > 100) {
      return { isValid: false, error: 'Attention level must be 0-100' };
    }
    
    if (data.stressLevel < 0 || data.stressLevel > 100) {
      return { isValid: false, error: 'Stress level must be 0-100' };
    }
    
    return { isValid: true };
  }
  
  private async queueForLaterProcessing(data: BiometricDataPoint): Promise<void> {
    const queueKey = `biometric_queue:${data.userId}`;
    await this.redis.lPush(queueKey, JSON.stringify(data));
    await this.redis.expire(queueKey, 3600); // 1 hour expiry
  }
  
  private broadcastUpdate(
    dataPoint: BiometricDataPoint,
    analytics: RealtimeAnalytics,
    alerts: Alert[]
  ): void {
    if (!this.wsServer) return;
    
    const message = JSON.stringify({
      type: 'biometric_update',
      userId: dataPoint.userId,
      analytics,
      alerts,
      timestamp: Date.now()
    });
    
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  private setupEventHandlers(): void {
    // Handle batch processing completion
    this.batchProcessor.on('batchProcessed', (batchInfo) => {
      this.emit('batchProcessed', batchInfo);
    });
    
    // Handle pattern detection results
    this.ndPatternDetector.on('patternsDetected', (patterns) => {
      this.emit('patternsDetected', patterns);
    });
    
    // Handle critical alerts
    this.alertManager.on('criticalAlert', (alert) => {
      this.emit('criticalAlert', alert);
      if (this.wsServer) {
        this.broadcastCriticalAlert(alert);
      }
    });
  }
  
  private broadcastCriticalAlert(alert: Alert): void {
    const message = JSON.stringify({
      type: 'critical_alert',
      alert,
      timestamp: Date.now()
    });
    
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    await this.batchProcessor.shutdown();
    await this.analyticsEngine.shutdown();
    await this.ndPatternDetector.shutdown();
    this.removeAllListeners();
  }
}

// ==================== Supporting Classes ====================

/**
 * Batch processor for efficient data storage
 */
class BiometricBatchProcessor extends EventEmitter {
  private batchSize: number = 100;
  private batchInterval: number = 1000; // 1 second
  private buffer: BiometricDataPoint[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(private weaviate: WeaviateClient) {
    super();
    this.startBatchTimer();
  }
  
  private startBatchTimer(): void {
    this.timer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.processBatch().catch(console.error);
      }
    }, this.batchInterval);
  }
  
  async addToBatch(dataPoint: BiometricDataPoint): Promise<void> {
    this.buffer.push(dataPoint);
    
    if (this.buffer.length >= this.batchSize) {
      await this.processBatch();
    }
  }
  
  private async processBatch(): Promise<void> {
    const batch = this.buffer.splice(0, this.batchSize);
    if (batch.length === 0) return;
    
    try {
      const weaviateObjects = batch.map(dataPoint => ({
        class: 'NexisBiometricPattern',
        properties: {
          ...dataPoint,
          vector: this.generateBiometricVector(dataPoint)
        }
      }));
      
      await this.weaviate.batch
        .objectsBatcher()
        .withObjects(...weaviateObjects)
        .do();
      
      this.emit('batchProcessed', {
        size: batch.length,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-queue failed items
      this.buffer.unshift(...batch);
    }
  }
  
  private generateBiometricVector(dataPoint: BiometricDataPoint): number[] {
    // Generate semantic vector for Weaviate
    return [
      dataPoint.heartRate / 100,
      dataPoint.hrv / 100,
      dataPoint.cognitiveLoad / 100,
      dataPoint.attentionLevel / 100,
      dataPoint.stressLevel / 100,
      dataPoint.skinTemperature / 40,
      Math.sin(dataPoint.timestamp / 86400000 * 2 * Math.PI), // Time of day
      Math.cos(dataPoint.timestamp / 86400000 * 2 * Math.PI)
    ];
  }
  
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // Process remaining items
    await this.processBatch();
  }
}

/**
 * Real-time analytics engine
 */
class RealtimeAnalyticsEngine {
  private slidingWindows: Map<string, SlidingWindow> = new Map();
  private windowSize: number = 300000; // 5 minutes
  
  constructor(private redis: Redis.RedisClientType) {}
  
  async processRealtime(dataPoint: BiometricDataPoint): Promise<RealtimeAnalytics> {
    // Get or create sliding window for user
    let window = this.slidingWindows.get(dataPoint.userId);
    if (!window) {
      window = new SlidingWindow(this.windowSize);
      this.slidingWindows.set(dataPoint.userId, window);
    }
    
    // Add data point to window
    window.add(dataPoint);
    
    // Calculate analytics
    const analytics: RealtimeAnalytics = {
      cognitiveLoad: this.analyzeCognitiveLoad(window),
      attentionTrend: this.analyzeAttentionTrend(window),
      stressAnalysis: this.analyzeStress(window),
      optimalState: this.analyzeOptimalState(window),
      predictions: await this.generatePredictions(window),
      recommendations: this.generateRecommendations(window),
      timestamp: Date.now()
    };
    
    // Cache analytics
    await this.cacheAnalytics(dataPoint.userId, analytics);
    
    return analytics;
  }
  
  async getCurrentAnalytics(userId: string): Promise<RealtimeAnalytics | null> {
    const cached = await this.redis.get(`analytics:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  private analyzeCognitiveLoad(window: SlidingWindow): CognitiveLoadAnalysis {
    const recentData = window.getRecent(60000); // Last minute
    if (recentData.length === 0) {
      return {
        current: 0,
        average: 0,
        trend: 'stable',
        sustainabilityScore: 1.0,
        recommendation: 'No recent data'
      };
    }
    
    const current = recentData[recentData.length - 1].cognitiveLoad;
    const average = recentData.reduce((sum, d) => sum + d.cognitiveLoad, 0) / recentData.length;
    const trend = this.calculateTrend(recentData.map(d => d.cognitiveLoad));
    
    return {
      current,
      average,
      trend,
      sustainabilityScore: this.calculateSustainability(average, trend),
      recommendation: this.getCognitiveLoadRecommendation(current, average, trend)
    };
  }
  
  private analyzeAttentionTrend(window: SlidingWindow): AttentionTrendAnalysis {
    const recentData = window.getRecent(300000); // Last 5 minutes
    if (recentData.length === 0) {
      return {
        current: 0,
        trend: 'stable',
        stability: 1.0,
        focusQuality: 0,
        distractionEvents: 0
      };
    }
    
    const attentionValues = recentData.map(d => d.attentionLevel);
    
    return {
      current: attentionValues[attentionValues.length - 1],
      trend: this.calculateTrend(attentionValues),
      stability: this.calculateStability(attentionValues),
      focusQuality: this.calculateFocusQuality(recentData),
      distractionEvents: this.countDistractionEvents(attentionValues)
    };
  }
  
  private analyzeStress(window: SlidingWindow): StressAnalysis {
    const allData = window.getAll();
    if (allData.length === 0) {
      return {
        currentLevel: 0,
        pattern: 'baseline',
        triggers: [],
        recoveryTime: 0,
        recommendations: []
      };
    }
    
    const current = allData[allData.length - 1];
    
    return {
      currentLevel: current.stressLevel,
      pattern: this.identifyStressPattern(allData),
      triggers: this.identifyStressTriggers(allData),
      recoveryTime: this.estimateRecoveryTime(allData),
      recommendations: this.getStressRecommendations(current.stressLevel)
    };
  }
  
  private analyzeOptimalState(window: SlidingWindow): OptimalStateAnalysis {
    const recentData = window.getAll();
    if (recentData.length === 0) {
      return {
        isOptimal: false,
        flowScore: 0,
        productivityScore: 0,
        limitingFactor: [],
        optimizationSuggestions: []
      };
    }
    
    const flowScore = this.calculateFlowScore(recentData);
    const productivityScore = this.calculateProductivityScore(recentData);
    
    return {
      isOptimal: flowScore > 0.7 && productivityScore > 0.7,
      flowScore,
      productivityScore,
      limitingFactors: this.identifyLimitingFactors(recentData),
      optimizationSuggestions: this.generateOptimizationSuggestions(recentData)
    };
  }
  
  private async generatePredictions(window: SlidingWindow): Promise<PredictedState> {
    const recentData = window.getAll();
    if (recentData.length < 10) {
      return {
        cognitiveLoad: 50,
        attentionLevel: 50,
        stressLevel: 50,
        confidence: 0,
        timeframe: '15min'
      };
    }
    
    // Simple prediction based on trends - can be enhanced with ML
    const latest = recentData[recentData.length - 1];
    const cognitiveLoadTrend = this.calculateTrend(recentData.map(d => d.cognitiveLoad));
    const attentionTrend = this.calculateTrend(recentData.map(d => d.attentionLevel));
    const stressTrend = this.calculateTrend(recentData.map(d => d.stressLevel));
    
    const trendMultiplier = {
      'increasing': 1.1,
      'decreasing': 0.9,
      'stable': 1.0
    };
    
    return {
      cognitiveLoad: Math.min(100, Math.max(0, latest.cognitiveLoad * trendMultiplier[cognitiveLoadTrend])),
      attentionLevel: Math.min(100, Math.max(0, latest.attentionLevel * trendMultiplier[attentionTrend])),
      stressLevel: Math.min(100, Math.max(0, latest.stressLevel * trendMultiplier[stressTrend])),
      confidence: 0.75,
      timeframe: '15min'
    };
  }
  
  private generateRecommendations(window: SlidingWindow): Recommendation[] {
    const recentData = window.getAll();
    const recommendations: Recommendation[] = [];
    
    if (recentData.length === 0) return recommendations;
    
    const latest = recentData[recentData.length - 1];
    
    // High cognitive load
    if (latest.cognitiveLoad > 85) {
      recommendations.push({
        type: 'break',
        priority: 'high',
        message: 'Take a 5-10 minute break to prevent cognitive fatigue',
        duration: 600000,
        actions: ['step_away', 'deep_breathing', 'hydrate']
      });
    }
    
    // Low attention
    if (latest.attentionLevel < 50) {
      recommendations.push({
        type: 'environment',
        priority: 'medium',
        message: 'Optimize environment to improve focus',
        actions: ['reduce_distractions', 'adjust_lighting', 'change_location']
      });
    }
    
    // High stress
    if (latest.stressLevel > 70) {
      recommendations.push({
        type: 'breathing',
        priority: 'high',
        message: 'Practice breathing exercises to reduce stress',
        duration: 180000,
        actions: ['4_7_8_breathing', 'progressive_relaxation']
      });
    }
    
    return recommendations;
  }
  
  private async cacheAnalytics(userId: string, analytics: RealtimeAnalytics): Promise<void> {
    await this.redis.setEx(`analytics:${userId}`, 300, JSON.stringify(analytics));
  }
  
  // Helper methods
  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (Math.abs(difference) < 5) return 'stable';
    return difference > 0 ? 'increasing' : 'decreasing';
  }
  
  private calculateStability(values: number[]): number {
    if (values.length < 2) return 1;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Coefficient of variation (lower is more stable)
    const cv = stdDev / mean;
    
    // Convert to 0-1 scale where 1 is most stable
    return Math.max(0, 1 - cv);
  }
  
  private calculateSustainability(average: number, trend: string): number {
    let score = 1.0;
    
    if (average > 80) score -= 0.3;
    if (average > 90) score -= 0.4;
    if (trend === 'increasing') score -= 0.2;
    
    return Math.max(0, score);
  }
  
  private getCognitiveLoadRecommendation(current: number, average: number, trend: string): string {
    if (current > 85 && trend === 'increasing') {
      return 'Immediate break recommended to prevent burnout';
    } else if (average > 75) {
      return 'Consider a short break in the next 15 minutes';
    } else if (average < 30) {
      return 'Cognitive capacity available for challenging tasks';
    }
    return 'Optimal cognitive load for sustained work';
  }
  
  private calculateFocusQuality(data: BiometricDataPoint[]): number {
    // Calculate focus quality based on attention stability and cognitive load alignment
    const attentionStability = this.calculateStability(data.map(d => d.attentionLevel));
    const avgAttention = data.reduce((sum, d) => sum + d.attentionLevel, 0) / data.length;
    const avgCognitiveLoad = data.reduce((sum, d) => sum + d.cognitiveLoad, 0) / data.length;
    
    // Good focus = high attention + stable + appropriate cognitive load
    const attentionScore = avgAttention / 100;
    const loadScore = Math.max(0, 1 - Math.abs(avgCognitiveLoad - 70) / 30); // Optimal around 70%
    
    return (attentionScore * 0.4 + attentionStability * 0.3 + loadScore * 0.3);
  }
  
  private countDistractionEvents(attentionValues: number[]): number {
    let distractions = 0;
    for (let i = 1; i < attentionValues.length; i++) {
      if (attentionValues[i] < attentionValues[i-1] - 20) {
        distractions++;
      }
    }
    return distractions;
  }
  
  private identifyStressPattern(data: BiometricDataPoint[]): 'episodic' | 'sustained_high' | 'cyclic' | 'baseline' {
    const stressValues = data.map(d => d.stressLevel);
    const avgStress = stressValues.reduce((a, b) => a + b, 0) / stressValues.length;
    
    if (avgStress > 70) return 'sustained_high';
    
    // Check for episodic spikes
    const spikes = stressValues.filter(s => s > 80).length;
    if (spikes > stressValues.length * 0.2) return 'episodic';
    
    // Check for cyclical patterns (simplified)
    const stability = this.calculateStability(stressValues);
    if (stability < 0.5) return 'cyclic';
    
    return 'baseline';
  }
  
  private identifyStressTriggers(data: BiometricDataPoint[]): string[] {
    const triggers: string[] = [];
    
    // Analyze patterns that precede stress spikes
    for (let i = 1; i < data.length; i++) {
      if (data[i].stressLevel > data[i-1].stressLevel + 20) {
        // Significant stress increase
        if (data[i].cognitiveLoad > 80) triggers.push('high_cognitive_load');
        if (data[i-1].attentionLevel < 40) triggers.push('low_attention');
        if (data[i].contextId !== data[i-1].contextId) triggers.push('context_switch');
      }
    }
    
    return [...new Set(triggers)]; // Remove duplicates
  }
  
  private estimateRecoveryTime(data: BiometricDataPoint[]): number {
    // Analyze historical stress recovery patterns
    let totalRecoveryTime = 0;
    let recoveryInstances = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i-1].stressLevel > 70 && data[i].stressLevel < 50) {
        // Found a recovery instance
        let recoveryStart = i - 1;
        while (recoveryStart > 0 && data[recoveryStart].stressLevel > 70) {
          recoveryStart--;
        }
        
        totalRecoveryTime += data[i].timestamp - data[recoveryStart].timestamp;
        recoveryInstances++;
      }
    }
    
    return recoveryInstances > 0 ? totalRecoveryTime / recoveryInstances : 600000; // Default 10 min
  }
  
  private getStressRecommendations(stressLevel: number): string[] {
    const recommendations = [];
    
    if (stressLevel > 80) {
      recommendations.push('Take immediate break', 'Practice deep breathing', 'Remove stressors');
    } else if (stressLevel > 60) {
      recommendations.push('Reduce workload', 'Take short breaks', 'Practice mindfulness');
    } else if (stressLevel > 40) {
      recommendations.push('Monitor stress levels', 'Maintain good work-life balance');
    }
    
    return recommendations;
  }
  
  private calculateFlowScore(data: BiometricDataPoint[]): number {
    // Flow state characteristics: moderate-high attention, moderate cognitive load, low stress
    const avgAttention = data.reduce((sum, d) => sum + d.attentionLevel, 0) / data.length;
    const avgCognitiveLoad = data.reduce((sum, d) => sum + d.cognitiveLoad, 0) / data.length;
    const avgStress = data.reduce((sum, d) => sum + d.stressLevel, 0) / data.length;
    
    const attentionScore = Math.min(1, avgAttention / 80); // Optimal above 80
    const loadScore = 1 - Math.abs(avgCognitiveLoad - 65) / 35; // Optimal around 65
    const stressScore = Math.max(0, 1 - avgStress / 40); // Low stress preferred
    
    return (attentionScore * 0.4 + loadScore * 0.4 + stressScore * 0.2);
  }
  
  private calculateProductivityScore(data: BiometricDataPoint[]): number {
    // Productivity based on sustained attention and appropriate cognitive load
    const attentionStability = this.calculateStability(data.map(d => d.attentionLevel));
    const avgAttention = data.reduce((sum, d) => sum + d.attentionLevel, 0) / data.length;
    const avgCognitiveLoad = data.reduce((sum, d) => sum + d.cognitiveLoad, 0) / data.length;
    
    const attentionScore = avgAttention / 100;
    const stabilityScore = attentionStability;
    const loadScore = Math.min(1, avgCognitiveLoad / 70); // Higher load can indicate productivity
    
    return (attentionScore * 0.4 + stabilityScore * 0.3 + loadScore * 0.3);
  }
  
  private identifyLimitingFactors(data: BiometricDataPoint[]): string[] {
    const factors = [];
    
    const avgAttention = data.reduce((sum, d) => sum + d.attentionLevel, 0) / data.length;
    const avgStress = data.reduce((sum, d) => sum + d.stressLevel, 0) / data.length;
    const avgCognitiveLoad = data.reduce((sum, d) => sum + d.cognitiveLoad, 0) / data.length;
    
    if (avgAttention < 60) factors.push('low_attention');
    if (avgStress > 60) factors.push('high_stress');
    if (avgCognitiveLoad > 85) factors.push('cognitive_overload');
    if (avgCognitiveLoad < 30) factors.push('underutilization');
    
    const attentionStability = this.calculateStability(data.map(d => d.attentionLevel));
    if (attentionStability < 0.6) factors.push('attention_instability');
    
    return factors;
  }
  
  private generateOptimizationSuggestions(data: BiometricDataPoint[]): string[] {
    const suggestions = [];
    const limitingFactors = this.identifyLimitingFactors(data);
    
    if (limitingFactors.includes('low_attention')) {
      suggestions.push('Optimize environment for focus', 'Use attention training exercises');
    }
    
    if (limitingFactors.includes('high_stress')) {
      suggestions.push('Implement stress management techniques', 'Schedule regular breaks');
    }
    
    if (limitingFactors.includes('cognitive_overload')) {
      suggestions.push('Break tasks into smaller chunks', 'Prioritize important tasks');
    }
    
    if (limitingFactors.includes('attention_instability')) {
      suggestions.push('Practice mindfulness meditation', 'Reduce environmental distractions');
    }
    
    return suggestions;
  }
  
  async shutdown(): Promise<void> {
    this.slidingWindows.clear();
  }
}

// ==================== Supporting Classes ====================

/**
 * Sliding window for maintaining recent data
 */
class SlidingWindow {
  private data: BiometricDataPoint[] = [];
  
  constructor(private windowSize: number) {}
  
  add(dataPoint: BiometricDataPoint): void {
    this.data.push(dataPoint);
    
    // Remove old data outside window
    const cutoff = Date.now() - this.windowSize;
    this.data = this.data.filter(d => d.timestamp > cutoff);
  }
  
  getAll(): BiometricDataPoint[] {
    return [...this.data];
  }
  
  getRecent(duration: number): BiometricDataPoint[] {
    const cutoff = Date.now() - duration;
    return this.data.filter(d => d.timestamp > cutoff);
  }
}

/**
 * Neurodivergent pattern detector (placeholder for full implementation)
 */
class NeurodivergentPatternDetector extends EventEmitter {
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType
  ) {
    super();
  }
  
  async analyzePatterns(dataPoint: BiometricDataPoint): Promise<void> {
    // Placeholder for neurodivergent pattern analysis
    // This would include hyperfocus detection, attention cycling, etc.
  }
  
  async analyzeHistoricalPatterns(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    // Placeholder for historical pattern analysis
    return {};
  }
  
  async shutdown(): Promise<void> {
    this.removeAllListeners();
  }
}

/**
 * Privacy manager for data protection
 */
class PrivacyManager {
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
 * Performance optimizer
 */
class PerformanceOptimizer {
  private processingCount = 0;
  private maxConcurrentProcessing = 100;
  
  canProcess(): boolean {
    return this.processingCount < this.maxConcurrentProcessing;
  }
  
  getMetrics(): any {
    return {
      processingCount: this.processingCount,
      maxConcurrent: this.maxConcurrentProcessing,
      memoryUsage: process.memoryUsage()
    };
  }
}

/**
 * Alert manager
 */
class AlertManager extends EventEmitter {
  async checkAlerts(
    dataPoint: BiometricDataPoint,
    analytics: RealtimeAnalytics
  ): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    // Critical cognitive overload
    if (dataPoint.cognitiveLoad > 95) {
      const alert: Alert = {
        type: 'critical',
        message: 'Critical cognitive overload detected',
        action: 'immediate_break_required',
        timestamp: Date.now(),
        userId: dataPoint.userId
      };
      alerts.push(alert);
      this.emit('criticalAlert', alert);
    }
    
    // Sustained high stress
    if (analytics.stressAnalysis.pattern === 'sustained_high') {
      alerts.push({
        type: 'warning',
        message: 'Sustained high stress detected',
        action: 'stress_intervention_recommended',
        timestamp: Date.now(),
        userId: dataPoint.userId
      });
    }
    
    return alerts;
  }
}

/**
 * Training data exporter (placeholder)
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

export default BiometricPipelineService;