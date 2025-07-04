import { BiometricDataPoint } from '../BiometricPipelineService';

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

export interface ExecutiveFunctionMetrics {
  overallScore: number;
  strengths: string[];
  challenges: string[];
  recommendations: string[];
  supportStrategies: string[];
}

export interface TaskPerformanceData {
  taskType: string;
  duration: number;
  completionRate: number;
  cognitiveLoadPattern: number[];
  attentionSustainability: number;
  contextSwitches: number;
  errorRate: number;
}

export interface ExecutiveFunctionConfig {
  highCognitiveLoadThreshold: number;
  sustainedAttentionMinutes: number;
  contextSwitchCostThreshold: number;
  processingSpeedWindow: number;
  inhibitionResponseTime: number;
}

export class ExecutiveFunctionAnalyzer {
  private config: ExecutiveFunctionConfig;

  constructor(config: Partial<ExecutiveFunctionConfig> = {}) {
    this.config = {
      highCognitiveLoadThreshold: 85,
      sustainedAttentionMinutes: 15,
      contextSwitchCostThreshold: 20,
      processingSpeedWindow: 30,
      inhibitionResponseTime: 5,
      ...config
    };
  }

  /**
   * Assess executive function patterns from biometric data
   */
  async assessExecutiveFunction(stream: BiometricDataPoint[]): Promise<ExecutiveFunctionPattern> {
    const avgCognitiveLoad = this.calculateAverageCognitiveLoad(stream);
    const peakLoadDuration = this.calculatePeakLoadDuration(stream);
    const taskCompletionRate = this.estimateTaskCompletionRate(stream);
    const workingMemoryLoad = this.assessWorkingMemoryLoad(stream);
    const planningEfficiency = this.assessPlanningEfficiency(stream);
    const inhibitionControl = this.assessInhibitionControl(stream);
    const cognitiveFlexibility = this.assessCognitiveFlexibility(stream);
    const processingSpeed = this.assessProcessingSpeed(stream);

    return {
      avgCognitiveLoad,
      peakLoadDuration,
      taskCompletionRate,
      workingMemoryLoad,
      planningEfficiency,
      inhibitionControl,
      cognitiveFlexibility,
      processingSpeed
    };
  }

  /**
   * Calculate average cognitive load across the stream
   */
  private calculateAverageCognitiveLoad(stream: BiometricDataPoint[]): number {
    if (stream.length === 0) return 0;
    
    const totalLoad = stream.reduce((sum, point) => sum + point.cognitiveLoad, 0);
    return totalLoad / stream.length;
  }

  /**
   * Calculate how long cognitive load stays at peak levels
   */
  private calculatePeakLoadDuration(stream: BiometricDataPoint[]): number {
    let peakDuration = 0;
    let currentDuration = 0;
    
    for (const point of stream) {
      if (point.cognitiveLoad > this.config.highCognitiveLoadThreshold) {
        currentDuration += 1; // Assuming 1-minute intervals
      } else {
        peakDuration = Math.max(peakDuration, currentDuration);
        currentDuration = 0;
      }
    }
    
    return Math.max(peakDuration, currentDuration);
  }

  /**
   * Estimate task completion rate based on sustained attention periods
   */
  private estimateTaskCompletionRate(stream: BiometricDataPoint[]): number {
    const sustainedPeriods = this.findSustainedAttentionPeriods(stream);
    const totalTime = stream.length > 0 ? 
      (stream[stream.length - 1].timestamp - stream[0].timestamp) / (1000 * 60 * 60) : 1;
    
    return sustainedPeriods.length / totalTime; // Tasks per hour
  }

  /**
   * Find periods of sustained attention
   */
  private findSustainedAttentionPeriods(stream: BiometricDataPoint[]): Array<{start: number, end: number, quality: number}> {
    const periods: Array<{start: number, end: number, quality: number}> = [];
    let currentPeriod: {start: number, end: number, attentionSum: number, count: number} | null = null;
    
    const sustainedThreshold = 70; // Minimum attention level for sustained focus
    const minDuration = this.config.sustainedAttentionMinutes * 60 * 1000; // Convert to milliseconds
    
    for (let i = 0; i < stream.length; i++) {
      const point = stream[i];
      
      if (point.attentionLevel >= sustainedThreshold) {
        if (!currentPeriod) {
          currentPeriod = {
            start: point.timestamp,
            end: point.timestamp,
            attentionSum: point.attentionLevel,
            count: 1
          };
        } else {
          currentPeriod.end = point.timestamp;
          currentPeriod.attentionSum += point.attentionLevel;
          currentPeriod.count++;
        }
      } else if (currentPeriod) {
        // End current period if it meets minimum duration
        const duration = currentPeriod.end - currentPeriod.start;
        if (duration >= minDuration) {
          const quality = currentPeriod.attentionSum / currentPeriod.count;
          periods.push({
            start: currentPeriod.start,
            end: currentPeriod.end,
            quality
          });
        }
        currentPeriod = null;
      }
    }
    
    // Handle ongoing period at end of stream
    if (currentPeriod) {
      const duration = currentPeriod.end - currentPeriod.start;
      if (duration >= minDuration) {
        const quality = currentPeriod.attentionSum / currentPeriod.count;
        periods.push({
          start: currentPeriod.start,
          end: currentPeriod.end,
          quality
        });
      }
    }
    
    return periods;
  }

  /**
   * Assess working memory load based on cognitive load and context switching
   */
  private assessWorkingMemoryLoad(stream: BiometricDataPoint[]): number {
    const avgCognitiveLoad = this.calculateAverageCognitiveLoad(stream);
    const contextSwitches = this.countContextSwitches(stream);
    const totalTime = stream.length > 0 ? 
      (stream[stream.length - 1].timestamp - stream[0].timestamp) / (1000 * 60 * 60) : 1;
    
    const switchRate = contextSwitches / totalTime; // switches per hour
    const switchPenalty = Math.min(30, switchRate * 3); // Cap penalty at 30 points
    
    return Math.min(100, avgCognitiveLoad + switchPenalty);
  }

  /**
   * Count context switches in the stream
   */
  private countContextSwitches(stream: BiometricDataPoint[]): number {
    let switches = 0;
    let previousContext = null;
    
    for (const point of stream) {
      if (point.contextId && point.contextId !== previousContext) {
        if (previousContext !== null) { // Don't count the first context as a switch
          switches++;
        }
        previousContext = point.contextId;
      }
    }
    
    return switches;
  }

  /**
   * Assess planning efficiency based on task progression and preparation phases
   */
  private assessPlanningEfficiency(stream: BiometricDataPoint[]): number {
    // Look for patterns that indicate good planning:
    // 1. Lower cognitive load at task start (preparation)
    // 2. Gradual ramp-up rather than sudden spikes
    // 3. Sustained performance without dramatic fluctuations
    
    const taskSegments = this.identifyTaskSegments(stream);
    let totalEfficiency = 0;
    let count = 0;
    
    for (const segment of taskSegments) {
      const efficiency = this.calculateSegmentPlanningEfficiency(segment);
      totalEfficiency += efficiency;
      count++;
    }
    
    return count > 0 ? totalEfficiency / count : 50; // Default to middle score
  }

  /**
   * Identify distinct task segments in the stream
   */
  private identifyTaskSegments(stream: BiometricDataPoint[]): BiometricDataPoint[][] {
    const segments: BiometricDataPoint[][] = [];
    let currentSegment: BiometricDataPoint[] = [];
    let lastContext = null;
    
    for (const point of stream) {
      if (point.contextId !== lastContext) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = [point];
        lastContext = point.contextId;
      } else {
        currentSegment.push(point);
      }
    }
    
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    return segments.filter(segment => segment.length >= 5); // Minimum 5 points for analysis
  }

  /**
   * Calculate planning efficiency for a task segment
   */
  private calculateSegmentPlanningEfficiency(segment: BiometricDataPoint[]): number {
    if (segment.length < 5) return 50;
    
    // Analyze the first 20% of the segment for preparation indicators
    const preparationSize = Math.max(1, Math.floor(segment.length * 0.2));
    const preparation = segment.slice(0, preparationSize);
    const execution = segment.slice(preparationSize);
    
    // Good planning indicators:
    const avgPrepCognitiveLoad = preparation.reduce((sum, p) => sum + p.cognitiveLoad, 0) / preparation.length;
    const avgExecCognitiveLoad = execution.reduce((sum, p) => sum + p.cognitiveLoad, 0) / execution.length;
    
    // Gradual ramp-up is good (preparation load < execution load, but not too much difference)
    const rampUpScore = this.calculateRampUpScore(avgPrepCognitiveLoad, avgExecCognitiveLoad);
    
    // Consistency during execution
    const executionConsistency = this.calculateConsistency(execution.map(p => p.attentionLevel));
    
    // Stress management during planning
    const avgPrepStress = preparation.reduce((sum, p) => sum + p.stressLevel, 0) / preparation.length;
    const stressScore = Math.max(0, 100 - avgPrepStress);
    
    return (rampUpScore * 0.4 + executionConsistency * 0.4 + stressScore * 0.2);
  }

  /**
   * Calculate ramp-up score for planning efficiency
   */
  private calculateRampUpScore(prepLoad: number, execLoad: number): number {
    const difference = execLoad - prepLoad;
    
    // Ideal difference is 10-30 points (indicates good preparation)
    if (difference >= 10 && difference <= 30) {
      return 100;
    } else if (difference >= 0 && difference < 10) {
      return 70; // Some preparation, but could be better
    } else if (difference > 30) {
      return 50; // Poor preparation, sudden high load
    } else {
      return 30; // Execution load lower than prep (possibly over-prepared or distracted)
    }
  }

  /**
   * Calculate consistency of values
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
   * Assess inhibition control based on impulse responses and distraction resistance
   */
  private assessInhibitionControl(stream: BiometricDataPoint[]): number {
    // Look for patterns indicating good inhibition control:
    // 1. Resistance to attention drops during sustained tasks
    // 2. Quick recovery from distractions
    // 3. Stable cognitive load despite environmental changes
    
    let inhibitionEvents = 0;
    let totalEvents = 0;
    
    for (let i = 1; i < stream.length - 1; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      const next = stream[i + 1];
      
      // Detect potential distraction moments (sudden attention drop)
      if (prev.attentionLevel > 70 && current.attentionLevel < 50) {
        totalEvents++;
        
        // Check for quick recovery (within next few points)
        const recoveryWindow = Math.min(stream.length - 1, i + this.config.inhibitionResponseTime);
        let recovered = false;
        
        for (let j = i + 1; j <= recoveryWindow; j++) {
          if (stream[j].attentionLevel > 65) {
            recovered = true;
            break;
          }
        }
        
        if (recovered) {
          inhibitionEvents++;
        }
      }
    }
    
    if (totalEvents === 0) return 80; // Default good score if no distractions detected
    
    const inhibitionRate = inhibitionEvents / totalEvents;
    return inhibitionRate * 100;
  }

  /**
   * Assess cognitive flexibility based on successful context switches and adaptation
   */
  private assessCognitiveFlexibility(stream: BiometricDataPoint[]): number {
    const contextSwitches = this.findContextSwitches(stream);
    let successfulSwitches = 0;
    
    for (const switchData of contextSwitches) {
      const cost = this.calculateSwitchingCost(stream, switchData.index);
      if (cost < this.config.contextSwitchCostThreshold) {
        successfulSwitches++;
      }
    }
    
    if (contextSwitches.length === 0) return 70; // Default score if no switches
    
    const flexibilityRate = successfulSwitches / contextSwitches.length;
    return flexibilityRate * 100;
  }

  /**
   * Find context switches with their indices
   */
  private findContextSwitches(stream: BiometricDataPoint[]): Array<{index: number, fromContext: string, toContext: string}> {
    const switches: Array<{index: number, fromContext: string, toContext: string}> = [];
    
    for (let i = 1; i < stream.length; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      
      if (prev.contextId && current.contextId && prev.contextId !== current.contextId) {
        switches.push({
          index: i,
          fromContext: prev.contextId,
          toContext: current.contextId
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
   * Assess processing speed based on response times and task completion patterns
   */
  private assessProcessingSpeed(stream: BiometricDataPoint[]): number {
    // Look for patterns indicating processing speed:
    // 1. Quick attention engagement (fast rise to high attention)
    // 2. Rapid task transitions
    // 3. Consistent performance without prolonged ramp-up periods
    
    const engagementSpeeds = this.calculateEngagementSpeeds(stream);
    const transitionSpeeds = this.calculateTransitionSpeeds(stream);
    
    const avgEngagementSpeed = engagementSpeeds.reduce((sum, speed) => sum + speed, 0) / 
                              Math.max(1, engagementSpeeds.length);
    const avgTransitionSpeed = transitionSpeeds.reduce((sum, speed) => sum + speed, 0) / 
                              Math.max(1, transitionSpeeds.length);
    
    // Convert speeds to scores (higher speed = higher score)
    const engagementScore = Math.min(100, avgEngagementSpeed * 10);
    const transitionScore = Math.min(100, avgTransitionSpeed * 10);
    
    return (engagementScore * 0.6 + transitionScore * 0.4);
  }

  /**
   * Calculate speeds of attention engagement
   */
  private calculateEngagementSpeeds(stream: BiometricDataPoint[]): number[] {
    const speeds: number[] = [];
    
    for (let i = 1; i < stream.length; i++) {
      const prev = stream[i - 1];
      const current = stream[i];
      
      // Look for rapid attention increases
      if (prev.attentionLevel < 50 && current.attentionLevel > 70) {
        const timeDiff = (current.timestamp - prev.timestamp) / 1000; // seconds
        const attentionIncrease = current.attentionLevel - prev.attentionLevel;
        const speed = attentionIncrease / timeDiff; // attention points per second
        speeds.push(speed);
      }
    }
    
    return speeds;
  }

  /**
   * Calculate speeds of task transitions
   */
  private calculateTransitionSpeeds(stream: BiometricDataPoint[]): number[] {
    const speeds: number[] = [];
    const contextSwitches = this.findContextSwitches(stream);
    
    for (const switchData of contextSwitches) {
      const switchIndex = switchData.index;
      
      // Look at the window after the switch to see how quickly performance recovers
      const recoveryWindow = Math.min(stream.length - switchIndex, this.config.processingSpeedWindow);
      let timeToRecover = recoveryWindow;
      
      const targetAttention = 70; // Target attention level after switch
      
      for (let i = switchIndex; i < switchIndex + recoveryWindow; i++) {
        if (stream[i].attentionLevel >= targetAttention) {
          timeToRecover = i - switchIndex;
          break;
        }
      }
      
      // Convert to speed (faster recovery = higher speed)
      const speed = recoveryWindow / Math.max(1, timeToRecover);
      speeds.push(speed);
    }
    
    return speeds;
  }

  /**
   * Generate comprehensive executive function metrics and recommendations
   */
  generateExecutiveFunctionMetrics(pattern: ExecutiveFunctionPattern): ExecutiveFunctionMetrics {
    const scores = [
      pattern.planningEfficiency,
      pattern.inhibitionControl,
      pattern.cognitiveFlexibility,
      pattern.processingSpeed,
      Math.max(0, 100 - pattern.workingMemoryLoad)
    ];
    
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    const strengths: string[] = [];
    const challenges: string[] = [];
    const recommendations: string[] = [];
    const supportStrategies: string[] = [];
    
    // Analyze strengths
    if (pattern.planningEfficiency > 75) strengths.push('Strong planning and preparation');
    if (pattern.inhibitionControl > 75) strengths.push('Good impulse control and focus');
    if (pattern.cognitiveFlexibility > 75) strengths.push('Excellent task switching ability');
    if (pattern.processingSpeed > 75) strengths.push('Fast information processing');
    if (pattern.workingMemoryLoad < 60) strengths.push('Efficient working memory usage');
    
    // Analyze challenges
    if (pattern.planningEfficiency < 50) challenges.push('Difficulty with planning and preparation');
    if (pattern.inhibitionControl < 50) challenges.push('Challenges with impulse control');
    if (pattern.cognitiveFlexibility < 50) challenges.push('Difficulty adapting to changes');
    if (pattern.processingSpeed < 50) challenges.push('Slower information processing');
    if (pattern.workingMemoryLoad > 80) challenges.push('Working memory overload');
    
    // Generate recommendations
    if (pattern.planningEfficiency < 60) {
      recommendations.push('Use visual planning tools and break tasks into smaller steps');
      supportStrategies.push('task_breakdown');
    }
    if (pattern.inhibitionControl < 60) {
      recommendations.push('Practice mindfulness and use distraction-blocking techniques');
      supportStrategies.push('distraction_management');
    }
    if (pattern.cognitiveFlexibility < 60) {
      recommendations.push('Prepare for transitions and use transition routines');
      supportStrategies.push('transition_support');
    }
    if (pattern.processingSpeed < 60) {
      recommendations.push('Allow extra time for tasks and reduce time pressure');
      supportStrategies.push('extended_time');
    }
    if (pattern.workingMemoryLoad > 70) {
      recommendations.push('Use external memory aids and reduce cognitive load');
      supportStrategies.push('memory_aids');
    }
    
    return {
      overallScore,
      strengths,
      challenges,
      recommendations,
      supportStrategies
    };
  }

  /**
   * Analyze task performance patterns
   */
  analyzeTaskPerformance(stream: BiometricDataPoint[]): TaskPerformanceData[] {
    const taskSegments = this.identifyTaskSegments(stream);
    const performances: TaskPerformanceData[] = [];
    
    for (const segment of taskSegments) {
      if (segment.length < 3) continue;
      
      const taskType = segment[0].contextId || 'unknown';
      const duration = segment[segment.length - 1].timestamp - segment[0].timestamp;
      const cognitiveLoadPattern = segment.map(p => p.cognitiveLoad);
      const attentionLevels = segment.map(p => p.attentionLevel);
      const avgAttention = attentionLevels.reduce((sum, a) => sum + a, 0) / attentionLevels.length;
      
      // Estimate completion rate based on sustained attention
      const completionRate = avgAttention / 100;
      
      // Calculate attention sustainability
      const attentionSustainability = this.calculateConsistency(attentionLevels);
      
      // Count context switches within this task
      const contextSwitches = this.countInternalSwitches(segment);
      
      // Estimate error rate based on cognitive load variability
      const errorRate = this.estimateErrorRate(cognitiveLoadPattern, attentionLevels);
      
      performances.push({
        taskType,
        duration,
        completionRate,
        cognitiveLoadPattern,
        attentionSustainability,
        contextSwitches,
        errorRate
      });
    }
    
    return performances;
  }

  /**
   * Count context switches within a task segment
   */
  private countInternalSwitches(segment: BiometricDataPoint[]): number {
    // This could be enhanced to detect micro-switches within the same task
    return 0; // Placeholder
  }

  /**
   * Estimate error rate based on cognitive patterns
   */
  private estimateErrorRate(cognitiveLoad: number[], attention: number[]): number {
    // High cognitive load + low attention = higher error probability
    let riskPoints = 0;
    
    for (let i = 0; i < cognitiveLoad.length; i++) {
      if (cognitiveLoad[i] > 90 && attention[i] < 50) {
        riskPoints++;
      }
    }
    
    return (riskPoints / cognitiveLoad.length) * 100;
  }
}