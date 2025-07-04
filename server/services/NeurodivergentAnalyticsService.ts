// Enhanced Neurodivergent Analytics Service
// Specialized pattern detection for ADHD, autism, and other neurodivergent profiles

import { weaviateClient } from './weaviate-client';
import type { WeaviateClient } from 'weaviate-client';
import Redis from 'redis';
import { EventEmitter } from 'events';
import { BiometricDataPoint } from './BiometricPipelineService';
import { HyperfocusDetector, HyperfocusPattern } from './neurodivergent/HyperfocusDetector';
import { SensoryProcessor, SensoryProcessingPattern } from './neurodivergent/SensoryProcessor';
import { ExecutiveFunctionAnalyzer, ExecutiveFunctionPattern } from './neurodivergent/ExecutiveFunctionAnalyzer';
import { AttentionPatternAnalyzer, AttentionPattern, StimulationPattern, TimePerceptionPattern, EnergyPattern } from './neurodivergent/AttentionPatternAnalyzer';

// ==================== Neurodivergent Pattern Types ====================

export interface NDPatterns {
  hyperfocus: HyperfocusPattern[];
  contextSwitching: ContextSwitchingPattern;
  sensoryProcessing: SensoryProcessingPattern;
  executiveFunction: ExecutiveFunctionPattern;
  attentionVariability: AttentionPattern;
  stimRegulation: StimulationPattern;
  timePerception: TimePerceptionPattern;
  energyManagement: EnergyPattern;
  timestamp: number;
  userId: string;
}

export interface ContextSwitchingPattern {
  switchCount: number;
  hourlyRate: number;
  avgTimeBetweenSwitches: number;
  pattern: 'high' | 'normal' | 'low' | 'chaotic';
  optimalSwitchingWindows: number[];
  switchingEfficiency: number;
  cognitiveeCost: number;
}

// ==================== Neurodivergent Analytics Service ====================

export class NeurodivergentAnalyticsService extends EventEmitter {
  private patternCache: Map<string, NDPatterns> = new Map();
  private analysisWindow: number = 24 * 60 * 60 * 1000; // 24 hours
  private hyperfocusDetector: HyperfocusDetector;
  private sensoryProcessor: SensoryProcessor;
  private executiveFunctionAnalyzer: ExecutiveFunctionAnalyzer;
  private attentionPatternAnalyzer: AttentionPatternAnalyzer;
  
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType
  ) {
    super();
    
    // Initialize specialized analyzers
    this.hyperfocusDetector = new HyperfocusDetector();
    this.sensoryProcessor = new SensoryProcessor();
    this.executiveFunctionAnalyzer = new ExecutiveFunctionAnalyzer();
    this.attentionPatternAnalyzer = new AttentionPatternAnalyzer();
  }
  
  /**
   * Main analysis method - detects all neurodivergent patterns
   */
  async analyzeNeurodivergentPatterns(
    userId: string,
    biometricStream: BiometricDataPoint[],
    timeRange?: { start: Date; end: Date }
  ): Promise<NDPatterns> {
    try {
      const cacheKey = `nd_patterns:${userId}:${Date.now()}`;
      
      // Check cache first
      const cached = await this.getCachedPatterns(userId);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }
      
      // Analyze patterns using specialized services
      const patterns: NDPatterns = {
        hyperfocus: await this.hyperfocusDetector.detectHyperfocusPatterns(biometricStream),
        contextSwitching: await this.analyzeContextSwitching(biometricStream),
        sensoryProcessing: await this.sensoryProcessor.evaluateSensoryProcessing(biometricStream),
        executiveFunction: await this.executiveFunctionAnalyzer.assessExecutiveFunction(biometricStream),
        attentionVariability: await this.attentionPatternAnalyzer.analyzeAttentionPatterns(biometricStream),
        stimRegulation: await this.attentionPatternAnalyzer.analyzeStimulationPatterns(biometricStream),
        timePerception: await this.attentionPatternAnalyzer.analyzeTimePerception(biometricStream),
        energyManagement: await this.attentionPatternAnalyzer.analyzeEnergyPatterns(biometricStream),
        timestamp: Date.now(),
        userId
      };
      
      // Store patterns in Weaviate
      await this.storePatterns(patterns);
      
      // Cache patterns
      await this.cachePatterns(userId, patterns);
      
      // Generate personalized insights
      const insights = await this.generatePersonalizedInsights(patterns);
      
      // Emit events
      this.emit('patternsDetected', { patterns, insights });
      
      return patterns;
      
    } catch (error) {
      console.error('Neurodivergent analysis error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Context switching analysis - remaining implementation needed here
   */
  private async analyzeContextSwitching(stream: BiometricDataPoint[]): Promise<ContextSwitchingPattern> {
    const switches = this.detectContextSwitches(stream);
    const switchCount = switches.length;
    
    if (stream.length === 0) {
      return {
        switchCount: 0,
        hourlyRate: 0,
        avgTimeBetweenSwitches: 0,
        pattern: 'low',
        optimalSwitchingWindows: [],
        switchingEfficiency: 100,
        cognitiveeCost: 0
      };
    }

    const timeSpan = (stream[stream.length - 1].timestamp - stream[0].timestamp) / (1000 * 60 * 60); // hours
    const hourlyRate = timeSpan > 0 ? switchCount / timeSpan : 0;
    
    const switchTimestamps = switches.map(s => s.timestamp);
    const avgTimeBetweenSwitches = this.calculateAvgTimeBetween(switchTimestamps);
    
    const pattern = this.classifySwitchingPattern(hourlyRate, switches);
    const optimalSwitchingWindows = this.findOptimalSwitchingWindows(stream, switches);
    const switchingEfficiency = this.calculateSwitchingEfficiency(switches, stream);
    const cognitiveeCost = switches.reduce((sum, s) => sum + s.cost, 0) / Math.max(1, switches.length);

    return {
      switchCount,
      hourlyRate,
      avgTimeBetweenSwitches,
      pattern,
      optimalSwitchingWindows,
      switchingEfficiency,
      cognitiveeCost
    };
  }

  /**
   * Detect context switches in the biometric stream
   */
  private detectContextSwitches(stream: BiometricDataPoint[]): Array<{timestamp: number, cost: number, type: string}> {
    const switches: Array<{timestamp: number, cost: number, type: string}> = [];
    
    for (let i = 1; i < stream.length; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      
      if (prev.contextId && current.contextId && prev.contextId !== current.contextId) {
        const cost = this.calculateSwitchingCost(stream, i);
        switches.push({
          timestamp: current.timestamp,
          cost,
          type: 'context_change'
        });
      }
    }
    
    return switches;
  }

  /**
   * Calculate cognitive cost of context switch
   */
  private calculateSwitchingCost(stream: BiometricDataPoint[], switchIndex: number): number {
    if (switchIndex <= 0 || switchIndex >= stream.length) return 0;
    
    const before = stream[switchIndex - 1];
    const after = stream[switchIndex];
    
    const attentionDrop = Math.max(0, before.attentionLevel - after.attentionLevel);
    const cognitiveIncrease = Math.max(0, after.cognitiveLoad - before.cognitiveLoad);
    const stressIncrease = Math.max(0, after.stressLevel - before.stressLevel);
    
    return (attentionDrop * 0.4 + cognitiveIncrease * 0.3 + stressIncrease * 0.3);
  }

  /**
   * Calculate average time between events
   */
  private calculateAvgTimeBetween(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;
    
    let totalTime = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalTime += timestamps[i] - timestamps[i - 1];
    }
    
    return totalTime / (timestamps.length - 1);
  }

  /**
   * Classify switching pattern based on frequency and characteristics
   */
  private classifySwitchingPattern(
    hourlyRate: number,
    switches: any[]
  ): 'high' | 'normal' | 'low' | 'chaotic' {
    if (hourlyRate > 20) return 'chaotic';
    if (hourlyRate > 10) return 'high';
    if (hourlyRate > 3) return 'normal';
    return 'low';
  }

  /**
   * Find optimal time windows for context switching
   */
  private findOptimalSwitchingWindows(
    stream: BiometricDataPoint[],
    switches: any[]
  ): number[] {
    const hourlyEfficiency: { [hour: number]: number[] } = {};
    
    switches.forEach(switchData => {
      const hour = new Date(switchData.timestamp).getHours();
      if (!hourlyEfficiency[hour]) hourlyEfficiency[hour] = [];
      hourlyEfficiency[hour].push(100 - switchData.cost); // Convert cost to efficiency
    });
    
    const avgEfficiencyByHour = Object.entries(hourlyEfficiency)
      .map(([hour, efficiencies]) => ({
        hour: parseInt(hour),
        avgEfficiency: efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
      }))
      .sort((a, b) => b.avgEfficiency - a.avgEfficiency)
      .slice(0, 3) // Top 3 hours
      .map(entry => entry.hour);
    
    return avgEfficiencyByHour;
  }

  /**
   * Calculate overall switching efficiency
   */
  private calculateSwitchingEfficiency(switches: any[], stream: BiometricDataPoint[]): number {
    if (switches.length === 0) return 100;
    
    const avgCost = switches.reduce((sum, s) => sum + s.cost, 0) / switches.length;
    return Math.max(0, 100 - avgCost);
  }

  /**
   * Cache management methods
   */
  private async getCachedPatterns(userId: string): Promise<NDPatterns | null> {
    try {
      const cached = await this.redis.get(`nd_patterns:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached patterns:', error);
      return null;
    }
  }

  private isCacheValid(patterns: NDPatterns): boolean {
    const cacheAge = Date.now() - patterns.timestamp;
    return cacheAge < this.analysisWindow; // Valid for 24 hours
  }

  private async cachePatterns(userId: string, patterns: NDPatterns): Promise<void> {
    try {
      await this.redis.setEx(
        `nd_patterns:${userId}`,
        60 * 60 * 24, // 24 hours
        JSON.stringify(patterns)
      );
    } catch (error) {
      console.error('Failed to cache patterns:', error);
    }
  }

  /**
   * Store patterns in Weaviate for long-term analysis
   */
  private async storePatterns(patterns: NDPatterns): Promise<void> {
    try {
      const properties = {
        userId: patterns.userId,
        timestamp: new Date(patterns.timestamp).toISOString(),
        hyperfocusEpisodes: patterns.hyperfocus.length,
        avgCognitiveLoad: patterns.executiveFunction.avgCognitiveLoad,
        attentionVariability: patterns.attentionVariability.variability,
        sensoryOverloadEvents: patterns.sensoryProcessing.overloadEvents,
        contextSwitchRate: patterns.contextSwitching.hourlyRate,
        energyManagementScore: patterns.energyManagement.spoonTheoryScore,
        analysisData: JSON.stringify(patterns)
      };

      await this.weaviate.data
        .creator()
        .withClassName('NeurodivergentPattern')
        .withProperties(properties)
        .do();

      console.log(`✓ Stored neurodivergent patterns for user ${patterns.userId}`);
    } catch (error) {
      console.error('Failed to store patterns in Weaviate:', error);
      // Don't throw - pattern analysis should continue even if storage fails
    }
  }

  /**
   * Generate personalized insights based on detected patterns
   */
  private async generatePersonalizedInsights(patterns: NDPatterns): Promise<string[]> {
    const insights: string[] = [];

    // Hyperfocus insights
    if (patterns.hyperfocus.length > 0) {
      const avgDuration = patterns.hyperfocus.reduce((sum, h) => sum + h.duration, 0) / patterns.hyperfocus.length;
      const avgQuality = patterns.hyperfocus.reduce((sum, h) => sum + h.qualityScore, 0) / patterns.hyperfocus.length;
      
      insights.push(`You had ${patterns.hyperfocus.length} hyperfocus episodes with average duration of ${Math.round(avgDuration / (1000 * 60))} minutes`);
      
      if (avgQuality > 80) {
        insights.push('Your hyperfocus episodes are highly productive - leverage this superpower!');
      }
    }

    // Executive function insights
    if (patterns.executiveFunction.planningEfficiency < 60) {
      insights.push('Consider using visual planning tools and breaking tasks into smaller steps');
    }

    // Sensory processing insights
    if (patterns.sensoryProcessing.overloadEvents > 3) {
      insights.push('You experienced several sensory overload events - consider environmental modifications');
    }

    // Context switching insights
    if (patterns.contextSwitching.hourlyRate > 10) {
      insights.push('High context switching detected - try time-blocking to reduce cognitive overhead');
    }

    // Energy management insights
    if (patterns.energyManagement.spoonTheoryScore < 40) {
      insights.push('Energy levels are low - prioritize rest and recovery strategies');
    }

    return insights;
  }

  /**
   * Get comprehensive analytics for a user
   */
  async getUserAnalytics(userId: string, timeRange?: { start: Date; end: Date }): Promise<{
    patterns: NDPatterns | null;
    insights: string[];
    recommendations: string[];
    trends: any;
  }> {
    try {
      const patterns = await this.getCachedPatterns(userId);
      
      if (!patterns) {
        return {
          patterns: null,
          insights: ['No recent analysis available'],
          recommendations: ['Run a new analysis with current biometric data'],
          trends: {}
        };
      }

      const insights = await this.generatePersonalizedInsights(patterns);
      const recommendations = this.generateRecommendations(patterns);
      const trends = await this.analyzeTrends(userId, timeRange);

      return {
        patterns,
        insights,
        recommendations,
        trends
      };
    } catch (error) {
      console.error('Failed to get user analytics:', error);
      throw error;
    }
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(patterns: NDPatterns): string[] {
    const recommendations: string[] = [];

    // Executive function recommendations
    const efMetrics = this.executiveFunctionAnalyzer.generateExecutiveFunctionMetrics(patterns.executiveFunction);
    recommendations.push(...efMetrics.recommendations);

    // Sensory processing recommendations
    if (patterns.sensoryProcessing.processingSensitivity > 70) {
      recommendations.push('Consider noise-canceling headphones and adjustable lighting');
    }

    // Hyperfocus recommendations
    if (patterns.hyperfocus.length > 0) {
      const avgRecovery = patterns.hyperfocus.reduce((sum, h) => sum + h.recoveryTime, 0) / patterns.hyperfocus.length;
      if (avgRecovery > 30 * 60 * 1000) { // > 30 minutes
        recommendations.push('Plan recovery breaks after intense focus sessions');
      }
    }

    return recommendations;
  }

  /**
   * Analyze trends over time
   */
  private async analyzeTrends(userId: string, timeRange?: { start: Date; end: Date }): Promise<any> {
    // This would query historical data from Weaviate to identify trends
    // Placeholder implementation
    return {
      hyperfocusFrequency: 'stable',
      stressLevels: 'improving',
      executiveFunction: 'stable',
      energyManagement: 'needs_attention'
    };
  }

  /**
   * Export patterns for external analysis
   */
  async exportPatterns(userId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const patterns = await this.getCachedPatterns(userId);
    
    if (!patterns) {
      throw new Error('No patterns available for export');
    }

    if (format === 'json') {
      return JSON.stringify(patterns, null, 2);
    } else {
      // CSV export would be implemented here
      throw new Error('CSV export not yet implemented');
    }
  }
}

export const neurodivergentAnalyticsService = new NeurodivergentAnalyticsService(
  weaviateClient.getClient(),
  // Redis client would be initialized here
  {} as Redis.RedisClientType
);