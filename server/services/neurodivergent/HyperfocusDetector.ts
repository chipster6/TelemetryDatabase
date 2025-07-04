import { BiometricDataPoint } from '../BiometricPipelineService';

export interface HyperfocusPattern {
  startTime: number;
  endTime: number;
  duration: number;
  avgAttention: number;
  avgCognitiveLoad: number;
  productivity: number;
  trigger: string;
  context: string;
  recoveryTime: number;
  qualityScore: number;
}

export interface HyperfocusConfig {
  threshold: number; // Minimum duration for hyperfocus in ms
  highAttentionThreshold: number;
  detectionScoreThreshold: number;
  recoveryAnalysisWindow: number;
}

export class HyperfocusDetector {
  private config: HyperfocusConfig;

  constructor(config: Partial<HyperfocusConfig> = {}) {
    this.config = {
      threshold: 15 * 60 * 1000, // 15 minutes
      highAttentionThreshold: 80,
      detectionScoreThreshold: 6,
      recoveryAnalysisWindow: 30 * 60 * 1000, // 30 minutes
      ...config
    };
  }

  /**
   * Detect hyperfocus episodes with enhanced analysis
   */
  async detectHyperfocusPatterns(stream: BiometricDataPoint[]): Promise<HyperfocusPattern[]> {
    const patterns: HyperfocusPattern[] = [];
    let currentWindow: Partial<HyperfocusPattern> | null = null;
    let windowData: BiometricDataPoint[] = [];
    
    for (let i = 0; i < stream.length; i++) {
      const point = stream[i];
      
      // Enhanced hyperfocus detection criteria
      const isHyperfocused = this.isHyperfocusState(point, stream, i);
      
      if (isHyperfocused) {
        if (!currentWindow) {
          // Start new hyperfocus window
          currentWindow = {
            startTime: point.timestamp,
            endTime: point.timestamp,
            context: point.contextId || 'unknown'
          };
          windowData = [point];
        } else {
          // Extend current window
          currentWindow.endTime = point.timestamp;
          windowData.push(point);
        }
      } else if (currentWindow) {
        // End of hyperfocus - analyze the window
        const duration = currentWindow.endTime! - currentWindow.startTime!;
        
        if (duration >= this.config.threshold) {
          const pattern = this.analyzeHyperfocusWindow(currentWindow, windowData, stream, i);
          patterns.push(pattern);
        }
        
        currentWindow = null;
        windowData = [];
      }
    }
    
    // Handle ongoing hyperfocus at end of stream
    if (currentWindow) {
      const duration = currentWindow.endTime! - currentWindow.startTime!;
      if (duration >= this.config.threshold) {
        const pattern = this.analyzeHyperfocusWindow(currentWindow, windowData, stream, stream.length - 1);
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Enhanced hyperfocus state detection
   */
  private isHyperfocusState(
    point: BiometricDataPoint,
    stream: BiometricDataPoint[],
    index: number
  ): boolean {
    // Primary indicators
    const highAttention = point.attentionLevel > this.config.highAttentionThreshold;
    const moderateCognitiveLoad = point.cognitiveLoad > 60 && point.cognitiveLoad < 95;
    const lowStress = point.stressLevel < 60;
    
    // Secondary indicators (context-aware)
    const stableHeartRate = this.isHeartRateStable(stream, index, 5);
    const lowHRVVariability = (point.hrvVariability || 0) < 15;
    const sustainedContext = this.isSustainedContext(stream, index, 10);
    
    // Advanced indicators
    const timeDistortion = this.detectTimeDistortion(stream, index);
    const reducedSensoryResponsiveness = this.detectReducedSensoryResponse(stream, index);
    
    // Weighted scoring
    let score = 0;
    if (highAttention) score += 3;
    if (moderateCognitiveLoad) score += 2;
    if (lowStress) score += 1;
    if (stableHeartRate) score += 1;
    if (lowHRVVariability) score += 1;
    if (sustainedContext) score += 2;
    if (timeDistortion) score += 1;
    if (reducedSensoryResponsiveness) score += 1;
    
    return score >= this.config.detectionScoreThreshold;
  }

  /**
   * Analyze hyperfocus window characteristics
   */
  private analyzeHyperfocusWindow(
    window: Partial<HyperfocusPattern>,
    windowData: BiometricDataPoint[],
    fullStream: BiometricDataPoint[],
    endIndex: number
  ): HyperfocusPattern {
    const duration = window.endTime! - window.startTime!;
    const avgAttention = windowData.reduce((sum, d) => sum + d.attentionLevel, 0) / windowData.length;
    const avgCognitiveLoad = windowData.reduce((sum, d) => sum + d.cognitiveLoad, 0) / windowData.length;
    
    // Calculate productivity during hyperfocus
    const productivity = this.calculateProductivity(windowData);
    
    // Identify trigger
    const trigger = this.identifyHyperfocusTrigger(fullStream, windowData[0], endIndex);
    
    // Calculate recovery time
    const recoveryTime = this.calculateRecoveryTime(fullStream, endIndex);
    
    // Quality score based on multiple factors
    const qualityScore = this.calculateQualityScore(windowData, productivity, duration);
    
    return {
      startTime: window.startTime!,
      endTime: window.endTime!,
      duration,
      avgAttention,
      avgCognitiveLoad,
      productivity,
      trigger,
      context: window.context!,
      recoveryTime,
      qualityScore
    };
  }

  /**
   * Check if heart rate is stable within a window
   */
  private isHeartRateStable(stream: BiometricDataPoint[], index: number, windowSize: number): boolean {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(stream.length - 1, index + windowSize);
    
    const hrValues = stream.slice(start, end + 1).map(p => p.heartRate);
    if (hrValues.length < 2) return false;
    
    const mean = hrValues.reduce((sum, hr) => sum + hr, 0) / hrValues.length;
    const variance = hrValues.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / hrValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Stable if standard deviation is less than 10% of mean
    return stdDev < (mean * 0.1);
  }

  /**
   * Check if context has been sustained
   */
  private isSustainedContext(stream: BiometricDataPoint[], index: number, lookback: number): boolean {
    if (index < lookback) return false;
    
    const currentContext = stream[index].contextId;
    if (!currentContext) return false;
    
    for (let i = index - lookback; i < index; i++) {
      if (stream[i].contextId !== currentContext) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Detect time distortion patterns
   */
  private detectTimeDistortion(stream: BiometricDataPoint[], index: number): boolean {
    // Look for patterns indicating time distortion
    // This is a simplified heuristic - would be enhanced with actual time perception data
    const lookback = Math.min(10, index);
    if (lookback < 5) return false;
    
    const recentPoints = stream.slice(index - lookback, index + 1);
    const avgCognitive = recentPoints.reduce((sum, p) => sum + p.cognitiveLoad, 0) / recentPoints.length;
    const avgAttention = recentPoints.reduce((sum, p) => sum + p.attentionLevel, 0) / recentPoints.length;
    
    // High cognitive load + high attention often correlates with time distortion
    return avgCognitive > 75 && avgAttention > 85;
  }

  /**
   * Detect reduced sensory responsiveness
   */
  private detectReducedSensoryResponse(stream: BiometricDataPoint[], index: number): boolean {
    // Simplified heuristic for reduced sensory responsiveness
    const current = stream[index];
    const lookback = Math.min(5, index);
    
    if (lookback < 3) return false;
    
    const recentPoints = stream.slice(index - lookback, index);
    const avgArousal = recentPoints.reduce((sum, p) => sum + (p.arousal || 0), 0) / recentPoints.length;
    
    // Lower arousal compared to attention level might indicate reduced sensory response
    return current.attentionLevel > 80 && avgArousal < 40;
  }

  /**
   * Calculate productivity score during hyperfocus
   */
  private calculateProductivity(windowData: BiometricDataPoint[]): number {
    if (windowData.length === 0) return 0;
    
    // Productivity based on sustained high attention and moderate cognitive load
    const avgAttention = windowData.reduce((sum, d) => sum + d.attentionLevel, 0) / windowData.length;
    const avgCognitive = windowData.reduce((sum, d) => sum + d.cognitiveLoad, 0) / windowData.length;
    const consistency = this.calculateConsistency(windowData.map(d => d.attentionLevel));
    
    // Weighted productivity score
    return (avgAttention * 0.4 + avgCognitive * 0.3 + consistency * 0.3);
  }

  /**
   * Calculate consistency of values (lower variance = higher consistency)
   */
  private calculateConsistency(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-100)
    const coefficientOfVariation = stdDev / mean;
    return Math.max(0, 100 - (coefficientOfVariation * 100));
  }

  /**
   * Identify what triggered the hyperfocus episode
   */
  private identifyHyperfocusTrigger(
    fullStream: BiometricDataPoint[],
    hyperfocusStart: BiometricDataPoint,
    endIndex: number
  ): string {
    // Look at the 15 minutes before hyperfocus started
    const triggerWindow = 15 * 60 * 1000; // 15 minutes
    const startTime = hyperfocusStart.timestamp - triggerWindow;
    
    const preHyperfocusData = fullStream.filter(p => 
      p.timestamp >= startTime && p.timestamp < hyperfocusStart.timestamp
    );
    
    if (preHyperfocusData.length === 0) return 'unknown';
    
    // Analyze patterns in pre-hyperfocus period
    const contexts = preHyperfocusData.map(p => p.contextId).filter(Boolean);
    const mostCommonContext = this.getMostFrequent(contexts);
    
    // Look for stress or attention spikes that might have triggered hyperfocus
    const hasStressSpike = preHyperfocusData.some(p => p.stressLevel > 70);
    const hasAttentionDrop = preHyperfocusData.some(p => p.attentionLevel < 40);
    
    if (hasStressSpike) return 'stress_response';
    if (hasAttentionDrop) return 'attention_recovery';
    if (mostCommonContext) return `context_${mostCommonContext}`;
    
    return 'gradual_buildup';
  }

  /**
   * Calculate recovery time after hyperfocus
   */
  private calculateRecoveryTime(fullStream: BiometricDataPoint[], hyperfocusEndIndex: number): number {
    const recoveryWindow = this.config.recoveryAnalysisWindow;
    const baselineThreshold = 60; // Baseline attention level
    
    let recoveryTime = 0;
    
    for (let i = hyperfocusEndIndex + 1; i < fullStream.length; i++) {
      const point = fullStream[i];
      const timeSinceEnd = point.timestamp - fullStream[hyperfocusEndIndex].timestamp;
      
      if (timeSinceEnd > recoveryWindow) break;
      
      if (point.attentionLevel >= baselineThreshold && point.stressLevel < 50) {
        recoveryTime = timeSinceEnd;
        break;
      }
    }
    
    return recoveryTime;
  }

  /**
   * Calculate overall quality score for hyperfocus episode
   */
  private calculateQualityScore(
    windowData: BiometricDataPoint[],
    productivity: number,
    duration: number
  ): number {
    if (windowData.length === 0) return 0;
    
    // Factor in duration (longer episodes get higher scores up to a point)
    const durationScore = Math.min(100, (duration / (2 * 60 * 60 * 1000)) * 100); // 2 hours = 100%
    
    // Factor in stress levels (lower stress = higher quality)
    const avgStress = windowData.reduce((sum, d) => sum + d.stressLevel, 0) / windowData.length;
    const stressScore = Math.max(0, 100 - avgStress);
    
    // Factor in HRV stability (more stable = higher quality)
    const hrvValues = windowData.map(d => d.hrvVariability || 0);
    const hrvStability = this.calculateConsistency(hrvValues);
    
    // Weighted quality score
    return (
      productivity * 0.4 +
      durationScore * 0.25 +
      stressScore * 0.2 +
      hrvStability * 0.15
    );
  }

  /**
   * Get most frequently occurring item in array
   */
  private getMostFrequent<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    
    const frequency: Map<T, number> = new Map();
    
    for (const item of arr) {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    }
    
    let maxCount = 0;
    let mostFrequent: T | null = null;
    
    for (const [item, count] of frequency.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    }
    
    return mostFrequent;
  }

  /**
   * Get hyperfocus statistics for a user
   */
  getHyperfocusStatistics(patterns: HyperfocusPattern[]): {
    totalEpisodes: number;
    averageDuration: number;
    averageQuality: number;
    averageProductivity: number;
    averageRecoveryTime: number;
    mostCommonTrigger: string;
    bestPerformanceTimeOfDay: string;
  } {
    if (patterns.length === 0) {
      return {
        totalEpisodes: 0,
        averageDuration: 0,
        averageQuality: 0,
        averageProductivity: 0,
        averageRecoveryTime: 0,
        mostCommonTrigger: 'none',
        bestPerformanceTimeOfDay: 'unknown'
      };
    }

    const totalEpisodes = patterns.length;
    const averageDuration = patterns.reduce((sum, p) => sum + p.duration, 0) / totalEpisodes;
    const averageQuality = patterns.reduce((sum, p) => sum + p.qualityScore, 0) / totalEpisodes;
    const averageProductivity = patterns.reduce((sum, p) => sum + p.productivity, 0) / totalEpisodes;
    const averageRecoveryTime = patterns.reduce((sum, p) => sum + p.recoveryTime, 0) / totalEpisodes;

    const triggers = patterns.map(p => p.trigger);
    const mostCommonTrigger = this.getMostFrequent(triggers) || 'unknown';

    // Analyze time of day patterns
    const timeOfDayScores: Map<number, number[]> = new Map();
    patterns.forEach(p => {
      const hour = new Date(p.startTime).getHours();
      if (!timeOfDayScores.has(hour)) {
        timeOfDayScores.set(hour, []);
      }
      timeOfDayScores.get(hour)!.push(p.qualityScore);
    });

    let bestHour = 0;
    let bestScore = 0;
    for (const [hour, scores] of timeOfDayScores.entries()) {
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestHour = hour;
      }
    }

    const bestPerformanceTimeOfDay = `${bestHour.toString().padStart(2, '0')}:00`;

    return {
      totalEpisodes,
      averageDuration,
      averageQuality,
      averageProductivity,
      averageRecoveryTime,
      mostCommonTrigger,
      bestPerformanceTimeOfDay
    };
  }
}