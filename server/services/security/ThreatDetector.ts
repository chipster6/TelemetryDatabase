import { EventEmitter } from 'events';
import { BiometricDataPoint } from '../BiometricPipelineService';

export interface ThreatDetectionResult {
  isThreat: boolean;
  threatType?: 'injection' | 'replay' | 'tampering' | 'anomaly';
  confidence: number;
  details: string;
  recommendedAction: string;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  description: string;
  severity: number;
  anomalyType: 'statistical' | 'physiological' | 'behavioral' | 'temporal';
}

export interface ThreatDetectionConfig {
  enableInjectionDetection: boolean;
  enableReplayDetection: boolean;
  enableTamperingDetection: boolean;
  enableAnomalyDetection: boolean;
  anomalyThreshold: number;
  maxDataPoints: number;
  replayTimeWindow: number;
}

export interface ThreatMetrics {
  threatsDetected: number;
  injectionAttempts: number;
  replayAttempts: number;
  tamperingAttempts: number;
  anomaliesDetected: number;
  falsePositives: number;
  averageDetectionTime: number;
}

export interface BiometricBaseline {
  heartRate: { mean: number; std: number };
  cognitiveLoad: { mean: number; std: number };
  attentionLevel: { mean: number; std: number };
  stressLevel: { mean: number; std: number };
  sampleCount: number;
  lastUpdated: number;
}

/**
 * Comprehensive threat detection and anomaly analysis for biometric data
 * Implements multiple detection algorithms for various attack vectors
 */
export class ThreatDetector extends EventEmitter {
  private config: ThreatDetectionConfig;
  private metrics: ThreatMetrics;
  private anomalyBaselines: Map<string, BiometricBaseline> = new Map();
  private recentData: Map<string, BiometricDataPoint[]> = new Map();
  private detectionTimes: number[] = [];
  private suspiciousPatterns: Map<string, number> = new Map();

  constructor(config: Partial<ThreatDetectionConfig> = {}) {
    super();
    
    this.config = {
      enableInjectionDetection: true,
      enableReplayDetection: true,
      enableTamperingDetection: true,
      enableAnomalyDetection: true,
      anomalyThreshold: 3.0, // Z-score threshold
      maxDataPoints: 1000,
      replayTimeWindow: 60000, // 1 minute
      ...config
    };

    this.metrics = {
      threatsDetected: 0,
      injectionAttempts: 0,
      replayAttempts: 0,
      tamperingAttempts: 0,
      anomaliesDetected: 0,
      falsePositives: 0,
      averageDetectionTime: 0
    };
  }

  /**
   * Comprehensive threat detection analysis
   */
  async detectThreats(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    const startTime = Date.now();
    
    try {
      const threats = await Promise.all([
        this.config.enableInjectionDetection ? this.detectInjectionAttack(data) : this.createNoThreatResult('injection'),
        this.config.enableReplayDetection ? this.detectReplayAttack(data) : this.createNoThreatResult('replay'),
        this.config.enableTamperingDetection ? this.detectTampering(data) : this.createNoThreatResult('tampering')
      ]);
      
      // Find the highest confidence threat
      const highestThreat = threats.reduce((max, current) => 
        current.confidence > max.confidence ? current : max
      );
      
      // Update metrics
      const detectionTime = Date.now() - startTime;
      this.updateDetectionMetrics(highestThreat, detectionTime);
      
      if (highestThreat.isThreat) {
        this.emit('threatDetected', {
          threat: highestThreat,
          data,
          timestamp: Date.now(),
          detectionTime
        });
      }
      
      return highestThreat;
      
    } catch (error) {
      this.emit('detectionError', { error, data });
      return {
        isThreat: false,
        confidence: 0,
        details: `Detection error: ${error.message}`,
        recommendedAction: 'Review detection system'
      };
    }
  }

  /**
   * Detect anomalies in biometric patterns
   */
  async analyzeAnomalies(data: BiometricDataPoint): Promise<AnomalyResult> {
    if (!this.config.enableAnomalyDetection) {
      return {
        isAnomaly: false,
        description: 'Anomaly detection disabled',
        severity: 0,
        anomalyType: 'statistical'
      };
    }
    
    try {
      const baseline = this.getOrCreateBaseline(data.userId);
      
      // Statistical anomaly detection
      const statisticalAnomaly = this.detectStatisticalAnomaly(data, baseline);
      
      // Physiological anomaly detection
      const physiologicalAnomaly = this.detectPhysiologicalAnomaly(data);
      
      // Behavioral anomaly detection
      const behavioralAnomaly = this.detectBehavioralAnomaly(data);
      
      // Temporal anomaly detection
      const temporalAnomaly = this.detectTemporalAnomaly(data);
      
      // Update baseline with new data
      this.updateBaseline(data.userId, data);
      
      // Determine the most significant anomaly
      const anomalies = [statisticalAnomaly, physiologicalAnomaly, behavioralAnomaly, temporalAnomaly];
      const mostSignificant = anomalies.reduce((max, current) => 
        current.severity > max.severity ? current : max
      );
      
      if (mostSignificant.isAnomaly) {
        this.metrics.anomaliesDetected++;
        this.emit('anomalyDetected', {
          anomaly: mostSignificant,
          data,
          baseline,
          timestamp: Date.now()
        });
      }
      
      return mostSignificant;
      
    } catch (error) {
      this.emit('anomalyError', { error, data });
      return {
        isAnomaly: false,
        description: `Anomaly detection error: ${error.message}`,
        severity: 0,
        anomalyType: 'statistical'
      };
    }
  }

  /**
   * Analyze historical patterns for threats
   */
  async analyzePatterns(userId: string, timeRange: { start: Date; end: Date }): Promise<{
    suspiciousPatterns: string[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const userPatterns = this.suspiciousPatterns.get(userId) || 0;
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const suspiciousPatterns: string[] = [];
    
    // Check for repeated suspicious activity
    if (userPatterns > 5) {
      suspiciousPatterns.push('repeated_suspicious_activity');
      riskLevel = 'high';
      recommendations.push('Implement additional authentication measures');
    } else if (userPatterns > 2) {
      suspiciousPatterns.push('moderate_suspicious_activity');
      riskLevel = 'medium';
      recommendations.push('Monitor user activity closely');
    }
    
    // Check baseline stability
    const baseline = this.anomalyBaselines.get(userId);
    if (baseline && baseline.sampleCount > 50) {
      const variability = this.calculateBaselineVariability(baseline);
      if (variability > 2.0) {
        suspiciousPatterns.push('high_baseline_variability');
        riskLevel = riskLevel === 'low' ? 'medium' : 'high';
        recommendations.push('Investigate data source consistency');
      }
    }
    
    // Check for data age
    if (baseline && (Date.now() - baseline.lastUpdated) > 7 * 24 * 60 * 60 * 1000) {
      suspiciousPatterns.push('stale_baseline_data');
      recommendations.push('Update user baseline with recent data');
    }
    
    if (suspiciousPatterns.length === 0) {
      recommendations.push('No suspicious patterns detected');
    }
    
    return {
      suspiciousPatterns,
      riskLevel,
      recommendations
    };
  }

  /**
   * Get threat detection metrics
   */
  getMetrics(): ThreatMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed detection statistics
   */
  getDetailedStats(): {
    metrics: ThreatMetrics;
    activeBaselines: number;
    recentDetectionTimes: number[];
    topThreatsDetected: Array<{ type: string; count: number }>;
  } {
    const topThreats = [
      { type: 'injection', count: this.metrics.injectionAttempts },
      { type: 'replay', count: this.metrics.replayAttempts },
      { type: 'tampering', count: this.metrics.tamperingAttempts },
      { type: 'anomaly', count: this.metrics.anomaliesDetected }
    ].sort((a, b) => b.count - a.count);
    
    return {
      metrics: this.metrics,
      activeBaselines: this.anomalyBaselines.size,
      recentDetectionTimes: this.detectionTimes.slice(-100),
      topThreatsDetected: topThreats
    };
  }

  /**
   * Reset threat detection metrics
   */
  resetMetrics(): void {
    this.metrics = {
      threatsDetected: 0,
      injectionAttempts: 0,
      replayAttempts: 0,
      tamperingAttempts: 0,
      anomaliesDetected: 0,
      falsePositives: 0,
      averageDetectionTime: 0
    };
    
    this.detectionTimes = [];
    this.emit('metricsReset', { timestamp: Date.now() });
  }

  /**
   * Update detection configuration
   */
  updateConfig(newConfig: Partial<ThreatDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  // ==================== Private Detection Methods ====================

  /**
   * Detect SQL injection and code injection patterns
   */
  private async detectInjectionAttack(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    const stringFields = [data.userId, data.sessionId, data.contextId].filter(Boolean);
    
    for (const field of stringFields) {
      if (this.containsInjectionPattern(field)) {
        this.metrics.injectionAttempts++;
        return {
          isThreat: true,
          threatType: 'injection',
          confidence: 0.9,
          details: 'Injection pattern detected in data fields',
          recommendedAction: 'Block request and log security event'
        };
      }
    }
    
    return this.createNoThreatResult('injection');
  }

  /**
   * Detect replay attacks through duplicate data analysis
   */
  private async detectReplayAttack(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    const userId = data.userId;
    const recentUserData = this.recentData.get(userId) || [];
    
    // Check for exact duplicates within time window
    const duplicates = recentUserData.filter(recent => 
      recent.timestamp !== data.timestamp &&
      Math.abs(recent.timestamp - data.timestamp) < this.config.replayTimeWindow &&
      this.areDataPointsIdentical(recent, data)
    );
    
    if (duplicates.length > 0) {
      this.metrics.replayAttempts++;
      return {
        isThreat: true,
        threatType: 'replay',
        confidence: 0.8,
        details: 'Identical data points detected within short timeframe',
        recommendedAction: 'Reject duplicate data and validate session'
      };
    }
    
    // Add to recent data and maintain size limit
    recentUserData.push(data);
    if (recentUserData.length > this.config.maxDataPoints) {
      recentUserData.shift();
    }
    this.recentData.set(userId, recentUserData);
    
    return this.createNoThreatResult('replay');
  }

  /**
   * Detect data tampering through physiological impossibilities
   */
  private async detectTampering(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    // Check for impossible physiological combinations
    const impossibleCombinations = [
      // Very high heart rate with very low stress
      data.heartRate > 180 && data.stressLevel < 10,
      // Very high cognitive load with very high attention but very low stress
      data.cognitiveLoad > 95 && data.attentionLevel > 95 && data.stressLevel < 20,
      // Perfect values (likely fabricated)
      data.heartRate === 60 && data.cognitiveLoad === 50 && data.attentionLevel === 75 && data.stressLevel === 25,
      // Impossible value combinations
      data.heartRate < 30 || data.heartRate > 250,
      data.cognitiveLoad < 0 || data.cognitiveLoad > 100,
      data.attentionLevel < 0 || data.attentionLevel > 100,
      data.stressLevel < 0 || data.stressLevel > 100
    ];
    
    if (impossibleCombinations.some(condition => condition)) {
      this.metrics.tamperingAttempts++;
      return {
        isThreat: true,
        threatType: 'tampering',
        confidence: 0.7,
        details: 'Physiologically impossible data combination detected',
        recommendedAction: 'Flag for manual review and validate data source'
      };
    }
    
    return this.createNoThreatResult('tampering');
  }

  /**
   * Detect statistical anomalies using baseline comparison
   */
  private detectStatisticalAnomaly(data: BiometricDataPoint, baseline: BiometricBaseline): AnomalyResult {
    // Calculate z-scores for key metrics
    const heartRateZ = Math.abs((data.heartRate - baseline.heartRate.mean) / baseline.heartRate.std);
    const cognitiveLoadZ = Math.abs((data.cognitiveLoad - baseline.cognitiveLoad.mean) / baseline.cognitiveLoad.std);
    const attentionZ = Math.abs((data.attentionLevel - baseline.attentionLevel.mean) / baseline.attentionLevel.std);
    const stressZ = Math.abs((data.stressLevel - baseline.stressLevel.mean) / baseline.stressLevel.std);
    
    const maxZ = Math.max(heartRateZ, cognitiveLoadZ, attentionZ, stressZ);
    
    if (maxZ > this.config.anomalyThreshold) {
      return {
        isAnomaly: true,
        description: `Extreme statistical deviation detected (z-score: ${maxZ.toFixed(2)})`,
        severity: Math.min(1.0, maxZ / 5.0),
        anomalyType: 'statistical'
      };
    }
    
    return {
      isAnomaly: false,
      description: 'No statistical anomaly detected',
      severity: 0,
      anomalyType: 'statistical'
    };
  }

  /**
   * Detect physiological anomalies
   */
  private detectPhysiologicalAnomaly(data: BiometricDataPoint): AnomalyResult {
    // Check for physiologically implausible values
    const anomalies = [];
    
    if (data.heartRate > 200 || data.heartRate < 40) {
      anomalies.push('extreme_heart_rate');
    }
    
    if (data.hrv && (data.hrv > data.heartRate * 0.8)) {
      anomalies.push('impossible_hrv_ratio');
    }
    
    if (data.cognitiveLoad > 95 && data.attentionLevel < 20) {
      anomalies.push('cognitive_attention_mismatch');
    }
    
    if (data.stressLevel > 90 && data.heartRate < 60) {
      anomalies.push('stress_heart_rate_mismatch');
    }
    
    if (anomalies.length > 0) {
      return {
        isAnomaly: true,
        description: `Physiological anomalies detected: ${anomalies.join(', ')}`,
        severity: Math.min(1.0, anomalies.length / 3),
        anomalyType: 'physiological'
      };
    }
    
    return {
      isAnomaly: false,
      description: 'No physiological anomalies detected',
      severity: 0,
      anomalyType: 'physiological'
    };
  }

  /**
   * Detect behavioral anomalies
   */
  private detectBehavioralAnomaly(data: BiometricDataPoint): AnomalyResult {
    const recentData = this.recentData.get(data.userId) || [];
    
    if (recentData.length < 5) {
      return {
        isAnomaly: false,
        description: 'Insufficient data for behavioral analysis',
        severity: 0,
        anomalyType: 'behavioral'
      };
    }
    
    // Calculate behavioral patterns
    const recentCognitive = recentData.slice(-5).map(d => d.cognitiveLoad);
    const recentAttention = recentData.slice(-5).map(d => d.attentionLevel);
    
    const cognitiveVariance = this.calculateVariance(recentCognitive);
    const attentionVariance = this.calculateVariance(recentAttention);
    
    // High variability might indicate erratic behavior
    if (cognitiveVariance > 1000 || attentionVariance > 1000) {
      return {
        isAnomaly: true,
        description: 'Unusual behavioral pattern detected (high variability)',
        severity: 0.6,
        anomalyType: 'behavioral'
      };
    }
    
    return {
      isAnomaly: false,
      description: 'Normal behavioral pattern',
      severity: 0,
      anomalyType: 'behavioral'
    };
  }

  /**
   * Detect temporal anomalies
   */
  private detectTemporalAnomaly(data: BiometricDataPoint): AnomalyResult {
    const now = Date.now();
    const dataAge = now - data.timestamp;
    
    // Data too old
    if (dataAge > 24 * 60 * 60 * 1000) {
      return {
        isAnomaly: true,
        description: 'Data timestamp is too old',
        severity: 0.8,
        anomalyType: 'temporal'
      };
    }
    
    // Data from future
    if (dataAge < -60000) { // More than 1 minute in future
      return {
        isAnomaly: true,
        description: 'Data timestamp is in the future',
        severity: 0.9,
        anomalyType: 'temporal'
      };
    }
    
    return {
      isAnomaly: false,
      description: 'Normal timestamp',
      severity: 0,
      anomalyType: 'temporal'
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Check for injection patterns in string values
   */
  private containsInjectionPattern(value: string): boolean {
    const patterns = [
      /('|(\\x27)|(\\x2D)|(-)|(%27)|(%2D))/i,
      /(\\x23)|(#)/i,
      /((\\x3D)|(=))[^\\n]*(password|pwd|pass)/i,
      /((\\x3D)|(=))[^\\n]*(id|user|account|admin)/i,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i
    ];
    
    return patterns.some(pattern => pattern.test(value));
  }

  /**
   * Check if two data points are identical
   */
  private areDataPointsIdentical(data1: BiometricDataPoint, data2: BiometricDataPoint): boolean {
    const precision = 0.01;
    
    return (
      Math.abs(data1.heartRate - data2.heartRate) < precision &&
      Math.abs(data1.cognitiveLoad - data2.cognitiveLoad) < precision &&
      Math.abs(data1.attentionLevel - data2.attentionLevel) < precision &&
      Math.abs(data1.stressLevel - data2.stressLevel) < precision
    );
  }

  /**
   * Get or create baseline for user
   */
  private getOrCreateBaseline(userId: string): BiometricBaseline {
    let baseline = this.anomalyBaselines.get(userId);
    
    if (!baseline) {
      baseline = {
        heartRate: { mean: 70, std: 15 },
        cognitiveLoad: { mean: 50, std: 20 },
        attentionLevel: { mean: 60, std: 25 },
        stressLevel: { mean: 40, std: 20 },
        sampleCount: 0,
        lastUpdated: Date.now()
      };
      this.anomalyBaselines.set(userId, baseline);
    }
    
    return baseline;
  }

  /**
   * Update user baseline with new data
   */
  private updateBaseline(userId: string, data: BiometricDataPoint): void {
    const baseline = this.anomalyBaselines.get(userId);
    if (!baseline) return;
    
    const alpha = 0.1; // Learning rate
    
    // Update means
    baseline.heartRate.mean = baseline.heartRate.mean * (1 - alpha) + data.heartRate * alpha;
    baseline.cognitiveLoad.mean = baseline.cognitiveLoad.mean * (1 - alpha) + data.cognitiveLoad * alpha;
    baseline.attentionLevel.mean = baseline.attentionLevel.mean * (1 - alpha) + data.attentionLevel * alpha;
    baseline.stressLevel.mean = baseline.stressLevel.mean * (1 - alpha) + data.stressLevel * alpha;
    
    // Update standard deviations
    baseline.heartRate.std = baseline.heartRate.std * (1 - alpha) + Math.abs(data.heartRate - baseline.heartRate.mean) * alpha;
    baseline.cognitiveLoad.std = baseline.cognitiveLoad.std * (1 - alpha) + Math.abs(data.cognitiveLoad - baseline.cognitiveLoad.mean) * alpha;
    baseline.attentionLevel.std = baseline.attentionLevel.std * (1 - alpha) + Math.abs(data.attentionLevel - baseline.attentionLevel.mean) * alpha;
    baseline.stressLevel.std = baseline.stressLevel.std * (1 - alpha) + Math.abs(data.stressLevel - baseline.stressLevel.mean) * alpha;
    
    baseline.sampleCount++;
    baseline.lastUpdated = Date.now();
  }

  /**
   * Calculate variance of an array
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Calculate baseline variability
   */
  private calculateBaselineVariability(baseline: BiometricBaseline): number {
    const coefficients = [
      baseline.heartRate.std / baseline.heartRate.mean,
      baseline.cognitiveLoad.std / baseline.cognitiveLoad.mean,
      baseline.attentionLevel.std / baseline.attentionLevel.mean,
      baseline.stressLevel.std / baseline.stressLevel.mean
    ];
    
    return coefficients.reduce((sum, coef) => sum + coef, 0) / coefficients.length;
  }

  /**
   * Create a no-threat result
   */
  private createNoThreatResult(threatType: 'injection' | 'replay' | 'tampering'): ThreatDetectionResult {
    return {
      isThreat: false,
      threatType,
      confidence: 0,
      details: `No ${threatType} threat detected`,
      recommendedAction: 'Continue processing'
    };
  }

  /**
   * Update detection metrics
   */
  private updateDetectionMetrics(threat: ThreatDetectionResult, detectionTime: number): void {
    this.detectionTimes.push(detectionTime);
    
    // Keep only recent times for performance
    if (this.detectionTimes.length > 1000) {
      this.detectionTimes.shift();
    }
    
    // Update average detection time
    const totalDetections = this.detectionTimes.length;
    this.metrics.averageDetectionTime = 
      (this.metrics.averageDetectionTime * (totalDetections - 1) + detectionTime) / totalDetections;
    
    if (threat.isThreat) {
      this.metrics.threatsDetected++;
    }
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.anomalyBaselines.clear();
    this.recentData.clear();
    this.suspiciousPatterns.clear();
    this.detectionTimes = [];
    this.removeAllListeners();
  }
}