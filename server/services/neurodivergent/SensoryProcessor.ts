import { BiometricDataPoint } from '../BiometricPipelineService';

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

export interface SensoryOverloadEvent {
  timestamp: number;
  duration: number;
  triggers: string[];
  severity: 'mild' | 'moderate' | 'severe';
  recoveryTime: number;
  environmentalFactors: {
    sound?: number;
    light?: number;
    temperature?: number;
    motion?: number;
  };
  biometricResponse: {
    peakStress: number;
    minAttention: number;
    maxCognitiveLoad: number;
    hrvImpact: number;
  };
}

export interface SensoryConfig {
  overloadStressThreshold: number;
  overloadAttentionThreshold: number;
  overloadCognitiveThreshold: number;
  recoveryWindow: number;
  sensitivityAnalysisWindow: number;
}

export class SensoryProcessor {
  private config: SensoryConfig;

  constructor(config: Partial<SensoryConfig> = {}) {
    this.config = {
      overloadStressThreshold: 80,
      overloadAttentionThreshold: 30,
      overloadCognitiveThreshold: 90,
      recoveryWindow: 30 * 60 * 1000, // 30 minutes
      sensitivityAnalysisWindow: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
  }

  /**
   * Evaluate sensory processing patterns
   */
  async evaluateSensoryProcessing(stream: BiometricDataPoint[]): Promise<SensoryProcessingPattern> {
    const overloadEvents = this.detectSensoryOverloadEvents(stream);
    const avgRecoveryTime = this.calculateAverageRecoveryTime(overloadEvents);
    const triggerThresholds = this.calculateTriggerThresholds(stream, overloadEvents);
    const adaptationStrategies = this.identifyAdaptationStrategies(stream, overloadEvents);
    const sensorySeekingBehaviors = this.identifySensorySeekingBehaviors(stream);
    const processingSensitivity = this.calculateProcessingSensitivity(overloadEvents, stream);

    return {
      overloadEvents: overloadEvents.length,
      avgRecoveryTime,
      triggerThresholds,
      adaptationStrategies,
      sensorySeekingBehaviors,
      processingSensitivity
    };
  }

  /**
   * Detect sensory overload events in biometric stream
   */
  private detectSensoryOverloadEvents(stream: BiometricDataPoint[]): SensoryOverloadEvent[] {
    const events: SensoryOverloadEvent[] = [];
    let currentEvent: Partial<SensoryOverloadEvent> | null = null;
    let eventData: BiometricDataPoint[] = [];

    for (let i = 0; i < stream.length; i++) {
      const point = stream[i];
      
      // Sensory overload indicators
      const highStress = point.stressLevel > this.config.overloadStressThreshold;
      const lowAttention = point.attentionLevel < this.config.overloadAttentionThreshold;
      const highCognitiveLoad = point.cognitiveLoad > this.config.overloadCognitiveThreshold;
      const environmentalFactors = this.checkEnvironmentalTriggers(point);
      
      const isOverloaded = (highStress && lowAttention) || 
                          (highCognitiveLoad && environmentalFactors.triggered);

      if (isOverloaded) {
        if (!currentEvent) {
          // Start new overload event
          currentEvent = {
            timestamp: point.timestamp,
            environmentalFactors: environmentalFactors.factors,
            triggers: environmentalFactors.triggers
          };
          eventData = [point];
        } else {
          // Continue current event
          eventData.push(point);
        }
      } else if (currentEvent) {
        // End current overload event
        const event = this.analyzeOverloadEvent(currentEvent, eventData, stream, i);
        events.push(event);
        
        currentEvent = null;
        eventData = [];
      }
    }

    // Handle ongoing event at end of stream
    if (currentEvent && eventData.length > 0) {
      const event = this.analyzeOverloadEvent(currentEvent, eventData, stream, stream.length - 1);
      events.push(event);
    }

    return events;
  }

  /**
   * Check for environmental triggers
   */
  private checkEnvironmentalTriggers(point: BiometricDataPoint): {
    triggered: boolean;
    triggers: string[];
    factors: any;
  } {
    const triggers: string[] = [];
    const factors: any = {};

    // Sound level check
    const soundLevel = point.environmentalSound || 0;
    if (soundLevel > 70) {
      triggers.push('high_sound');
      factors.sound = soundLevel;
    }

    // Light level check
    const lightLevel = point.lightLevel || 0;
    if (lightLevel > 1000 || lightLevel < 50) {
      triggers.push(lightLevel > 1000 ? 'bright_light' : 'dim_light');
      factors.light = lightLevel;
    }

    // Temperature check
    const temperature = point.temperature || 0;
    if (temperature > 26 || temperature < 18) {
      triggers.push(temperature > 26 ? 'hot_temperature' : 'cold_temperature');
      factors.temperature = temperature;
    }

    // Motion/vibration check
    const motion = point.motionLevel || 0;
    if (motion > 50) {
      triggers.push('excessive_motion');
      factors.motion = motion;
    }

    return {
      triggered: triggers.length > 0,
      triggers,
      factors
    };
  }

  /**
   * Analyze a complete overload event
   */
  private analyzeOverloadEvent(
    event: Partial<SensoryOverloadEvent>,
    eventData: BiometricDataPoint[],
    fullStream: BiometricDataPoint[],
    endIndex: number
  ): SensoryOverloadEvent {
    const duration = eventData[eventData.length - 1].timestamp - eventData[0].timestamp;
    
    // Calculate biometric response during event
    const stressLevels = eventData.map(d => d.stressLevel);
    const attentionLevels = eventData.map(d => d.attentionLevel);
    const cognitiveLoads = eventData.map(d => d.cognitiveLoad);
    const hrvValues = eventData.map(d => d.hrvVariability || 0);

    const biometricResponse = {
      peakStress: Math.max(...stressLevels),
      minAttention: Math.min(...attentionLevels),
      maxCognitiveLoad: Math.max(...cognitiveLoads),
      hrvImpact: this.calculateHRVImpact(hrvValues)
    };

    // Determine severity
    const severity = this.determineSeverity(biometricResponse, duration);

    // Calculate recovery time
    const recoveryTime = this.calculateRecoveryTime(fullStream, endIndex);

    return {
      timestamp: event.timestamp!,
      duration,
      triggers: event.triggers || [],
      severity,
      recoveryTime,
      environmentalFactors: event.environmentalFactors || {},
      biometricResponse
    };
  }

  /**
   * Calculate HRV impact during overload
   */
  private calculateHRVImpact(hrvValues: number[]): number {
    if (hrvValues.length === 0) return 0;
    
    const avgHRV = hrvValues.reduce((sum, val) => sum + val, 0) / hrvValues.length;
    const hrvVariance = this.calculateVariance(hrvValues);
    
    // Higher variance and lower average indicates more impact
    return Math.min(100, (hrvVariance * 2) + (50 - avgHRV));
  }

  /**
   * Determine severity of overload event
   */
  private determineSeverity(
    response: SensoryOverloadEvent['biometricResponse'],
    duration: number
  ): 'mild' | 'moderate' | 'severe' {
    const durationMinutes = duration / (1000 * 60);
    
    // Severity scoring
    let score = 0;
    
    if (response.peakStress > 90) score += 3;
    else if (response.peakStress > 80) score += 2;
    else score += 1;
    
    if (response.minAttention < 20) score += 3;
    else if (response.minAttention < 30) score += 2;
    else score += 1;
    
    if (durationMinutes > 30) score += 2;
    else if (durationMinutes > 10) score += 1;
    
    if (response.hrvImpact > 70) score += 2;
    else if (response.hrvImpact > 40) score += 1;

    if (score >= 8) return 'severe';
    if (score >= 5) return 'moderate';
    return 'mild';
  }

  /**
   * Calculate recovery time after overload
   */
  private calculateRecoveryTime(stream: BiometricDataPoint[], overloadEndIndex: number): number {
    const baselineStress = 50;
    const baselineAttention = 60;
    
    for (let i = overloadEndIndex + 1; i < stream.length; i++) {
      const point = stream[i];
      const timeSinceEnd = point.timestamp - stream[overloadEndIndex].timestamp;
      
      if (timeSinceEnd > this.config.recoveryWindow) break;
      
      if (point.stressLevel <= baselineStress && point.attentionLevel >= baselineAttention) {
        return timeSinceEnd;
      }
    }
    
    return this.config.recoveryWindow; // Max recovery time
  }

  /**
   * Calculate average recovery time across events
   */
  private calculateAverageRecoveryTime(events: SensoryOverloadEvent[]): number {
    if (events.length === 0) return 0;
    
    const totalRecoveryTime = events.reduce((sum, event) => sum + event.recoveryTime, 0);
    return totalRecoveryTime / events.length;
  }

  /**
   * Calculate trigger thresholds based on historical overload events
   */
  private calculateTriggerThresholds(
    stream: BiometricDataPoint[],
    overloadEvents: SensoryOverloadEvent[]
  ): SensoryProcessingPattern['triggerThresholds'] {
    const soundTriggers: number[] = [];
    const lightTriggers: number[] = [];
    const temperatureTriggers: number[] = [];
    const motionTriggers: number[] = [];

    overloadEvents.forEach(event => {
      if (event.environmentalFactors.sound !== undefined) {
        soundTriggers.push(event.environmentalFactors.sound);
      }
      if (event.environmentalFactors.light !== undefined) {
        lightTriggers.push(event.environmentalFactors.light);
      }
      if (event.environmentalFactors.temperature !== undefined) {
        temperatureTriggers.push(event.environmentalFactors.temperature);
      }
      if (event.environmentalFactors.motion !== undefined) {
        motionTriggers.push(event.environmentalFactors.motion);
      }
    });

    return {
      sound: soundTriggers.length > 0 ? Math.min(...soundTriggers) : 70,
      light: lightTriggers.length > 0 ? Math.min(...lightTriggers) : 1000,
      temperature: temperatureTriggers.length > 0 ? this.findTemperatureTrigger(temperatureTriggers) : 26,
      motion: motionTriggers.length > 0 ? Math.min(...motionTriggers) : 50
    };
  }

  /**
   * Find temperature trigger threshold (handles both hot and cold)
   */
  private findTemperatureTrigger(temperatures: number[]): number {
    const sorted = temperatures.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Return the threshold closest to comfortable range (20-24°C)
    return median > 24 ? Math.min(...temperatures) : Math.max(...temperatures);
  }

  /**
   * Identify adaptation strategies based on successful coping patterns
   */
  private identifyAdaptationStrategies(
    stream: BiometricDataPoint[],
    overloadEvents: SensoryOverloadEvent[]
  ): string[] {
    const strategies: string[] = [];

    // Analyze recovery patterns
    const quickRecoveryEvents = overloadEvents.filter(e => e.recoveryTime < 10 * 60 * 1000); // < 10 minutes
    
    if (quickRecoveryEvents.length > 0) {
      strategies.push('quick_environment_change');
    }

    // Look for patterns where stress decreases rapidly
    const stressReductionPatterns = this.findStressReductionPatterns(stream);
    if (stressReductionPatterns.includes('gradual_breathing')) {
      strategies.push('breathing_techniques');
    }
    if (stressReductionPatterns.includes('location_change')) {
      strategies.push('environment_modification');
    }

    // Default strategies if none detected
    if (strategies.length === 0) {
      strategies.push('sensory_break', 'environment_modification');
    }

    return strategies;
  }

  /**
   * Find stress reduction patterns in biometric data
   */
  private findStressReductionPatterns(stream: BiometricDataPoint[]): string[] {
    const patterns: string[] = [];

    for (let i = 10; i < stream.length - 10; i++) {
      const before = stream.slice(i - 10, i);
      const after = stream.slice(i, i + 10);

      const avgStressBefore = before.reduce((sum, p) => sum + p.stressLevel, 0) / before.length;
      const avgStressAfter = after.reduce((sum, p) => sum + p.stressLevel, 0) / after.length;

      if (avgStressBefore > 70 && avgStressAfter < 50) {
        // Significant stress reduction
        const hrvChange = this.analyzeHRVPattern(before, after);
        const contextChange = before[before.length - 1].contextId !== after[0].contextId;

        if (hrvChange === 'improved_coherence') {
          patterns.push('gradual_breathing');
        }
        if (contextChange) {
          patterns.push('location_change');
        }
      }
    }

    return patterns;
  }

  /**
   * Analyze HRV pattern changes
   */
  private analyzeHRVPattern(before: BiometricDataPoint[], after: BiometricDataPoint[]): string {
    const avgHRVBefore = before.reduce((sum, p) => sum + (p.hrvVariability || 0), 0) / before.length;
    const avgHRVAfter = after.reduce((sum, p) => sum + (p.hrvVariability || 0), 0) / after.length;

    if (avgHRVAfter > avgHRVBefore * 1.2) {
      return 'improved_coherence';
    }
    return 'no_change';
  }

  /**
   * Identify sensory seeking behaviors
   */
  private identifySensorySeekingBehaviors(stream: BiometricDataPoint[]): string[] {
    const behaviors: string[] = [];

    // Look for patterns where environmental changes correlate with improved mood/attention
    const environmentalShifts = this.findEnvironmentalShifts(stream);
    
    if (environmentalShifts.includes('increased_movement')) {
      behaviors.push('movement_seeking');
    }
    if (environmentalShifts.includes('sound_seeking')) {
      behaviors.push('auditory_stimulation');
    }
    if (environmentalShifts.includes('light_adjustment')) {
      behaviors.push('visual_optimization');
    }

    return behaviors;
  }

  /**
   * Find environmental shifts that correlate with improved states
   */
  private findEnvironmentalShifts(stream: BiometricDataPoint[]): string[] {
    const shifts: string[] = [];

    for (let i = 5; i < stream.length - 5; i++) {
      const before = stream[i - 5];
      const current = stream[i];
      const after = stream[i + 5];

      // Check for environmental changes followed by improvements
      if (this.hasEnvironmentalChange(before, current) && this.hasImprovement(current, after)) {
        const changeType = this.identifyChangeType(before, current);
        if (changeType && !shifts.includes(changeType)) {
          shifts.push(changeType);
        }
      }
    }

    return shifts;
  }

  /**
   * Check if there's an environmental change between two points
   */
  private hasEnvironmentalChange(before: BiometricDataPoint, current: BiometricDataPoint): boolean {
    const soundChange = Math.abs((current.environmentalSound || 0) - (before.environmentalSound || 0)) > 20;
    const lightChange = Math.abs((current.lightLevel || 0) - (before.lightLevel || 0)) > 200;
    const motionChange = Math.abs((current.motionLevel || 0) - (before.motionLevel || 0)) > 20;
    
    return soundChange || lightChange || motionChange;
  }

  /**
   * Check if there's an improvement in biometric state
   */
  private hasImprovement(before: BiometricDataPoint, after: BiometricDataPoint): boolean {
    const stressImprovement = after.stressLevel < before.stressLevel - 10;
    const attentionImprovement = after.attentionLevel > before.attentionLevel + 10;
    
    return stressImprovement || attentionImprovement;
  }

  /**
   * Identify the type of environmental change
   */
  private identifyChangeType(before: BiometricDataPoint, current: BiometricDataPoint): string | null {
    const soundIncrease = (current.environmentalSound || 0) > (before.environmentalSound || 0) + 20;
    const lightIncrease = (current.lightLevel || 0) > (before.lightLevel || 0) + 200;
    const motionIncrease = (current.motionLevel || 0) > (before.motionLevel || 0) + 20;

    if (soundIncrease) return 'sound_seeking';
    if (lightIncrease) return 'light_adjustment';
    if (motionIncrease) return 'increased_movement';

    return null;
  }

  /**
   * Calculate overall sensory processing sensitivity
   */
  private calculateProcessingSensitivity(events: SensoryOverloadEvent[], stream: BiometricDataPoint[]): number {
    if (events.length === 0) return 50; // Baseline sensitivity

    // Calculate based on frequency and severity of overload events
    const severityWeights = { mild: 1, moderate: 2, severe: 3 };
    const weightedEventCount = events.reduce((sum, event) => sum + severityWeights[event.severity], 0);
    
    // Normalize by time period
    const timeSpan = stream.length > 0 ? 
      (stream[stream.length - 1].timestamp - stream[0].timestamp) / (24 * 60 * 60 * 1000) : 1;
    
    const dailyWeightedEvents = weightedEventCount / timeSpan;
    
    // Convert to sensitivity score (0-100)
    const sensitivity = Math.min(100, 50 + (dailyWeightedEvents * 10));
    
    return sensitivity;
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Get sensory processing statistics
   */
  getSensoryStatistics(pattern: SensoryProcessingPattern, events: SensoryOverloadEvent[]): {
    overloadFrequency: string;
    mostCommonTrigger: string;
    averageSeverity: string;
    recoveryEfficiency: string;
    adaptationEffectiveness: string;
    sensoryProfile: string;
  } {
    const overloadFrequency = this.categorizeFrequency(pattern.overloadEvents);
    const mostCommonTrigger = this.findMostCommonTrigger(events);
    const averageSeverity = this.calculateAverageSeverity(events);
    const recoveryEfficiency = this.categorizeRecoveryTime(pattern.avgRecoveryTime);
    const adaptationEffectiveness = this.evaluateAdaptationEffectiveness(pattern.adaptationStrategies);
    const sensoryProfile = this.determineSensoryProfile(pattern.processingSensitivity, events);

    return {
      overloadFrequency,
      mostCommonTrigger,
      averageSeverity,
      recoveryEfficiency,
      adaptationEffectiveness,
      sensoryProfile
    };
  }

  private categorizeFrequency(count: number): string {
    if (count === 0) return 'none';
    if (count <= 2) return 'low';
    if (count <= 5) return 'moderate';
    return 'high';
  }

  private findMostCommonTrigger(events: SensoryOverloadEvent[]): string {
    const triggerCounts: Map<string, number> = new Map();
    
    events.forEach(event => {
      event.triggers.forEach(trigger => {
        triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
      });
    });

    let maxCount = 0;
    let mostCommon = 'none';
    
    for (const [trigger, count] of triggerCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = trigger;
      }
    }

    return mostCommon;
  }

  private calculateAverageSeverity(events: SensoryOverloadEvent[]): string {
    if (events.length === 0) return 'none';
    
    const severityScores = events.map(event => {
      switch (event.severity) {
        case 'mild': return 1;
        case 'moderate': return 2;
        case 'severe': return 3;
        default: return 0;
      }
    });

    const avgScore = severityScores.reduce((sum, score) => sum + score, 0) / severityScores.length;
    
    if (avgScore <= 1.3) return 'mild';
    if (avgScore <= 2.3) return 'moderate';
    return 'severe';
  }

  private categorizeRecoveryTime(avgTime: number): string {
    const minutes = avgTime / (1000 * 60);
    
    if (minutes <= 5) return 'excellent';
    if (minutes <= 15) return 'good';
    if (minutes <= 30) return 'moderate';
    return 'needs_improvement';
  }

  private evaluateAdaptationEffectiveness(strategies: string[]): string {
    if (strategies.length === 0) return 'none';
    if (strategies.length <= 2) return 'limited';
    if (strategies.length <= 4) return 'moderate';
    return 'comprehensive';
  }

  private determineSensoryProfile(sensitivity: number, events: SensoryOverloadEvent[]): string {
    if (sensitivity < 30) return 'hyposensitive';
    if (sensitivity > 70) return 'hypersensitive';
    
    // Check for mixed patterns
    const hasSeeking = events.some(e => e.triggers.includes('sound_seeking') || e.triggers.includes('increased_movement'));
    const hasAvoiding = events.some(e => e.triggers.includes('high_sound') || e.triggers.includes('bright_light'));
    
    if (hasSeeking && hasAvoiding) return 'mixed_profile';
    if (hasSeeking) return 'sensory_seeking';
    if (hasAvoiding) return 'sensory_avoiding';
    
    return 'balanced';
  }
}