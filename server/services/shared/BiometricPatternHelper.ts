/**
 * Shared Biometric Pattern Analysis Helper
 * Consolidates common biometric pattern analysis logic between services
 * TODO: Further consolidation needed between weaviate.service.ts and nexis-brain.ts
 */

export interface BiometricRange {
  heartRate: [number, number];
  hrv: [number, number];
  stressLevel: [number, number];
  attentionLevel: [number, number];
  cognitiveLoad: [number, number];
  flowState: [number, number];
}

export interface BiometricPattern {
  patternId: string;
  patternName: string;
  description: string;
  biometricRanges: BiometricRange;
  successRate: number;
  optimalStrategies: string[];
  triggerConditions?: string[];
}

export class BiometricPatternHelper {
  /**
   * Calculate biometric similarity between two biometric states
   */
  static calculateBiometricSimilarity(
    current: any, 
    historical: any, 
    threshold: number = 0.8
  ): number {
    const metrics = ['heartRate', 'hrv', 'stressLevel', 'attentionLevel', 'cognitiveLoad', 'flowState'];
    let totalSimilarity = 0;
    let validMetrics = 0;

    for (const metric of metrics) {
      if (current[metric] !== undefined && historical[metric] !== undefined) {
        const currentVal = current[metric];
        const historicalVal = historical[metric];
        const maxVal = Math.max(currentVal, historicalVal);
        const minVal = Math.min(currentVal, historicalVal);
        
        if (maxVal > 0) {
          const similarity = minVal / maxVal;
          totalSimilarity += similarity;
          validMetrics++;
        }
      }
    }

    return validMetrics > 0 ? totalSimilarity / validMetrics : 0;
  }

  /**
   * Check if current biometrics fall within a pattern's ranges
   */
  static matchesPattern(current: any, pattern: BiometricRange): boolean {
    const metrics: (keyof BiometricRange)[] = ['heartRate', 'hrv', 'stressLevel', 'attentionLevel', 'cognitiveLoad', 'flowState'];
    
    return metrics.every(metric => {
      const value = current[metric];
      const range = pattern[metric];
      
      if (value === undefined || !range) return true; // Skip if data not available
      
      return value >= range[0] && value <= range[1];
    });
  }

  /**
   * Generate optimal strategies based on biometric state
   */
  static generateOptimalStrategies(biometrics: any): string[] {
    const strategies = [];

    // High cognitive load adaptations
    if (biometrics.cognitiveLoad > 0.8) {
      strategies.push('reduce_complexity', 'break_into_steps');
    }

    // High stress adaptations
    if (biometrics.stressLevel > 0.6) {
      strategies.push('calming_tone', 'supportive_language');
    }

    // Flow state preservation
    if (biometrics.flowState > 0.7) {
      strategies.push('maintain_momentum', 'technical_depth');
    }

    // Low attention adaptations
    if (biometrics.attentionLevel < 0.4) {
      strategies.push('increase_engagement', 'shorter_responses');
    }

    return strategies;
  }

  /**
   * Classify cognitive state based on biometric data
   */
  static classifyCognitiveState(biometrics: any): string {
    if (biometrics.flowState > 0.7) return 'high-flow';
    if (biometrics.stressLevel > 0.6) return 'elevated-stress';
    if (biometrics.attentionLevel > 0.8) return 'deep-focus';
    if (biometrics.cognitiveLoad < 0.3) return 'creative';
    return 'balanced';
  }
}

// TODO: Consolidation Plan for weaviate.service.ts and nexis-brain.ts
//
// IDENTIFIED DUPLICATIONS:
// 1. Schema creation logic (both create similar Weaviate classes)
// 2. Biometric pattern analysis (both have pattern learning algorithms)
// 3. Client management (both instantiate Weaviate clients)
// 4. Health checking (both implement health status methods)
//
// RECOMMENDED CONSOLIDATION APPROACH:
// 1. Create shared WeaviateSchemaManager for schema operations
// 2. Extract pattern analysis to BiometricPatternService
// 3. Use WeaviateClientProvider as single source of client management
// 4. Create shared HealthMonitor for service health tracking
//
// IMPACT: ~30-40% code reduction, improved maintainability
// EFFORT: 2-3 days for full consolidation
// PRIORITY: Medium (can be done post-launch for personal use)