import Redis from 'redis';
import { BiometricDataPoint, RealtimeAnalytics, CognitiveLoadAnalysis, AttentionTrendAnalysis, StressAnalysis, OptimalStateAnalysis, PredictedState, Recommendation } from '../BiometricPipelineService';
import { SlidingWindow } from './StreamProcessor';

export interface CalculatorConfig {
  cacheTTL: number;
  predictionConfidence: number;
  trendSensitivity: number;
  flowThreshold: number;
  productivityThreshold: number;
}

/**
 * Comprehensive biometric analytics calculation engine
 */
export class BiometricCalculator {
  private config: CalculatorConfig;

  constructor(
    private redis: Redis.RedisClientType,
    config: Partial<CalculatorConfig> = {}
  ) {
    this.config = {
      cacheTTL: 300, // 5 minutes
      predictionConfidence: 0.75,
      trendSensitivity: 5,
      flowThreshold: 0.7,
      productivityThreshold: 0.7,
      ...config
    };
  }

  /**
   * Calculate comprehensive real-time analytics
   */
  async calculateRealTimeAnalytics(window: SlidingWindow): Promise<RealtimeAnalytics> {
    const analytics: RealtimeAnalytics = {
      cognitiveLoad: this.analyzeCognitiveLoad(window),
      attentionTrend: this.analyzeAttentionTrend(window),
      stressAnalysis: this.analyzeStress(window),
      optimalState: this.analyzeOptimalState(window),
      predictions: await this.generatePredictions(window),
      recommendations: this.generateRecommendations(window),
      timestamp: Date.now()
    };

    return analytics;
  }

  /**
   * Get current analytics from cache
   */
  async getCurrentAnalytics(userId: string): Promise<RealtimeAnalytics | null> {
    const cached = await this.redis.get(`analytics:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache analytics for quick retrieval
   */
  async cacheAnalytics(userId: string, analytics: RealtimeAnalytics): Promise<void> {
    await this.redis.setEx(`analytics:${userId}`, this.config.cacheTTL, JSON.stringify(analytics));
  }

  /**
   * Analyze cognitive load patterns
   */
  analyzeCognitiveLoad(window: SlidingWindow): CognitiveLoadAnalysis {
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

  /**
   * Analyze attention trend patterns
   */
  analyzeAttentionTrend(window: SlidingWindow): AttentionTrendAnalysis {
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

  /**
   * Analyze stress patterns
   */
  analyzeStress(window: SlidingWindow): StressAnalysis {
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

  /**
   * Analyze optimal state and flow characteristics
   */
  analyzeOptimalState(window: SlidingWindow): OptimalStateAnalysis {
    const recentData = window.getAll();
    if (recentData.length === 0) {
      return {
        isOptimal: false,
        flowScore: 0,
        productivityScore: 0,
        limitingFactors: [],
        optimizationSuggestions: []
      };
    }
    
    const flowScore = this.calculateFlowScore(recentData);
    const productivityScore = this.calculateProductivityScore(recentData);
    
    return {
      isOptimal: flowScore > this.config.flowThreshold && productivityScore > this.config.productivityThreshold,
      flowScore,
      productivityScore,
      limitingFactors: this.identifyLimitingFactors(recentData),
      optimizationSuggestions: this.generateOptimizationSuggestions(recentData)
    };
  }

  /**
   * Generate future state predictions
   */
  async generatePredictions(window: SlidingWindow): Promise<PredictedState> {
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
      confidence: this.config.predictionConfidence,
      timeframe: '15min'
    };
  }

  /**
   * Generate personalized recommendations
   */
  generateRecommendations(window: SlidingWindow): Recommendation[] {
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

    // Task switching recommendation
    if (latest.cognitiveLoad < 30 && latest.attentionLevel > 70) {
      recommendations.push({
        type: 'task_switch',
        priority: 'medium',
        message: 'Good time for challenging or creative tasks',
        actions: ['tackle_difficult_problems', 'creative_work']
      });
    }
    
    return recommendations;
  }

  // ==================== Helper Methods ====================

  /**
   * Calculate trend direction from data series
   */
  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (Math.abs(difference) < this.config.trendSensitivity) return 'stable';
    return difference > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Calculate stability (lower variance = higher stability)
   */
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

  /**
   * Calculate sustainability score for cognitive load
   */
  private calculateSustainability(average: number, trend: string): number {
    let score = 1.0;
    
    if (average > 80) score -= 0.3;
    if (average > 90) score -= 0.4;
    if (trend === 'increasing') score -= 0.2;
    
    return Math.max(0, score);
  }

  /**
   * Get cognitive load recommendation
   */
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

  /**
   * Calculate focus quality based on attention stability and load alignment
   */
  private calculateFocusQuality(data: BiometricDataPoint[]): number {
    const attentionStability = this.calculateStability(data.map(d => d.attentionLevel));
    const avgAttention = data.reduce((sum, d) => sum + d.attentionLevel, 0) / data.length;
    const avgCognitiveLoad = data.reduce((sum, d) => sum + d.cognitiveLoad, 0) / data.length;
    
    // Good focus = high attention + stable + appropriate cognitive load
    const attentionScore = avgAttention / 100;
    const loadScore = Math.max(0, 1 - Math.abs(avgCognitiveLoad - 70) / 30); // Optimal around 70%
    
    return (attentionScore * 0.4 + attentionStability * 0.3 + loadScore * 0.3);
  }

  /**
   * Count distraction events
   */
  private countDistractionEvents(attentionValues: number[]): number {
    let distractions = 0;
    for (let i = 1; i < attentionValues.length; i++) {
      if (attentionValues[i] < attentionValues[i-1] - 20) {
        distractions++;
      }
    }
    return distractions;
  }

  /**
   * Identify stress pattern
   */
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

  /**
   * Identify stress triggers
   */
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

  /**
   * Estimate stress recovery time
   */
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

  /**
   * Get stress-specific recommendations
   */
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

  /**
   * Calculate flow state score
   */
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

  /**
   * Calculate productivity score
   */
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

  /**
   * Identify factors limiting optimal performance
   */
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

  /**
   * Generate optimization suggestions
   */
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
}