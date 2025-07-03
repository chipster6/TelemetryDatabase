// Enhanced Neurodivergent Analytics Service
// Specialized pattern detection for ADHD, autism, and other neurodivergent profiles

import { WeaviateClient } from 'weaviate-ts-client';
import Redis from 'redis';
import { EventEmitter } from 'events';
import { BiometricDataPoint } from './BiometricPipelineService';

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

export interface ContextSwitchingPattern {
  switchCount: number;
  hourlyRate: number;
  avgTimeBetweenSwitches: number;
  pattern: 'high' | 'normal' | 'low' | 'chaotic';
  optimalSwitchingWindows: number[];
  switchingEfficiency: number;
  cognitiveeCost: number;
}

export interface SensoryProcessingPattern {
  overloadEvents: number;
  avgRecoveryTime: number;
  triggerThresholds: {
    sound: number;
    light: number;
    temperature: number;
    motion: number;
  };
  adaptationStrategies: string[];
  sensorySeekingBehaviors: string[];
  processingSensitivity: number;
}

export interface ExecutiveFunctionPattern {
  avgCognitiveLoad: number;
  peakLoadDuration: number;
  taskCompletionRate: number;
  workingMemoryLoad: number;
  planningEfficiency: number;
  inhibitionControl: number;
  cognitiveFlexibility: number;
  processingSpeed: number;
}

export interface AttentionPattern {
  avgAttention: number;
  variability: number;
  sustainedAttentionDuration: number;
  distractibilityScore: number;
  optimalAttentionPeriods: number[];
  attentionCycles: AttentionCycle[];
  vigilanceDecrement: number;
}

export interface AttentionCycle {
  peakTime: number;
  duration: number;
  intensity: number;
  efficiency: number;
}

export interface StimulationPattern {
  stimSeekingBehavior: number;
  stimAvoidanceBehavior: number;
  optimalStimulationLevel: number;
  stimRegulationStrategies: string[];
  sensoryPreferences: string[];
  alertnessCorrelation: number;
}

export interface TimePerceptionPattern {
  timeEstimationAccuracy: number;
  hyperfocusTimeDistortion: number;
  taskDurationPrediction: number;
  timeBlindnessEvents: number;
  temporalProcessingDelay: number;
  circadianAlignmentScore: number;
}

export interface EnergyPattern {
  energyLevels: number[];
  peakEnergyWindows: number[];
  energyDepletionRate: number;
  recoveryPatterns: string[];
  spoonTheoryScore: number;
  burnoutRiskFactors: string[];
}

// ==================== Neurodivergent Analytics Service ====================

export class NeurodivergentAnalyticsService extends EventEmitter {
  private patternCache: Map<string, NDPatterns> = new Map();
  private analysisWindow: number = 24 * 60 * 60 * 1000; // 24 hours
  private hyperfocusThreshold: number = 15 * 60 * 1000; // 15 minutes
  private highAttentionThreshold: number = 80;
  private contextSwitchThreshold: number = 10; // switches per hour
  
  constructor(
    private weaviate: WeaviateClient,
    private redis: Redis.RedisClientType
  ) {
    super();
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
      
      // Analyze patterns
      const patterns: NDPatterns = {
        hyperfocus: await this.detectHyperfocusPatterns(biometricStream),
        contextSwitching: await this.analyzeContextSwitching(biometricStream),
        sensoryProcessing: await this.evaluateSensoryProcessing(biometricStream),
        executiveFunction: await this.assessExecutiveFunction(biometricStream),
        attentionVariability: await this.analyzeAttentionPatterns(biometricStream),
        stimRegulation: await this.analyzeStimulationPatterns(biometricStream),
        timePerception: await this.analyzeTimePerception(biometricStream),
        energyManagement: await this.analyzeEnergyPatterns(biometricStream),
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
   * Detect hyperfocus episodes with enhanced analysis
   */
  private async detectHyperfocusPatterns(stream: BiometricDataPoint[]): Promise<HyperfocusPattern[]> {
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
        
        if (duration >= this.hyperfocusThreshold) {
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
      if (duration >= this.hyperfocusThreshold) {
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
    const highAttention = point.attentionLevel > this.highAttentionThreshold;
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
    
    return score >= 6; // Threshold for hyperfocus detection
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
    
    return {
      startTime: window.startTime!,
      endTime: window.endTime!,
      duration,
      avgAttention,
      avgCognitiveLoad,
      productivity: this.calculateHyperfocusProductivity(windowData),
      trigger: this.identifyHyperfocusTrigger(fullStream, windowData[0], endIndex),
      context: window.context!,
      recoveryTime: this.calculateRecoveryTime(fullStream, endIndex),
      qualityScore: this.calculateHyperfocusQuality(windowData)
    };
  }
  
  /**
   * Analyze context switching patterns with ADHD-specific insights
   */
  private async analyzeContextSwitching(stream: BiometricDataPoint[]): Promise<ContextSwitchingPattern> {
    const switches: { timestamp: number; fromContext: string; toContext: string; cost: number }[] = [];
    let lastContext = stream[0]?.contextId || '';
    
    for (let i = 1; i < stream.length; i++) {
      const currentContext = stream[i].contextId || '';
      
      if (currentContext !== lastContext && currentContext !== '') {
        const switchCost = this.calculateSwitchingCost(stream, i);
        switches.push({
          timestamp: stream[i].timestamp,
          fromContext: lastContext,
          toContext: currentContext,
          cost: switchCost
        });
        lastContext = currentContext;
      }
    }
    
    const timeSpanHours = (stream[stream.length - 1]?.timestamp - stream[0]?.timestamp) / (1000 * 60 * 60);
    const hourlyRate = switches.length / Math.max(timeSpanHours, 1);
    
    return {
      switchCount: switches.length,
      hourlyRate,
      avgTimeBetweenSwitches: this.calculateAvgTimeBetween(switches.map(s => s.timestamp)),
      pattern: this.classifySwitchingPattern(hourlyRate, switches),
      optimalSwitchingWindows: this.findOptimalSwitchingWindows(stream, switches),
      switchingEfficiency: this.calculateSwitchingEfficiency(switches, stream),
      cognitiveeCost: switches.reduce((sum, s) => sum + s.cost, 0) / switches.length
    };
  }
  
  /**
   * Evaluate sensory processing patterns
   */
  private async evaluateSensoryProcessing(stream: BiometricDataPoint[]): Promise<SensoryProcessingPattern> {
    const overloadEvents = this.detectSensoryOverloadEvents(stream);
    const thresholds = this.calculateSensoryThresholds(stream);
    
    return {
      overloadEvents: overloadEvents.length,
      avgRecoveryTime: this.calculateSensoryRecoveryTime(overloadEvents, stream),
      triggerThresholds: thresholds,
      adaptationStrategies: this.identifyAdaptationStrategies(stream),
      sensorySeekingBehaviors: this.identifySensorySeekingBehaviors(stream),
      processingSensitivity: this.calculateProcessingSensitivity(stream)
    };
  }
  
  /**
   * Assess executive function patterns
   */
  private async assessExecutiveFunction(stream: BiometricDataPoint[]): Promise<ExecutiveFunctionPattern> {
    const cognitiveLoads = stream.map(d => d.cognitiveLoad);
    const avgCognitiveLoad = cognitiveLoads.reduce((a, b) => a + b, 0) / cognitiveLoads.length;
    
    return {
      avgCognitiveLoad,
      peakLoadDuration: this.calculatePeakLoadDuration(stream),
      taskCompletionRate: this.estimateTaskCompletionRate(stream),
      workingMemoryLoad: this.assessWorkingMemoryLoad(stream),
      planningEfficiency: this.assessPlanningEfficiency(stream),
      inhibitionControl: this.assessInhibitionControl(stream),
      cognitiveFlexibility: this.assessCognitiveFlexibility(stream),
      processingSpeed: this.assessProcessingSpeed(stream)
    };
  }
  
  /**
   * Analyze attention patterns with detailed cycling
   */
  private async analyzeAttentionPatterns(stream: BiometricDataPoint[]): Promise<AttentionPattern> {
    const attentionValues = stream.map(d => d.attentionLevel);
    const cycles = this.detectAttentionCycles(stream);
    
    return {
      avgAttention: attentionValues.reduce((a, b) => a + b, 0) / attentionValues.length,
      variability: this.calculateStandardDeviation(attentionValues),
      sustainedAttentionDuration: this.findLongestSustainedAttention(stream),
      distractibilityScore: this.calculateDistractibilityScore(stream),
      optimalAttentionPeriods: this.findOptimalAttentionPeriods(stream),
      attentionCycles: cycles,
      vigilanceDecrement: this.calculateVigilanceDecrement(stream)
    };
  }
  
  /**
   * Analyze stimulation regulation patterns
   */
  private async analyzeStimulationPatterns(stream: BiometricDataPoint[]): Promise<StimulationPattern> {
    return {
      stimSeekingBehavior: this.detectStimSeekingBehavior(stream),
      stimAvoidanceBehavior: this.detectStimAvoidanceBehavior(stream),
      optimalStimulationLevel: this.calculateOptimalStimulation(stream),
      stimRegulationStrategies: this.identifyStimRegulationStrategies(stream),
      sensoryPreferences: this.identifySensoryPreferences(stream),
      alertnessCorrelation: this.calculateAlertnessCorrelation(stream)
    };
  }
  
  /**
   * Analyze time perception patterns
   */
  private async analyzeTimePerception(stream: BiometricDataPoint[]): Promise<TimePerceptionPattern> {
    return {
      timeEstimationAccuracy: this.assessTimeEstimationAccuracy(stream),
      hyperfocusTimeDistortion: this.measureHyperfocusTimeDistortion(stream),
      taskDurationPrediction: this.assessTaskDurationPrediction(stream),
      timeBlindnessEvents: this.countTimeBlindnessEvents(stream),
      temporalProcessingDelay: this.measureTemporalProcessingDelay(stream),
      circadianAlignmentScore: this.calculateCircadianAlignment(stream)
    };
  }
  
  /**
   * Analyze energy management patterns
   */
  private async analyzeEnergyPatterns(stream: BiometricDataPoint[]): Promise<EnergyPattern> {
    const energyLevels = this.calculateEnergyLevels(stream);
    
    return {
      energyLevels,
      peakEnergyWindows: this.findPeakEnergyWindows(energyLevels, stream),
      energyDepletionRate: this.calculateEnergyDepletionRate(energyLevels),
      recoveryPatterns: this.identifyRecoveryPatterns(stream),
      spoonTheoryScore: this.calculateSpoonTheoryScore(stream),
      burnoutRiskFactors: this.identifyBurnoutRiskFactors(stream)
    };
  }
  
  // ==================== Helper Methods ====================
  
  private isHeartRateStable(stream: BiometricDataPoint[], index: number, windowSize: number): boolean {
    const start = Math.max(0, index - windowSize);
    const window = stream.slice(start, index + 1);
    
    if (window.length < 2) return true;
    
    const heartRates = window.map(d => d.heartRate);
    const variance = this.calculateVariance(heartRates);
    
    return variance < 25; // Low variance indicates stability
  }
  
  private isSustainedContext(stream: BiometricDataPoint[], index: number, windowSize: number): boolean {
    const start = Math.max(0, index - windowSize);
    const window = stream.slice(start, index + 1);
    
    const currentContext = stream[index].contextId;
    if (!currentContext) return false;
    
    const sameContextCount = window.filter(d => d.contextId === currentContext).length;
    return sameContextCount / window.length > 0.8; // 80% same context
  }
  
  private detectTimeDistortion(stream: BiometricDataPoint[], index: number): boolean {
    // Placeholder for time distortion detection
    // Would analyze task completion estimates vs actual time
    return false;
  }
  
  private detectReducedSensoryResponse(stream: BiometricDataPoint[], index: number): boolean {
    // Placeholder for reduced sensory responsiveness detection
    // Would analyze responses to environmental changes
    return false;
  }
  
  private calculateHyperfocusProductivity(windowData: BiometricDataPoint[]): number {
    // Calculate productivity based on sustained attention and appropriate cognitive load
    const avgAttention = windowData.reduce((sum, d) => sum + d.attentionLevel, 0) / windowData.length;
    const avgCognitiveLoad = windowData.reduce((sum, d) => sum + d.cognitiveLoad, 0) / windowData.length;
    const duration = (windowData[windowData.length - 1].timestamp - windowData[0].timestamp) / (1000 * 60 * 60);
    
    const attentionScore = avgAttention / 100;
    const loadScore = Math.max(0, 1 - Math.abs(avgCognitiveLoad - 75) / 25); // Optimal around 75%
    const durationScore = Math.min(1, duration / 2); // Optimal around 2 hours
    
    return (attentionScore * 0.4 + loadScore * 0.4 + durationScore * 0.2) * 100;
  }
  
  private identifyHyperfocusTrigger(
    fullStream: BiometricDataPoint[],
    startPoint: BiometricDataPoint,
    endIndex: number
  ): string {
    // Analyze patterns preceding hyperfocus
    const lookbackWindow = 10;
    const startIdx = fullStream.findIndex(d => d.timestamp === startPoint.timestamp);
    const precedingData = fullStream.slice(Math.max(0, startIdx - lookbackWindow), startIdx);
    
    if (precedingData.length === 0) return 'unknown';
    
    // Analyze triggers
    const avgStressBefore = precedingData.reduce((sum, d) => sum + d.stressLevel, 0) / precedingData.length;
    const taskSwitch = precedingData[precedingData.length - 1]?.contextId !== startPoint.contextId;
    const lowAttentionBefore = precedingData[precedingData.length - 1]?.attentionLevel < 50;
    
    if (taskSwitch && startPoint.attentionLevel > 80) return 'task_engagement';
    if (lowAttentionBefore && startPoint.attentionLevel > 80) return 'attention_restoration';
    if (avgStressBefore > 60 && startPoint.stressLevel < 40) return 'stress_relief_focus';
    
    return 'intrinsic_interest';
  }
  
  private calculateRecoveryTime(fullStream: BiometricDataPoint[], endIndex: number): number {
    // Calculate time to return to baseline after hyperfocus
    if (endIndex >= fullStream.length - 1) return 0;
    
    const baselineAttention = 60; // Assumed baseline
    let recoveryIndex = endIndex + 1;
    
    while (recoveryIndex < fullStream.length) {
      if (fullStream[recoveryIndex].attentionLevel <= baselineAttention) {
        return fullStream[recoveryIndex].timestamp - fullStream[endIndex].timestamp;
      }
      recoveryIndex++;
    }
    
    return 0; // No recovery period found
  }
  
  private calculateHyperfocusQuality(windowData: BiometricDataPoint[]): number {
    // Quality based on consistency and depth of focus
    const attentionValues = windowData.map(d => d.attentionLevel);
    const attentionStability = 1 - (this.calculateStandardDeviation(attentionValues) / 100);
    const avgAttention = attentionValues.reduce((a, b) => a + b, 0) / attentionValues.length;
    const depthScore = Math.min(1, avgAttention / 90); // Depth of focus
    
    return (attentionStability * 0.6 + depthScore * 0.4) * 100;
  }
  
  private calculateSwitchingCost(stream: BiometricDataPoint[], switchIndex: number): number {
    // Calculate cognitive cost of context switch
    const before = stream[switchIndex - 1];
    const after = stream[switchIndex];
    
    const attentionDrop = Math.max(0, before.attentionLevel - after.attentionLevel);
    const cognitiveIncrease = Math.max(0, after.cognitiveLoad - before.cognitiveLoad);
    const stressIncrease = Math.max(0, after.stressLevel - before.stressLevel);
    
    return (attentionDrop * 0.4 + cognitiveIncrease * 0.3 + stressIncrease * 0.3);
  }
  
  private calculateAvgTimeBetween(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;
    
    let totalTime = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalTime += timestamps[i] - timestamps[i - 1];
    }
    
    return totalTime / (timestamps.length - 1);
  }
  
  private classifySwitchingPattern(
    hourlyRate: number,
    switches: any[]
  ): 'high' | 'normal' | 'low' | 'chaotic' {
    if (hourlyRate > 20) return 'chaotic';
    if (hourlyRate > 10) return 'high';
    if (hourlyRate > 3) return 'normal';
    return 'low';
  }
  
  private findOptimalSwitchingWindows(
    stream: BiometricDataPoint[],
    switches: any[]
  ): number[] {
    // Find time periods where switching is most successful
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
  
  private calculateSwitchingEfficiency(switches: any[], stream: BiometricDataPoint[]): number {
    if (switches.length === 0) return 100;
    
    const avgCost = switches.reduce((sum, s) => sum + s.cost, 0) / switches.length;
    return Math.max(0, 100 - avgCost);
  }
  
  private detectSensoryOverloadEvents(stream: BiometricDataPoint[]): any[] {
    const events = [];
    
    for (let i = 0; i < stream.length; i++) {
      const point = stream[i];
      
      // Sensory overload indicators
      const highStress = point.stressLevel > 80;
      const lowAttention = point.attentionLevel < 30;
      const highCognitiveLoad = point.cognitiveLoad > 90;
      const environmentalFactors = (point.environmentalSound || 0) > 70 || 
                                  (point.lightLevel || 0) > 1000;
      
      if (highStress && lowAttention && (highCognitiveLoad || environmentalFactors)) {
        events.push({
          timestamp: point.timestamp,
          severity: this.calculateOverloadSeverity(point),
          triggers: this.identifyOverloadTriggers(point)
        });
      }
    }
    
    return events;
  }
  
  private calculateSensoryThresholds(stream: BiometricDataPoint[]): any {
    // Calculate thresholds where performance degrades
    return {
      sound: this.findPerformanceThreshold(stream, 'environmentalSound'),
      light: this.findPerformanceThreshold(stream, 'lightLevel'),
      temperature: this.findPerformanceThreshold(stream, 'temperature'),
      motion: 50 // Placeholder
    };
  }
  
  private findPerformanceThreshold(stream: BiometricDataPoint[], metric: string): number {
    // Find the point where performance (attention) starts to degrade
    const dataWithMetric = stream.filter(d => d[metric] !== undefined);
    if (dataWithMetric.length < 10) return 0;
    
    // Sort by metric value and find degradation point
    dataWithMetric.sort((a, b) => a[metric] - b[metric]);
    
    let bestAttention = 0;
    let threshold = 0;
    
    for (let i = 0; i < dataWithMetric.length - 5; i++) {
      const window = dataWithMetric.slice(i, i + 5);
      const avgAttention = window.reduce((sum, d) => sum + d.attentionLevel, 0) / window.length;
      
      if (avgAttention > bestAttention) {
        bestAttention = avgAttention;
        threshold = window[0][metric];
      } else if (avgAttention < bestAttention * 0.9) {
        // Performance degraded by 10%
        break;
      }
    }
    
    return threshold;
  }
  
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
  
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  // Placeholder methods for comprehensive analysis
  private calculateSensoryRecoveryTime(events: any[], stream: BiometricDataPoint[]): number {
    return 300000; // 5 minutes placeholder
  }
  
  private identifyAdaptationStrategies(stream: BiometricDataPoint[]): string[] {
    return ['noise_reduction', 'lighting_adjustment', 'break_scheduling'];
  }
  
  private identifySensorySeekingBehaviors(stream: BiometricDataPoint[]): string[] {
    return ['fidgeting', 'music_seeking', 'movement_breaks'];
  }
  
  private calculateProcessingSensitivity(stream: BiometricDataPoint[]): number {
    return 0.75; // Placeholder sensitivity score
  }
  
  private calculatePeakLoadDuration(stream: BiometricDataPoint[]): number {
    let peakDuration = 0;
    let currentDuration = 0;
    
    for (const point of stream) {
      if (point.cognitiveLoad > 85) {
        currentDuration += 1; // Assuming 1-minute intervals
      } else {
        peakDuration = Math.max(peakDuration, currentDuration);
        currentDuration = 0;
      }
    }
    
    return Math.max(peakDuration, currentDuration);
  }
  
  private estimateTaskCompletionRate(stream: BiometricDataPoint[]): number {
    // Estimate based on sustained attention periods
    const sustainedPeriods = this.findSustainedAttentionPeriods(stream);
    const totalTime = stream.length > 0 ? 
      (stream[stream.length - 1].timestamp - stream[0].timestamp) / (1000 * 60 * 60) : 1;
    
    return sustainedPeriods.length / totalTime; // Tasks per hour
  }
  
  private assessWorkingMemoryLoad(stream: BiometricDataPoint[]): number {
    // Assess based on cognitive load and context switching
    const avgCognitiveLoad = stream.reduce((sum, d) => sum + d.cognitiveLoad, 0) / stream.length;
    const contextSwitches = this.countContextSwitches(stream);
    
    return Math.min(100, avgCognitiveLoad + (contextSwitches * 5));
  }
  
  private assessPlanningEfficiency(stream: BiometricDataPoint[]): number {
    // Assess based on task progression and context stability
    return 75; // Placeholder
  }
  
  private assessInhibitionControl(stream: BiometricDataPoint[]): number {
    // Assess based on impulse responses and distraction resistance
    return 70; // Placeholder
  }
  
  private assessCognitiveFlexibility(stream: BiometricDataPoint[]): number {
    // Assess based on successful context switches and adaptation
    return 80; // Placeholder
  }
  
  private assessProcessingSpeed(stream: BiometricDataPoint[]): number {
    // Assess based on response times and task completion
    return 85; // Placeholder
  }
  
  private detectAttentionCycles(stream: BiometricDataPoint[]): AttentionCycle[] {
    const cycles: AttentionCycle[] = [];
    
    // Detect peaks and cycles in attention data
    const attentionValues = stream.map(d => d.attentionLevel);
    let inPeak = false;
    let peakStart = 0;
    
    for (let i = 1; i < attentionValues.length - 1; i++) {
      const current = attentionValues[i];
      const prev = attentionValues[i - 1];
      const next = attentionValues[i + 1];
      
      // Detect peak start
      if (!inPeak && current > prev && current > 70) {
        inPeak = true;
        peakStart = i;
      }
      
      // Detect peak end
      if (inPeak && current > next && current < 60) {
        const duration = (stream[i].timestamp - stream[peakStart].timestamp);
        const avgIntensity = attentionValues.slice(peakStart, i + 1)
          .reduce((a, b) => a + b, 0) / (i - peakStart + 1);
        
        cycles.push({
          peakTime: stream[peakStart].timestamp,
          duration,
          intensity: avgIntensity,
          efficiency: this.calculateCycleEfficiency(stream.slice(peakStart, i + 1))
        });
        
        inPeak = false;
      }
    }
    
    return cycles;
  }
  
  private calculateCycleEfficiency(cycleData: BiometricDataPoint[]): number {
    const avgAttention = cycleData.reduce((sum, d) => sum + d.attentionLevel, 0) / cycleData.length;
    const avgCognitiveLoad = cycleData.reduce((sum, d) => sum + d.cognitiveLoad, 0) / cycleData.length;
    const stressStability = 1 - (this.calculateStandardDeviation(cycleData.map(d => d.stressLevel)) / 100);
    
    return (avgAttention * 0.4 + avgCognitiveLoad * 0.3 + stressStability * 100 * 0.3) / 100;
  }
  
  private findLongestSustainedAttention(stream: BiometricDataPoint[]): number {
    let longest = 0;
    let current = 0;
    
    for (const point of stream) {
      if (point.attentionLevel > 70) {
        current += 1;
      } else {
        longest = Math.max(longest, current);
        current = 0;
      }
    }
    
    return Math.max(longest, current) * 60000; // Convert to milliseconds
  }
  
  private calculateDistractibilityScore(stream: BiometricDataPoint[]): number {
    const attentionValues = stream.map(d => d.attentionLevel);
    let distractionEvents = 0;
    
    for (let i = 1; i < attentionValues.length; i++) {
      if (attentionValues[i] < attentionValues[i - 1] - 25) {
        distractionEvents++;
      }
    }
    
    return (distractionEvents / attentionValues.length) * 100;
  }
  
  private findOptimalAttentionPeriods(stream: BiometricDataPoint[]): number[] {
    const hourlyAttention: { [hour: number]: number[] } = {};
    
    stream.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      if (!hourlyAttention[hour]) hourlyAttention[hour] = [];
      hourlyAttention[hour].push(point.attentionLevel);
    });
    
    return Object.entries(hourlyAttention)
      .map(([hour, attention]) => ({
        hour: parseInt(hour),
        avgAttention: attention.reduce((a, b) => a + b, 0) / attention.length
      }))
      .sort((a, b) => b.avgAttention - a.avgAttention)
      .slice(0, 3)
      .map(entry => entry.hour);
  }
  
  private calculateVigilanceDecrement(stream: BiometricDataPoint[]): number {
    if (stream.length < 2) return 0;
    
    const firstHalf = stream.slice(0, Math.floor(stream.length / 2));
    const secondHalf = stream.slice(Math.floor(stream.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.attentionLevel, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.attentionLevel, 0) / secondHalf.length;
    
    return Math.max(0, firstHalfAvg - secondHalfAvg);
  }
  
  // Additional placeholder methods for comprehensive implementation
  private detectStimSeekingBehavior(stream: BiometricDataPoint[]): number { return 0.5; }
  private detectStimAvoidanceBehavior(stream: BiometricDataPoint[]): number { return 0.3; }
  private calculateOptimalStimulation(stream: BiometricDataPoint[]): number { return 60; }
  private identifyStimRegulationStrategies(stream: BiometricDataPoint[]): string[] { return ['movement', 'music']; }
  private identifySensoryPreferences(stream: BiometricDataPoint[]): string[] { return ['low_light', 'white_noise']; }
  private calculateAlertnessCorrelation(stream: BiometricDataPoint[]): number { return 0.8; }
  
  private assessTimeEstimationAccuracy(stream: BiometricDataPoint[]): number { return 0.7; }
  private measureHyperfocusTimeDistortion(stream: BiometricDataPoint[]): number { return 1.5; }
  private assessTaskDurationPrediction(stream: BiometricDataPoint[]): number { return 0.6; }
  private countTimeBlindnessEvents(stream: BiometricDataPoint[]): number { return 3; }
  private measureTemporalProcessingDelay(stream: BiometricDataPoint[]): number { return 150; }
  private calculateCircadianAlignment(stream: BiometricDataPoint[]): number { return 0.8; }
  
  private calculateEnergyLevels(stream: BiometricDataPoint[]): number[] {
    return stream.map(d => 100 - d.stressLevel + (d.attentionLevel * 0.5));
  }
  
  private findPeakEnergyWindows(energyLevels: number[], stream: BiometricDataPoint[]): number[] {
    const hourlyEnergy: { [hour: number]: number[] } = {};
    
    stream.forEach((point, index) => {
      const hour = new Date(point.timestamp).getHours();
      if (!hourlyEnergy[hour]) hourlyEnergy[hour] = [];
      hourlyEnergy[hour].push(energyLevels[index]);
    });
    
    return Object.entries(hourlyEnergy)
      .map(([hour, energy]) => ({
        hour: parseInt(hour),
        avgEnergy: energy.reduce((a, b) => a + b, 0) / energy.length
      }))
      .sort((a, b) => b.avgEnergy - a.avgEnergy)
      .slice(0, 3)
      .map(entry => entry.hour);
  }
  
  private calculateEnergyDepletionRate(energyLevels: number[]): number {
    if (energyLevels.length < 2) return 0;
    
    let totalDepletion = 0;
    let depletionCount = 0;
    
    for (let i = 1; i < energyLevels.length; i++) {
      const change = energyLevels[i] - energyLevels[i - 1];
      if (change < 0) {
        totalDepletion += Math.abs(change);
        depletionCount++;
      }
    }
    
    return depletionCount > 0 ? totalDepletion / depletionCount : 0;
  }
  
  private identifyRecoveryPatterns(stream: BiometricDataPoint[]): string[] {
    return ['rest_breaks', 'context_switching', 'physical_movement'];
  }
  
  private calculateSpoonTheoryScore(stream: BiometricDataPoint[]): number {
    // Spoon theory implementation for energy management
    const energyLevels = this.calculateEnergyLevels(stream);
    const depletionRate = this.calculateEnergyDepletionRate(energyLevels);
    const recoveryRate = this.calculateRecoveryRate(energyLevels);
    
    return Math.max(0, 100 - (depletionRate * 2) + recoveryRate);
  }
  
  private calculateRecoveryRate(energyLevels: number[]): number {
    let totalRecovery = 0;
    let recoveryCount = 0;
    
    for (let i = 1; i < energyLevels.length; i++) {
      const change = energyLevels[i] - energyLevels[i - 1];
      if (change > 0) {
        totalRecovery += change;
        recoveryCount++;
      }
    }
    
    return recoveryCount > 0 ? totalRecovery / recoveryCount : 0;
  }
  
  private identifyBurnoutRiskFactors(stream: BiometricDataPoint[]): string[] {
    const factors = [];
    
    const avgStress = stream.reduce((sum, d) => sum + d.stressLevel, 0) / stream.length;
    const avgCognitiveLoad = stream.reduce((sum, d) => sum + d.cognitiveLoad, 0) / stream.length;
    const recoveryTime = this.calculateAverageRecoveryTime(stream);
    
    if (avgStress > 70) factors.push('chronic_stress');
    if (avgCognitiveLoad > 85) factors.push('cognitive_overload');
    if (recoveryTime > 30 * 60 * 1000) factors.push('slow_recovery'); // 30 minutes
    
    return factors;
  }
  
  private calculateAverageRecoveryTime(stream: BiometricDataPoint[]): number {
    // Calculate average time to recover from high stress/load
    return 15 * 60 * 1000; // 15 minutes placeholder
  }
  
  // Utility methods
  private findSustainedAttentionPeriods(stream: BiometricDataPoint[]): any[] {
    const periods = [];
    let currentPeriod: any = null;
    
    for (const point of stream) {
      if (point.attentionLevel > 70) {
        if (!currentPeriod) {
          currentPeriod = { start: point.timestamp, end: point.timestamp };
        } else {
          currentPeriod.end = point.timestamp;
        }
      } else if (currentPeriod) {
        if (currentPeriod.end - currentPeriod.start > 5 * 60 * 1000) { // 5 minutes
          periods.push(currentPeriod);
        }
        currentPeriod = null;
      }
    }
    
    if (currentPeriod && currentPeriod.end - currentPeriod.start > 5 * 60 * 1000) {
      periods.push(currentPeriod);
    }
    
    return periods;
  }
  
  private countContextSwitches(stream: BiometricDataPoint[]): number {
    let switches = 0;
    let lastContext = stream[0]?.contextId;
    
    for (let i = 1; i < stream.length; i++) {
      if (stream[i].contextId !== lastContext) {
        switches++;
        lastContext = stream[i].contextId;
      }
    }
    
    return switches;
  }
  
  private calculateOverloadSeverity(point: BiometricDataPoint): number {
    return (point.stressLevel + (100 - point.attentionLevel) + point.cognitiveLoad) / 3;
  }
  
  private identifyOverloadTriggers(point: BiometricDataPoint): string[] {
    const triggers = [];
    
    if ((point.environmentalSound || 0) > 70) triggers.push('noise');
    if ((point.lightLevel || 0) > 1000) triggers.push('bright_light');
    if (point.cognitiveLoad > 90) triggers.push('cognitive_overload');
    
    return triggers;
  }
  
  // Cache and storage methods
  private async getCachedPatterns(userId: string): Promise<NDPatterns | null> {
    const cached = await this.redis.get(`nd_patterns:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  private isCacheValid(patterns: NDPatterns): boolean {
    const cacheAge = Date.now() - patterns.timestamp;
    return cacheAge < 30 * 60 * 1000; // 30 minutes
  }
  
  private async cachePatterns(userId: string, patterns: NDPatterns): Promise<void> {
    await this.redis.setEx(`nd_patterns:${userId}`, 1800, JSON.stringify(patterns));
  }
  
  private async storePatterns(patterns: NDPatterns): Promise<void> {
    await this.weaviate.data
      .creator()
      .withClassName('NexisBiometricPattern')
      .withProperties({
        ...patterns,
        patternType: 'neurodivergent_analysis',
        analysisVersion: '2.0'
      })
      .do();
  }
  
  private async generatePersonalizedInsights(patterns: NDPatterns): Promise<any> {
    // Generate actionable insights based on detected patterns
    return {
      recommendations: this.generateNDRecommendations(patterns),
      strengths: this.identifyNDStrengths(patterns),
      accommodations: this.suggestAccommodations(patterns),
      optimizationStrategies: this.generateOptimizationStrategies(patterns)
    };
  }
  
  private generateNDRecommendations(patterns: NDPatterns): string[] {
    const recommendations = [];
    
    if (patterns.hyperfocus.length > 0) {
      recommendations.push('Schedule demanding tasks during hyperfocus periods');
      recommendations.push('Set reminders for breaks during hyperfocus sessions');
    }
    
    if (patterns.contextSwitching.pattern === 'chaotic') {
      recommendations.push('Implement structured task-switching schedules');
      recommendations.push('Use transition rituals between contexts');
    }
    
    if (patterns.attentionVariability.variability > 30) {
      recommendations.push('Break large tasks into smaller chunks');
      recommendations.push('Use attention training exercises');
    }
    
    return recommendations;
  }
  
  private identifyNDStrengths(patterns: NDPatterns): string[] {
    const strengths = [];
    
    if (patterns.hyperfocus.length > 2) {
      strengths.push('Ability to achieve deep focus states');
      strengths.push('High productivity during optimal periods');
    }
    
    if (patterns.contextSwitching.switchingEfficiency > 80) {
      strengths.push('Efficient task switching abilities');
      strengths.push('Cognitive flexibility');
    }
    
    if (patterns.executiveFunction.cognitiveFlexibility > 80) {
      strengths.push('Strong problem-solving adaptability');
    }
    
    return strengths;
  }
  
  private suggestAccommodations(patterns: NDPatterns): string[] {
    const accommodations = [];
    
    if (patterns.sensoryProcessing.processingSensitivity > 0.7) {
      accommodations.push('Noise-cancelling headphones');
      accommodations.push('Adjustable lighting options');
      accommodations.push('Quiet workspace areas');
    }
    
    if (patterns.timePerception.timeBlindnessEvents > 2) {
      accommodations.push('Visual time reminders');
      accommodations.push('Automatic break scheduling');
    }
    
    return accommodations;
  }
  
  private generateOptimizationStrategies(patterns: NDPatterns): string[] {
    const strategies = [];
    
    // Energy management
    if (patterns.energyManagement.burnoutRiskFactors.length > 0) {
      strategies.push('Implement spoon theory energy budgeting');
      strategies.push('Schedule high-energy tasks during peak windows');
    }
    
    // Attention optimization
    if (patterns.attentionVariability.optimalAttentionPeriods.length > 0) {
      strategies.push(`Focus on complex tasks during hours: ${patterns.attentionVariability.optimalAttentionPeriods.join(', ')}`);
    }
    
    return strategies;
  }
  
  async shutdown(): Promise<void> {
    this.patternCache.clear();
    this.removeAllListeners();
  }
}

export default NeurodivergentAnalyticsService;