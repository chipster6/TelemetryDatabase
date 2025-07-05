import { logger } from '../../utils/logger.js';

export interface BiometricData {
  userId: string;
  heartRate: number;
  heartRateVariability: number;
  skinConductance: number;
  brainwaveAlpha: number;
  brainwaveBeta: number;
  brainwaveTheta: number;
  brainwaveGamma: number;
  timestamp: Date;
}

export interface CognitiveState {
  cognitiveLoad: number;
  attentionLevel: number;
  flowState: boolean;
  activePatterns: string[];
  timestamp: Date;
}

export class CognitiveStateMapper {
  private readonly cognitiveThresholds = {
    lowCognitiveLoad: 0.3,
    highCognitiveLoad: 0.7,
    lowAttention: 0.4,
    highAttention: 0.8,
    flowStateThreshold: 0.75
  };

  private readonly temperatureRanges = {
    focused: { min: 0.1, max: 0.3 },      // Low temperature for focused states
    balanced: { min: 0.4, max: 0.7 },      // Medium temperature for balanced states
    creative: { min: 0.8, max: 1.0 }       // High temperature for creative states
  };

  private readonly tokenLimits = {
    lowCognitive: { min: 100, max: 300 },   // Short responses for high cognitive load
    moderate: { min: 400, max: 800 },       // Medium responses for balanced state
    detailed: { min: 1000, max: 2000 }     // Long responses for flow/focused states
  };

  mapBiometricsToCognitive(biometricData: BiometricData): CognitiveState {
    try {
      logger.debug('Mapping biometric data to cognitive state', {
        userId: biometricData.userId,
        heartRate: biometricData.heartRate,
        skinConductance: biometricData.skinConductance
      });

      // Calculate cognitive load based on multiple biometric indicators
      const cognitiveLoad = this.calculateCognitiveLoad(biometricData);
      
      // Calculate attention level from brainwave patterns
      const attentionLevel = this.calculateAttentionLevel(biometricData);
      
      // Determine flow state based on combined metrics
      const flowState = this.detectFlowState(biometricData, cognitiveLoad, attentionLevel);
      
      // Detect neurodivergent patterns
      const activePatterns = this.detectActivePatterns(biometricData);

      const cognitiveState: CognitiveState = {
        cognitiveLoad,
        attentionLevel,
        flowState,
        activePatterns,
        timestamp: new Date()
      };

      logger.debug('Cognitive state mapped', {
        userId: biometricData.userId,
        cognitiveLoad,
        attentionLevel,
        flowState,
        patterns: activePatterns
      });

      return cognitiveState;
    } catch (error) {
      logger.error('Failed to map biometrics to cognitive state:', error);
      throw new Error('Failed to process biometric data');
    }
  }

  calculateTemperature(cognitiveState: CognitiveState): number {
    try {
      let temperature = 0.5; // Default balanced temperature

      // Flow state: more focused and consistent
      if (cognitiveState.flowState) {
        temperature = this.getRandomInRange(this.temperatureRanges.focused);
      }
      // High cognitive load: more focused responses
      else if (cognitiveState.cognitiveLoad > this.cognitiveThresholds.highCognitiveLoad) {
        temperature = this.getRandomInRange(this.temperatureRanges.focused);
      }
      // Low attention: more creative to maintain engagement
      else if (cognitiveState.attentionLevel < this.cognitiveThresholds.lowAttention) {
        temperature = this.getRandomInRange(this.temperatureRanges.creative);
      }
      // Balanced state
      else {
        temperature = this.getRandomInRange(this.temperatureRanges.balanced);
      }

      // Apply neurodivergent pattern adjustments
      temperature = this.adjustTemperatureForPatterns(temperature, cognitiveState.activePatterns);

      // Ensure temperature stays within valid bounds
      return Math.max(0.1, Math.min(1.0, temperature));
    } catch (error) {
      logger.error('Failed to calculate temperature:', error);
      return 0.5; // Safe fallback
    }
  }

  calculateTokenLimit(cognitiveState: CognitiveState): number {
    try {
      let tokenLimit = 800; // Default moderate limit

      // Flow state or high attention: can handle detailed responses
      if (cognitiveState.flowState || cognitiveState.attentionLevel > this.cognitiveThresholds.highAttention) {
        tokenLimit = this.getRandomInRange(this.tokenLimits.detailed);
      }
      // High cognitive load: shorter responses
      else if (cognitiveState.cognitiveLoad > this.cognitiveThresholds.highCognitiveLoad) {
        tokenLimit = this.getRandomInRange(this.tokenLimits.lowCognitive);
      }
      // Balanced state
      else {
        tokenLimit = this.getRandomInRange(this.tokenLimits.moderate);
      }

      // Apply neurodivergent pattern adjustments
      tokenLimit = this.adjustTokenLimitForPatterns(tokenLimit, cognitiveState.activePatterns);

      return Math.max(50, Math.min(2000, tokenLimit));
    } catch (error) {
      logger.error('Failed to calculate token limit:', error);
      return 800; // Safe fallback
    }
  }

  private calculateCognitiveLoad(biometricData: BiometricData): number {
    // Normalize all values to 0-1 range
    const heartRateStress = this.normalizeHeartRate(biometricData.heartRate);
    const conductanceStress = this.normalizeSkinConductance(biometricData.skinConductance);
    const brainwaveStress = this.calculateBrainwaveStress(biometricData);
    
    // Weighted average of stress indicators
    const cognitiveLoad = (
      heartRateStress * 0.3 +
      conductanceStress * 0.3 +
      brainwaveStress * 0.4
    );

    return Math.max(0, Math.min(1, cognitiveLoad));
  }

  private calculateAttentionLevel(biometricData: BiometricData): number {
    // Beta waves indicate focused attention
    // Alpha waves indicate relaxed awareness
    // Theta waves indicate deep focus or distraction
    const betaRatio = biometricData.brainwaveBeta / (biometricData.brainwaveAlpha + biometricData.brainwaveTheta + 0.1);
    const alphaBalance = biometricData.brainwaveAlpha / (biometricData.brainwaveTheta + 0.1);
    
    // Combine metrics for attention score
    const attentionLevel = (betaRatio * 0.6 + alphaBalance * 0.4) / 2;
    
    return Math.max(0, Math.min(1, attentionLevel));
  }

  private detectFlowState(biometricData: BiometricData, cognitiveLoad: number, attentionLevel: number): boolean {
    // Flow state indicators:
    // - High attention with moderate cognitive load
    // - Balanced brainwave patterns
    // - Stable heart rate variability
    const flowMetric = (
      attentionLevel * 0.4 +
      (1 - Math.abs(cognitiveLoad - 0.5)) * 0.3 + // Optimal cognitive load around 0.5
      this.calculateBrainwaveBalance(biometricData) * 0.3
    );

    return flowMetric > this.cognitiveThresholds.flowStateThreshold;
  }

  private detectActivePatterns(biometricData: BiometricData): string[] {
    const patterns: string[] = [];

    // ADHD pattern detection
    if (this.detectADHDPattern(biometricData)) {
      patterns.push('adhd');
    }

    // Autism pattern detection
    if (this.detectAutismPattern(biometricData)) {
      patterns.push('autism');
    }

    // Dyslexia pattern detection
    if (this.detectDyslexiaPattern(biometricData)) {
      patterns.push('dyslexia');
    }

    return patterns;
  }

  private detectADHDPattern(biometricData: BiometricData): boolean {
    // ADHD indicators: high beta activity, variable attention patterns
    return biometricData.brainwaveBeta > 0.6 && 
           biometricData.heartRateVariability > 0.7;
  }

  private detectAutismPattern(biometricData: BiometricData): boolean {
    // Autism indicators: consistent patterns, high gamma activity
    return biometricData.brainwaveGamma > 0.6 && 
           biometricData.skinConductance < 0.3;
  }

  private detectDyslexiaPattern(biometricData: BiometricData): boolean {
    // Dyslexia indicators: elevated theta activity, processing differences
    return biometricData.brainwaveTheta > biometricData.brainwaveAlpha;
  }

  private normalizeHeartRate(heartRate: number): number {
    // Typical resting heart rate: 60-100 bpm
    // Stress indicators above 100 bpm
    const normalizedHR = (heartRate - 60) / 40;
    return Math.max(0, Math.min(1, normalizedHR));
  }

  private normalizeSkinConductance(skinConductance: number): number {
    // Assuming skin conductance is already normalized 0-1
    return Math.max(0, Math.min(1, skinConductance));
  }

  private calculateBrainwaveStress(biometricData: BiometricData): number {
    // High beta with low alpha often indicates stress
    const stressRatio = biometricData.brainwaveBeta / (biometricData.brainwaveAlpha + 0.1);
    return Math.max(0, Math.min(1, stressRatio - 1)); // Normalize so 1:1 ratio = 0 stress
  }

  private calculateBrainwaveBalance(biometricData: BiometricData): number {
    // Balanced brainwaves indicate optimal state
    const total = biometricData.brainwaveAlpha + biometricData.brainwaveBeta + 
                  biometricData.brainwaveTheta + biometricData.brainwaveGamma;
    
    if (total === 0) return 0;
    
    // Calculate variance from ideal distribution
    const ideal = 0.25; // Each band should be roughly 25%
    const variance = Math.abs(biometricData.brainwaveAlpha / total - ideal) +
                    Math.abs(biometricData.brainwaveBeta / total - ideal) +
                    Math.abs(biometricData.brainwaveTheta / total - ideal) +
                    Math.abs(biometricData.brainwaveGamma / total - ideal);
    
    return 1 - (variance / 2); // Convert variance to balance score
  }

  private adjustTemperatureForPatterns(temperature: number, patterns: string[]): number {
    let adjustedTemp = temperature;

    for (const pattern of patterns) {
      switch (pattern) {
        case 'adhd':
          // ADHD benefits from slightly higher creativity
          adjustedTemp += 0.1;
          break;
        case 'autism':
          // Autism often prefers more consistent, lower temperature
          adjustedTemp -= 0.1;
          break;
        case 'dyslexia':
          // Dyslexia may benefit from moderate creativity
          adjustedTemp += 0.05;
          break;
      }
    }

    return adjustedTemp;
  }

  private adjustTokenLimitForPatterns(tokenLimit: number, patterns: string[]): number {
    let adjustedLimit = tokenLimit;

    for (const pattern of patterns) {
      switch (pattern) {
        case 'adhd':
          // ADHD often prefers shorter, more digestible responses
          adjustedLimit = Math.min(adjustedLimit, 600);
          break;
        case 'autism':
          // Autism may prefer detailed responses when interested
          adjustedLimit = Math.max(adjustedLimit, 800);
          break;
        case 'dyslexia':
          // Dyslexia benefits from concise but complete responses
          adjustedLimit = Math.min(adjustedLimit, 700);
          break;
      }
    }

    return adjustedLimit;
  }

  private getRandomInRange(range: { min: number; max: number }): number {
    return range.min + Math.random() * (range.max - range.min);
  }
}