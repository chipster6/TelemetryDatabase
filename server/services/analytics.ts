import { vectorDatabase } from './vector-database.js';
import { postQuantumEncryption } from './encryption.js';
import { BiometricData, PromptSession } from '../../shared/schema.js';
import { v4 as uuidv4 } from 'uuid';

export interface TelemetryEvent {
  id: string;
  eventType: 'biometric_reading' | 'prompt_execution' | 'cognitive_correlation' | 'user_interaction';
  timestamp: number;
  userId?: number;
  sessionId?: number;
  data: any;
  metadata: {
    source: string;
    version: string;
    environment: string;
  };
}

export interface CognitiveCorrelationAnalysis {
  userId: number;
  timeRange: { start: number; end: number };
  correlations: {
    heartRateVsAttention: number;
    stressVsPerformance: number;
    hrvVsCognition: number;
    circadianVsEfficiency: number;
  };
  insights: string[];
  recommendations: string[];
}

export interface PerformanceMetrics {
  totalSessions: number;
  averageResponseTime: number;
  cognitiveLoadTrends: number[];
  biometricStability: number;
  aiAdaptationEffectiveness: number;
}

export class TelemetryAnalyticsService {
  private eventBuffer: TelemetryEvent[] = [];
  private bufferSize = 1000;
  private processingInterval: NodeJS.Timeout;

  constructor() {
    // Process events every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processEventBuffer();
    }, 30000);
  }

  /**
   * Record telemetry event
   */
  async recordEvent(eventType: TelemetryEvent['eventType'], data: any, options: {
    userId?: number;
    sessionId?: number;
    source?: string;
  } = {}): Promise<void> {
    const event: TelemetryEvent = {
      id: uuidv4(),
      eventType,
      timestamp: Date.now(),
      userId: options.userId,
      sessionId: options.sessionId,
      data,
      metadata: {
        source: options.source || 'system',
        version: '3.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    this.eventBuffer.push(event);

    // Process immediately if buffer is full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.processEventBuffer();
    }
  }

  /**
   * Process buffered events and store in vector database
   */
  private async processEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      for (const event of events) {
        // Create vector document for semantic search
        const vectorDoc = {
          id: event.id,
          content: JSON.stringify(event.data),
          metadata: {
            timestamp: event.timestamp,
            userId: event.userId,
            sessionId: event.sessionId,
            contentType: 'telemetry' as const,
            eventType: event.eventType,
            source: event.metadata.source
          }
        };

        await vectorDatabase.storeDocument(vectorDoc);
      }

      console.log(`Processed ${events.length} telemetry events`);

    } catch (error) {
      console.error('Error processing event buffer:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Analyze cognitive correlations using ML algorithms
   */
  async analyzeCognitiveCorrelations(userId: number, timeRange: {
    start: number;
    end: number;
  }): Promise<CognitiveCorrelationAnalysis> {
    try {
      // Search for biometric and prompt data
      const biometricData = await vectorDatabase.semanticSearch(
        'biometric data heart rate stress attention cognitive load',
        {
          filter: { userId, timeRange },
          contentTypes: ['biometric'],
          limit: 1000
        }
      );

      const promptData = await vectorDatabase.semanticSearch(
        'prompt response cognitive complexity performance',
        {
          filter: { userId, timeRange },
          contentTypes: ['prompt', 'response'],
          limit: 1000
        }
      );

      // Calculate correlations
      const correlations = this.calculateCorrelations(biometricData, promptData);
      
      // Generate insights using pattern recognition
      const insights = this.generateInsights(correlations, biometricData, promptData);
      
      // Create personalized recommendations
      const recommendations = this.generateRecommendations(correlations, insights);

      return {
        userId,
        timeRange,
        correlations,
        insights,
        recommendations
      };

    } catch (error) {
      console.error('Cognitive correlation analysis failed:', error);
      throw error;
    }
  }

  /**
   * Calculate statistical correlations between biometric and cognitive data
   */
  private calculateCorrelations(biometricData: any[], promptData: any[]): CognitiveCorrelationAnalysis['correlations'] {
    // Simplified correlation calculations (would use proper statistical methods in production)
    const heartRates = biometricData.map(d => d.metadata.heartRate || 70);
    const attentionLevels = biometricData.map(d => d.metadata.attentionLevel || 75);
    const stressLevels = biometricData.map(d => d.metadata.stressLevel || 30);
    const cognitiveComplexity = promptData.map(d => d.metadata.cognitiveComplexity || 50);

    return {
      heartRateVsAttention: this.pearsonCorrelation(heartRates, attentionLevels),
      stressVsPerformance: this.pearsonCorrelation(stressLevels, cognitiveComplexity),
      hrvVsCognition: this.pearsonCorrelation(
        biometricData.map(d => d.metadata.hrv || 35),
        attentionLevels
      ),
      circadianVsEfficiency: this.calculateCircadianCorrelation(biometricData, promptData)
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate circadian rhythm correlation with performance
   */
  private calculateCircadianCorrelation(biometricData: any[], promptData: any[]): number {
    // Analyze performance patterns by time of day
    const hourlyPerformance = new Map<number, number[]>();

    promptData.forEach(item => {
      const hour = new Date(item.metadata.timestamp).getHours();
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, []);
      }
      hourlyPerformance.get(hour)!.push(item.metadata.cognitiveComplexity || 50);
    });

    // Calculate variance in performance across hours
    const hourlyAverages = Array.from(hourlyPerformance.entries())
      .map(([hour, scores]) => ({
        hour,
        average: scores.reduce((a, b) => a + b, 0) / scores.length
      }));

    if (hourlyAverages.length < 3) return 0;

    const scores = hourlyAverages.map(h => h.average);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    // Higher variance indicates stronger circadian influence
    return Math.min(variance / 100, 1); // Normalize to 0-1
  }

  /**
   * Generate AI-powered insights from correlation data
   */
  private generateInsights(
    correlations: CognitiveCorrelationAnalysis['correlations'],
    biometricData: any[],
    promptData: any[]
  ): string[] {
    const insights: string[] = [];

    if (correlations.heartRateVsAttention > 0.7) {
      insights.push('Strong positive correlation between heart rate and attention levels detected');
    } else if (correlations.heartRateVsAttention < -0.7) {
      insights.push('High heart rate appears to negatively impact attention and focus');
    }

    if (correlations.stressVsPerformance < -0.5) {
      insights.push('Elevated stress levels significantly reduce cognitive performance');
    }

    if (correlations.hrvVsCognition > 0.6) {
      insights.push('Higher heart rate variability correlates with improved cognitive function');
    }

    if (correlations.circadianVsEfficiency > 0.4) {
      insights.push('Clear circadian rhythm patterns detected in cognitive performance');
    }

    // Analyze patterns in recent data
    const recentData = biometricData.filter(d => 
      Date.now() - d.metadata.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    if (recentData.length > 10) {
      const avgStress = recentData.reduce((sum, d) => sum + (d.metadata.stressLevel || 30), 0) / recentData.length;
      if (avgStress > 70) {
        insights.push('Consistently elevated stress levels detected in recent sessions');
      }
    }

    return insights;
  }

  /**
   * Generate personalized recommendations based on analysis
   */
  private generateRecommendations(
    correlations: CognitiveCorrelationAnalysis['correlations'],
    insights: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (correlations.stressVsPerformance < -0.5) {
      recommendations.push('Consider stress-reduction techniques before AI sessions');
      recommendations.push('Implement breathing exercises between complex prompts');
    }

    if (correlations.circadianVsEfficiency > 0.4) {
      recommendations.push('Schedule demanding AI tasks during your peak cognitive hours');
    }

    if (correlations.hrvVsCognition > 0.6) {
      recommendations.push('Use HRV biofeedback to optimize cognitive state before sessions');
    }

    if (insights.some(i => i.includes('heart rate') && i.includes('attention'))) {
      recommendations.push('Monitor heart rate during sessions for optimal attention levels');
    }

    // Default recommendations
    recommendations.push('Maintain consistent sleep schedule for stable biometric baselines');
    recommendations.push('Take breaks every 45 minutes during extended AI interaction sessions');

    return recommendations;
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(userId?: number, timeRange?: {
    start: number;
    end: number;
  }): Promise<PerformanceMetrics> {
    try {
      const searchQuery = userId ? `user:${userId}` : 'performance metrics';
      
      const sessionData = await vectorDatabase.semanticSearch(searchQuery, {
        contentTypes: ['prompt', 'response'],
        userId,
        limit: 500
      });

      const biometricData = await vectorDatabase.semanticSearch(searchQuery, {
        contentTypes: ['biometric'],
        userId,
        limit: 500
      });

      // Calculate metrics
      const totalSessions = new Set(sessionData.map(d => d.metadata.sessionId)).size;
      
      const responseTimes = sessionData
        .filter(d => d.metadata.responseTime)
        .map(d => d.metadata.responseTime);
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      const cognitiveLoads = biometricData
        .filter(d => d.metadata.cognitiveLoad)
        .map(d => d.metadata.cognitiveLoad);
      
      const hrvValues = biometricData
        .filter(d => d.metadata.hrv)
        .map(d => d.metadata.hrv);
      const biometricStability = hrvValues.length > 0
        ? 1 - (this.calculateStandardDeviation(hrvValues) / this.calculateMean(hrvValues))
        : 0;

      return {
        totalSessions,
        averageResponseTime,
        cognitiveLoadTrends: cognitiveLoads.slice(-20), // Last 20 readings
        biometricStability: Math.max(0, Math.min(1, biometricStability)),
        aiAdaptationEffectiveness: this.calculateAdaptationEffectiveness(sessionData)
      };

    } catch (error) {
      console.error('Performance metrics calculation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate AI adaptation effectiveness
   */
  private calculateAdaptationEffectiveness(sessionData: any[]): number {
    if (sessionData.length < 10) return 0.5; // Not enough data

    // Analyze improvement in cognitive complexity scores over time
    const sortedSessions = sessionData
      .filter(d => d.metadata.cognitiveComplexity && d.metadata.timestamp)
      .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    if (sortedSessions.length < 5) return 0.5;

    const firstHalf = sortedSessions.slice(0, Math.floor(sortedSessions.length / 2));
    const secondHalf = sortedSessions.slice(Math.floor(sortedSessions.length / 2));

    const firstHalfAvg = this.calculateMean(firstHalf.map(s => s.metadata.cognitiveComplexity));
    const secondHalfAvg = this.calculateMean(secondHalf.map(s => s.metadata.cognitiveComplexity));

    // Effectiveness is based on improvement in cognitive performance
    const improvement = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    return Math.max(0, Math.min(1, 0.5 + improvement));
  }

  /**
   * Utility methods
   */
  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.processEventBuffer(); // Process remaining events
  }
}

export const analyticsService = new TelemetryAnalyticsService();