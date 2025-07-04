import { BiometricDataPoint } from '../BiometricPipelineService';

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

export interface AttentionConfig {
  sustainedThreshold: number;
  minimumSustainedDuration: number;
  cycleDetectionWindow: number;
  distractibilityWindow: number;
  vigilanceWindow: number;
}

export class AttentionPatternAnalyzer {
  private config: AttentionConfig;

  constructor(config: Partial<AttentionConfig> = {}) {
    this.config = {
      sustainedThreshold: 70,
      minimumSustainedDuration: 15 * 60 * 1000, // 15 minutes
      cycleDetectionWindow: 60 * 60 * 1000, // 1 hour
      distractibilityWindow: 5 * 60 * 1000, // 5 minutes
      vigilanceWindow: 30 * 60 * 1000, // 30 minutes
      ...config
    };
  }

  /**
   * Analyze attention variability patterns
   */
  async analyzeAttentionPatterns(stream: BiometricDataPoint[]): Promise<AttentionPattern> {
    const attentionLevels = stream.map(p => p.attentionLevel);
    
    const avgAttention = this.calculateAverageAttention(attentionLevels);
    const variability = this.calculateAttentionVariability(attentionLevels);
    const sustainedAttentionDuration = this.calculateSustainedAttentionDuration(stream);
    const distractibilityScore = this.calculateDistractibilityScore(stream);
    const optimalAttentionPeriods = this.findOptimalAttentionPeriods(stream);
    const attentionCycles = this.detectAttentionCycles(stream);
    const vigilanceDecrement = this.calculateVigilanceDecrement(stream);

    return {
      avgAttention,
      variability,
      sustainedAttentionDuration,
      distractibilityScore,
      optimalAttentionPeriods,
      attentionCycles,
      vigilanceDecrement
    };
  }

  /**
   * Analyze stimulation seeking and regulation patterns
   */
  async analyzeStimulationPatterns(stream: BiometricDataPoint[]): Promise<StimulationPattern> {
    const stimSeekingBehavior = this.detectStimSeekingBehavior(stream);
    const stimAvoidanceBehavior = this.detectStimAvoidanceBehavior(stream);
    const optimalStimulationLevel = this.findOptimalStimulationLevel(stream);
    const stimRegulationStrategies = this.identifyStimRegulationStrategies(stream);
    const sensoryPreferences = this.identifySensoryPreferences(stream);
    const alertnessCorrelation = this.calculateAlertnessCorrelation(stream);

    return {
      stimSeekingBehavior,
      stimAvoidanceBehavior,
      optimalStimulationLevel,
      stimRegulationStrategies,
      sensoryPreferences,
      alertnessCorrelation
    };
  }

  /**
   * Analyze time perception patterns
   */
  async analyzeTimePerception(stream: BiometricDataPoint[]): Promise<TimePerceptionPattern> {
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
  async analyzeEnergyPatterns(stream: BiometricDataPoint[]): Promise<EnergyPattern> {
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

  /**
   * Calculate average attention across the stream
   */
  private calculateAverageAttention(attentionLevels: number[]): number {
    if (attentionLevels.length === 0) return 0;
    return attentionLevels.reduce((sum, level) => sum + level, 0) / attentionLevels.length;
  }

  /**
   * Calculate attention variability (coefficient of variation)
   */
  private calculateAttentionVariability(attentionLevels: number[]): number {
    if (attentionLevels.length === 0) return 0;
    
    const mean = this.calculateAverageAttention(attentionLevels);
    const variance = attentionLevels.reduce((sum, level) => sum + Math.pow(level - mean, 2), 0) / attentionLevels.length;
    const stdDev = Math.sqrt(variance);
    
    return (stdDev / mean) * 100; // Coefficient of variation as percentage
  }

  /**
   * Calculate sustained attention duration
   */
  private calculateSustainedAttentionDuration(stream: BiometricDataPoint[]): number {
    let maxSustainedDuration = 0;
    let currentSustainedStart = -1;
    
    for (let i = 0; i < stream.length; i++) {
      const point = stream[i];
      
      if (point.attentionLevel >= this.config.sustainedThreshold) {
        if (currentSustainedStart === -1) {
          currentSustainedStart = i;
        }
      } else {
        if (currentSustainedStart !== -1) {
          const duration = stream[i - 1].timestamp - stream[currentSustainedStart].timestamp;
          maxSustainedDuration = Math.max(maxSustainedDuration, duration);
          currentSustainedStart = -1;
        }
      }
    }
    
    // Check if sustained period continues to end of stream
    if (currentSustainedStart !== -1) {
      const duration = stream[stream.length - 1].timestamp - stream[currentSustainedStart].timestamp;
      maxSustainedDuration = Math.max(maxSustainedDuration, duration);
    }
    
    return maxSustainedDuration;
  }

  /**
   * Calculate distractibility score
   */
  private calculateDistractibilityScore(stream: BiometricDataPoint[]): number {
    let distractionEvents = 0;
    let totalEvents = 0;
    
    for (let i = 1; i < stream.length - 1; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      const next = stream[i + 1];
      
      // Detect sudden attention drops (potential distractions)
      if (prev.attentionLevel > 70 && current.attentionLevel < 50) {
        totalEvents++;
        
        // Check if attention doesn't recover quickly
        const recoveryTime = this.calculateRecoveryTime(stream, i);
        if (recoveryTime > this.config.distractibilityWindow) {
          distractionEvents++;
        }
      }
    }
    
    if (totalEvents === 0) return 0; // No distractions detected
    
    return (distractionEvents / totalEvents) * 100;
  }

  /**
   * Calculate recovery time from attention drop
   */
  private calculateRecoveryTime(stream: BiometricDataPoint[], dropIndex: number): number {
    const targetAttention = stream[dropIndex - 1].attentionLevel * 0.8; // 80% of previous level
    
    for (let i = dropIndex + 1; i < stream.length; i++) {
      if (stream[i].attentionLevel >= targetAttention) {
        return stream[i].timestamp - stream[dropIndex].timestamp;
      }
    }
    
    return Number.MAX_SAFE_INTEGER; // No recovery found
  }

  /**
   * Find optimal attention periods (times of day with best attention)
   */
  private findOptimalAttentionPeriods(stream: BiometricDataPoint[]): number[] {
    const hourlyAttention: Map<number, number[]> = new Map();
    
    // Group attention levels by hour of day
    stream.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      if (!hourlyAttention.has(hour)) {
        hourlyAttention.set(hour, []);
      }
      hourlyAttention.get(hour)!.push(point.attentionLevel);
    });
    
    // Calculate average attention for each hour
    const hourlyAverages: Array<{hour: number, avgAttention: number}> = [];
    hourlyAttention.forEach((levels, hour) => {
      const avgAttention = levels.reduce((sum, level) => sum + level, 0) / levels.length;
      hourlyAverages.push({ hour, avgAttention });
    });
    
    // Sort by attention level and return top 3 hours
    hourlyAverages.sort((a, b) => b.avgAttention - a.avgAttention);
    return hourlyAverages.slice(0, 3).map(item => item.hour);
  }

  /**
   * Detect attention cycles (patterns of attention peaks and valleys)
   */
  private detectAttentionCycles(stream: BiometricDataPoint[]): AttentionCycle[] {
    const cycles: AttentionCycle[] = [];
    const windowSize = Math.floor(this.config.cycleDetectionWindow / (5 * 60 * 1000)); // 5-minute intervals
    
    for (let i = 0; i < stream.length - windowSize; i += windowSize) {
      const window = stream.slice(i, i + windowSize);
      const cycle = this.analyzeCycleWindow(window);
      if (cycle) {
        cycles.push(cycle);
      }
    }
    
    return cycles;
  }

  /**
   * Analyze a window for attention cycle characteristics
   */
  private analyzeCycleWindow(window: BiometricDataPoint[]): AttentionCycle | null {
    if (window.length < 3) return null;
    
    const attentionLevels = window.map(p => p.attentionLevel);
    const peakIndex = attentionLevels.indexOf(Math.max(...attentionLevels));
    const peakTime = window[peakIndex].timestamp;
    
    const duration = window[window.length - 1].timestamp - window[0].timestamp;
    const intensity = Math.max(...attentionLevels);
    const efficiency = this.calculateCycleEfficiency(attentionLevels);
    
    // Only consider it a cycle if there's significant variation
    const variation = this.calculateAttentionVariability(attentionLevels);
    if (variation < 15) return null; // Too stable to be considered a cycle
    
    return {
      peakTime,
      duration,
      intensity,
      efficiency
    };
  }

  /**
   * Calculate efficiency of an attention cycle
   */
  private calculateCycleEfficiency(attentionLevels: number[]): number {
    const avgAttention = attentionLevels.reduce((sum, level) => sum + level, 0) / attentionLevels.length;
    const timeAboveThreshold = attentionLevels.filter(level => level > this.config.sustainedThreshold).length;
    const efficiency = (timeAboveThreshold / attentionLevels.length) * (avgAttention / 100);
    
    return efficiency * 100;
  }

  /**
   * Calculate vigilance decrement (attention decline over time)
   */
  private calculateVigilanceDecrement(stream: BiometricDataPoint[]): number {
    if (stream.length < 10) return 0;
    
    const windowSize = Math.floor(this.config.vigilanceWindow / (5 * 60 * 1000)); // 5-minute intervals
    const windows: number[] = [];
    
    for (let i = 0; i < stream.length - windowSize; i += windowSize) {
      const window = stream.slice(i, i + windowSize);
      const avgAttention = window.reduce((sum, p) => sum + p.attentionLevel, 0) / window.length;
      windows.push(avgAttention);
    }
    
    if (windows.length < 2) return 0;
    
    // Calculate the slope of attention decline
    const initialAttention = windows[0];
    const finalAttention = windows[windows.length - 1];
    const decrement = ((initialAttention - finalAttention) / initialAttention) * 100;
    
    return Math.max(0, decrement); // Only positive decrements
  }

  /**
   * Detect stimulation seeking behavior
   */
  private detectStimSeekingBehavior(stream: BiometricDataPoint[]): number {
    let seekingEvents = 0;
    let totalLowStimPeriods = 0;
    
    for (let i = 1; i < stream.length; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      
      // Low stimulation period (low environmental input)
      const lowStim = (prev.environmentalSound || 0) < 40 && 
                      (prev.lightLevel || 0) < 300 && 
                      (prev.motionLevel || 0) < 20;
      
      if (lowStim) {
        totalLowStimPeriods++;
        
        // Check if stimulation seeking behavior occurs (increase in movement, seeking sound, etc.)
        const stimSeeking = (current.motionLevel || 0) > (prev.motionLevel || 0) + 20 ||
                           (current.environmentalSound || 0) > (prev.environmentalSound || 0) + 20;
        
        if (stimSeeking) {
          seekingEvents++;
        }
      }
    }
    
    if (totalLowStimPeriods === 0) return 0;
    
    return (seekingEvents / totalLowStimPeriods) * 100;
  }

  /**
   * Detect stimulation avoidance behavior
   */
  private detectStimAvoidanceBehavior(stream: BiometricDataPoint[]): number {
    let avoidanceEvents = 0;
    let totalHighStimPeriods = 0;
    
    for (let i = 1; i < stream.length; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      
      // High stimulation period
      const highStim = (prev.environmentalSound || 0) > 70 || 
                       (prev.lightLevel || 0) > 1000 || 
                       (prev.motionLevel || 0) > 60;
      
      if (highStim) {
        totalHighStimPeriods++;
        
        // Check for avoidance (context change, stress increase, attention drop)
        const avoidance = prev.contextId !== current.contextId ||
                         current.stressLevel > prev.stressLevel + 20 ||
                         current.attentionLevel < prev.attentionLevel - 30;
        
        if (avoidance) {
          avoidanceEvents++;
        }
      }
    }
    
    if (totalHighStimPeriods === 0) return 0;
    
    return (avoidanceEvents / totalHighStimPeriods) * 100;
  }

  /**
   * Find optimal stimulation level for attention and performance
   */
  private findOptimalStimulationLevel(stream: BiometricDataPoint[]): number {
    const stimulationLevels: Array<{stim: number, attention: number}> = [];
    
    stream.forEach(point => {
      const stimLevel = ((point.environmentalSound || 0) + 
                        (point.lightLevel || 0) / 10 + 
                        (point.motionLevel || 0)) / 3;
      
      stimulationLevels.push({
        stim: stimLevel,
        attention: point.attentionLevel
      });
    });
    
    // Group by stimulation level ranges and find the one with highest attention
    const ranges = [
      { min: 0, max: 20, attention: [] as number[] },
      { min: 20, max: 40, attention: [] as number[] },
      { min: 40, max: 60, attention: [] as number[] },
      { min: 60, max: 80, attention: [] as number[] },
      { min: 80, max: 100, attention: [] as number[] }
    ];
    
    stimulationLevels.forEach(({ stim, attention }) => {
      const range = ranges.find(r => stim >= r.min && stim < r.max);
      if (range) {
        range.attention.push(attention);
      }
    });
    
    let optimalRange = ranges[0];
    let maxAvgAttention = 0;
    
    ranges.forEach(range => {
      if (range.attention.length > 0) {
        const avgAttention = range.attention.reduce((sum, a) => sum + a, 0) / range.attention.length;
        if (avgAttention > maxAvgAttention) {
          maxAvgAttention = avgAttention;
          optimalRange = range;
        }
      }
    });
    
    return (optimalRange.min + optimalRange.max) / 2;
  }

  /**
   * Identify stimulation regulation strategies
   */
  private identifyStimRegulationStrategies(stream: BiometricDataPoint[]): string[] {
    const strategies: string[] = [];
    
    // Look for patterns that indicate successful regulation
    for (let i = 5; i < stream.length - 5; i++) {
      const before = stream.slice(i - 5, i);
      const after = stream.slice(i, i + 5);
      
      const avgStressBefore = before.reduce((sum, p) => sum + p.stressLevel, 0) / before.length;
      const avgStressAfter = after.reduce((sum, p) => sum + p.stressLevel, 0) / after.length;
      
      // Successful stress reduction
      if (avgStressBefore > 70 && avgStressAfter < 50) {
        const contextChange = before[before.length - 1].contextId !== after[0].contextId;
        const movementIncrease = (after[0].motionLevel || 0) > (before[before.length - 1].motionLevel || 0) + 15;
        const soundChange = Math.abs((after[0].environmentalSound || 0) - (before[before.length - 1].environmentalSound || 0)) > 20;
        
        if (contextChange && !strategies.includes('environment_change')) {
          strategies.push('environment_change');
        }
        if (movementIncrease && !strategies.includes('movement_regulation')) {
          strategies.push('movement_regulation');
        }
        if (soundChange && !strategies.includes('auditory_regulation')) {
          strategies.push('auditory_regulation');
        }
      }
    }
    
    if (strategies.length === 0) {
      strategies.push('unknown_regulation');
    }
    
    return strategies;
  }

  /**
   * Identify sensory preferences
   */
  private identifySensoryPreferences(stream: BiometricDataPoint[]): string[] {
    const preferences: string[] = [];
    
    // Analyze correlation between sensory inputs and positive outcomes
    const correlations = this.calculateSensoryCorrelations(stream);
    
    if (correlations.sound > 0.3) preferences.push('auditory_input');
    if (correlations.light > 0.3) preferences.push('visual_stimulation');
    if (correlations.movement > 0.3) preferences.push('kinesthetic_input');
    if (correlations.quietness > 0.3) preferences.push('auditory_quiet');
    if (correlations.dimLight > 0.3) preferences.push('low_visual_input');
    
    return preferences;
  }

  /**
   * Calculate correlations between sensory inputs and positive outcomes
   */
  private calculateSensoryCorrelations(stream: BiometricDataPoint[]): any {
    const correlations = {
      sound: 0,
      light: 0,
      movement: 0,
      quietness: 0,
      dimLight: 0
    };
    
    // Simplified correlation calculation
    let positiveOutcomes = 0;
    let soundPositive = 0, lightPositive = 0, movementPositive = 0;
    let quietPositive = 0, dimPositive = 0;
    
    stream.forEach(point => {
      const isPositive = point.attentionLevel > 70 && point.stressLevel < 50;
      
      if (isPositive) {
        positiveOutcomes++;
        
        if ((point.environmentalSound || 0) > 50) soundPositive++;
        if ((point.lightLevel || 0) > 500) lightPositive++;
        if ((point.motionLevel || 0) > 30) movementPositive++;
        if ((point.environmentalSound || 0) < 30) quietPositive++;
        if ((point.lightLevel || 0) < 200) dimPositive++;
      }
    });
    
    if (positiveOutcomes > 0) {
      correlations.sound = soundPositive / positiveOutcomes;
      correlations.light = lightPositive / positiveOutcomes;
      correlations.movement = movementPositive / positiveOutcomes;
      correlations.quietness = quietPositive / positiveOutcomes;
      correlations.dimLight = dimPositive / positiveOutcomes;
    }
    
    return correlations;
  }

  /**
   * Calculate correlation between stimulation and alertness
   */
  private calculateAlertnessCorrelation(stream: BiometricDataPoint[]): number {
    if (stream.length < 10) return 0;
    
    const stimLevels: number[] = [];
    const alertnessLevels: number[] = [];
    
    stream.forEach(point => {
      const stimLevel = ((point.environmentalSound || 0) + 
                        (point.lightLevel || 0) / 10 + 
                        (point.motionLevel || 0)) / 3;
      
      stimLevels.push(stimLevel);
      alertnessLevels.push(point.attentionLevel);
    });
    
    return this.calculateCorrelation(stimLevels, alertnessLevels);
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      
      numerator += diffX * diffY;
      sumXSquared += diffX * diffX;
      sumYSquared += diffY * diffY;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Time perception methods
  private assessTimeEstimationAccuracy(stream: BiometricDataPoint[]): number {
    // Placeholder - would require actual time estimation data
    return 75; 
  }

  private measureHyperfocusTimeDistortion(stream: BiometricDataPoint[]): number {
    // Placeholder - would analyze hyperfocus periods vs perceived time
    return 60;
  }

  private assessTaskDurationPrediction(stream: BiometricDataPoint[]): number {
    // Placeholder - would compare predicted vs actual task durations
    return 70;
  }

  private countTimeBlindnessEvents(stream: BiometricDataPoint[]): number {
    // Placeholder - would count periods where time perception is significantly off
    return 3;
  }

  private measureTemporalProcessingDelay(stream: BiometricDataPoint[]): number {
    // Placeholder - would measure delay in processing temporal information
    return 250; // milliseconds
  }

  private calculateCircadianAlignment(stream: BiometricDataPoint[]): number {
    // Analyze how well attention patterns align with natural circadian rhythms
    const hourlyAttention = this.findOptimalAttentionPeriods(stream);
    
    // Typical circadian attention peaks: 10am, 2pm, 6pm
    const idealPeaks = [10, 14, 18];
    let alignmentScore = 0;
    
    hourlyAttention.forEach(hour => {
      const closestIdeal = idealPeaks.reduce((closest, ideal) => 
        Math.abs(ideal - hour) < Math.abs(closest - hour) ? ideal : closest
      );
      
      const distance = Math.abs(closestIdeal - hour);
      alignmentScore += Math.max(0, 100 - (distance * 10));
    });
    
    return alignmentScore / hourlyAttention.length;
  }

  // Energy pattern methods
  private calculateEnergyLevels(stream: BiometricDataPoint[]): number[] {
    // Energy estimated from combination of attention, stress (inverted), and HRV
    return stream.map(point => {
      const energyFromAttention = point.attentionLevel * 0.4;
      const energyFromStress = (100 - point.stressLevel) * 0.3;
      const energyFromHRV = (point.hrvVariability || 50) * 0.3;
      
      return energyFromAttention + energyFromStress + energyFromHRV;
    });
  }

  private findPeakEnergyWindows(energyLevels: number[], stream: BiometricDataPoint[]): number[] {
    const hourlyEnergy: Map<number, number[]> = new Map();
    
    energyLevels.forEach((energy, index) => {
      const hour = new Date(stream[index].timestamp).getHours();
      if (!hourlyEnergy.has(hour)) {
        hourlyEnergy.set(hour, []);
      }
      hourlyEnergy.get(hour)!.push(energy);
    });
    
    const hourlyAverages: Array<{hour: number, avgEnergy: number}> = [];
    hourlyEnergy.forEach((levels, hour) => {
      const avgEnergy = levels.reduce((sum, level) => sum + level, 0) / levels.length;
      hourlyAverages.push({ hour, avgEnergy });
    });
    
    hourlyAverages.sort((a, b) => b.avgEnergy - a.avgEnergy);
    return hourlyAverages.slice(0, 3).map(item => item.hour);
  }

  private calculateEnergyDepletionRate(energyLevels: number[]): number {
    if (energyLevels.length < 2) return 0;
    
    let totalDepletion = 0;
    let depletionPeriods = 0;
    
    for (let i = 1; i < energyLevels.length; i++) {
      const change = energyLevels[i - 1] - energyLevels[i];
      if (change > 0) {
        totalDepletion += change;
        depletionPeriods++;
      }
    }
    
    return depletionPeriods > 0 ? totalDepletion / depletionPeriods : 0;
  }

  private identifyRecoveryPatterns(stream: BiometricDataPoint[]): string[] {
    const patterns: string[] = [];
    
    // Look for recovery patterns after high stress/low energy periods
    for (let i = 10; i < stream.length - 10; i++) {
      const before = stream.slice(i - 10, i);
      const after = stream.slice(i, i + 10);
      
      const avgStressBefore = before.reduce((sum, p) => sum + p.stressLevel, 0) / before.length;
      const avgStressAfter = after.reduce((sum, p) => sum + p.stressLevel, 0) / after.length;
      
      if (avgStressBefore > 70 && avgStressAfter < 50) {
        const contextChange = before[before.length - 1].contextId !== after[0].contextId;
        const movementChange = Math.abs((after[0].motionLevel || 0) - (before[before.length - 1].motionLevel || 0)) > 20;
        
        if (contextChange && !patterns.includes('environment_change')) {
          patterns.push('environment_change');
        }
        if (movementChange && !patterns.includes('activity_change')) {
          patterns.push('activity_change');
        }
      }
    }
    
    return patterns.length > 0 ? patterns : ['rest_based'];
  }

  private calculateSpoonTheoryScore(stream: BiometricDataPoint[]): number {
    // Estimate daily energy allocation based on spoon theory
    const energyLevels = this.calculateEnergyLevels(stream);
    const dailyEnergyBudget = 100;
    const energySpent = energyLevels.reduce((sum, level) => sum + (100 - level), 0) / energyLevels.length;
    
    return Math.max(0, dailyEnergyBudget - energySpent);
  }

  private identifyBurnoutRiskFactors(stream: BiometricDataPoint[]): string[] {
    const riskFactors: string[] = [];
    
    const avgStress = stream.reduce((sum, p) => sum + p.stressLevel, 0) / stream.length;
    const avgCognitive = stream.reduce((sum, p) => sum + p.cognitiveLoad, 0) / stream.length;
    const energyLevels = this.calculateEnergyLevels(stream);
    const avgEnergy = energyLevels.reduce((sum, level) => sum + level, 0) / energyLevels.length;
    
    if (avgStress > 70) riskFactors.push('chronic_stress');
    if (avgCognitive > 85) riskFactors.push('cognitive_overload');
    if (avgEnergy < 40) riskFactors.push('low_energy');
    
    const sustainedHighLoad = this.calculateSustainedHighLoadPeriods(stream);
    if (sustainedHighLoad > 4) riskFactors.push('sustained_high_demand');
    
    return riskFactors;
  }

  private calculateSustainedHighLoadPeriods(stream: BiometricDataPoint[]): number {
    let periods = 0;
    let currentPeriodLength = 0;
    
    for (const point of stream) {
      if (point.cognitiveLoad > 80 && point.stressLevel > 60) {
        currentPeriodLength++;
      } else {
        if (currentPeriodLength >= 30) { // 30+ minutes of high load
          periods++;
        }
        currentPeriodLength = 0;
      }
    }
    
    return periods;
  }
}