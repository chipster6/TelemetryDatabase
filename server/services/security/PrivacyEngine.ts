import { EventEmitter } from 'events';
import { BiometricDataPoint } from '../BiometricPipelineService';

export interface DifferentialPrivacyConfig {
  epsilon: number;
  delta: number;
  sensitivity: number;
  noiseType: 'laplacian' | 'gaussian';
}

export interface AnonymizationConfig {
  preserveFields: string[];
  hashFields: string[];
  removeFields: string[];
  noiseFields: string[];
}

export interface PrivacyMetrics {
  privacyApplications: number;
  anonymizationOperations: number;
  datasetProtections: number;
  failedOperations: number;
  averageProcessingTime: number;
}

export interface PrivacyResult {
  success: boolean;
  protectedData?: BiometricDataPoint | BiometricDataPoint[];
  privacyLevel: number;
  error?: string;
  processingTime: number;
}

/**
 * Comprehensive privacy protection engine implementing differential privacy,
 * data anonymization, and advanced privacy-preserving techniques
 */
export class PrivacyEngine extends EventEmitter {
  private defaultEpsilon: number = 1.0;
  private defaultDelta: number = 1e-5;
  private metrics: PrivacyMetrics;
  private processingTimes: number[] = [];

  constructor() {
    super();
    
    this.metrics = {
      privacyApplications: 0,
      anonymizationOperations: 0,
      datasetProtections: 0,
      failedOperations: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Apply differential privacy to a single data point
   */
  async applyDifferentialPrivacy(
    data: BiometricDataPoint,
    config?: Partial<DifferentialPrivacyConfig>
  ): Promise<PrivacyResult> {
    const startTime = Date.now();
    
    try {
      const epsilon = config?.epsilon || this.defaultEpsilon;
      const sensitivity = config?.sensitivity || 1.0;
      const noiseType = config?.noiseType || 'laplacian';
      
      this.validateDifferentialPrivacyConfig({ epsilon, sensitivity, noiseType });
      
      const protectedData: BiometricDataPoint = {
        ...data,
        heartRate: this.addNoise(data.heartRate, sensitivity, epsilon, noiseType),
        hrv: this.addNoise(data.hrv, sensitivity, epsilon, noiseType),
        cognitiveLoad: this.addNoise(data.cognitiveLoad, sensitivity, epsilon, noiseType),
        attentionLevel: this.addNoise(data.attentionLevel, sensitivity, epsilon, noiseType),
        stressLevel: this.addNoise(data.stressLevel, sensitivity, epsilon, noiseType),
        skinTemperature: data.skinTemperature ? 
          this.addNoise(data.skinTemperature, sensitivity, epsilon, noiseType) : 
          data.skinTemperature
      };
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics('privacy', processingTime);
      
      this.emit('privacyApplied', {
        epsilon,
        noiseType,
        sensitivity,
        processingTime,
        userId: data.userId
      });
      
      return {
        success: true,
        protectedData,
        privacyLevel: this.calculatePrivacyLevel(epsilon, config?.delta || this.defaultDelta),
        processingTime
      };
      
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('privacyFailed', { error, data, config });
      
      return {
        success: false,
        privacyLevel: 0,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Apply differential privacy to a dataset
   */
  async applyDatasetPrivacy(
    dataset: BiometricDataPoint[],
    config: DifferentialPrivacyConfig
  ): Promise<PrivacyResult> {
    const startTime = Date.now();
    
    try {
      this.validateDifferentialPrivacyConfig(config);
      
      if (dataset.length === 0) {
        throw new Error('Empty dataset provided');
      }
      
      const protectedDataset: BiometricDataPoint[] = [];
      
      for (const dataPoint of dataset) {
        const result = await this.applyDifferentialPrivacy(dataPoint, config);
        if (!result.success) {
          throw new Error(`Failed to protect data point: ${result.error}`);
        }
        protectedDataset.push(result.protectedData as BiometricDataPoint);
      }
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics('dataset', processingTime);
      
      this.emit('datasetProtected', {
        datasetSize: dataset.length,
        epsilon: config.epsilon,
        noiseType: config.noiseType,
        processingTime
      });
      
      return {
        success: true,
        protectedData: protectedDataset,
        privacyLevel: this.calculatePrivacyLevel(config.epsilon, config.delta),
        processingTime
      };
      
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('datasetProtectionFailed', { error, dataset, config });
      
      return {
        success: false,
        privacyLevel: 0,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Anonymize biometric data by removing or obfuscating identifying information
   */
  async anonymizeData(
    data: BiometricDataPoint,
    config?: Partial<AnonymizationConfig>
  ): Promise<PrivacyResult> {
    const startTime = Date.now();
    
    try {
      const anonymizationConfig: AnonymizationConfig = {
        preserveFields: ['timestamp', 'heartRate', 'cognitiveLoad', 'attentionLevel', 'stressLevel'],
        hashFields: ['userId', 'sessionId'],
        removeFields: ['deviceId'],
        noiseFields: [],
        ...config
      };
      
      const anonymizedData = { ...data };
      
      // Remove specified fields
      for (const field of anonymizationConfig.removeFields) {
        delete anonymizedData[field];
      }
      
      // Hash specified fields
      for (const field of anonymizationConfig.hashFields) {
        if (anonymizedData[field]) {
          anonymizedData[field] = this.generateAnonymousHash(anonymizedData[field].toString());
        }
      }
      
      // Add noise to specified fields
      for (const field of anonymizationConfig.noiseFields) {
        if (typeof anonymizedData[field] === 'number') {
          anonymizedData[field] = this.addNoise(anonymizedData[field], 1.0, 1.0, 'laplacian');
        }
      }
      
      // Generate anonymous context ID
      if (anonymizedData.contextId) {
        anonymizedData.contextId = this.generateAnonymousHash(anonymizedData.contextId);
      }
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics('anonymization', processingTime);
      
      this.emit('dataAnonymized', {
        originalUserId: data.userId,
        anonymizedUserId: anonymizedData.userId,
        fieldsRemoved: anonymizationConfig.removeFields.length,
        fieldsHashed: anonymizationConfig.hashFields.length,
        processingTime
      });
      
      return {
        success: true,
        protectedData: anonymizedData,
        privacyLevel: this.calculateAnonymizationLevel(anonymizationConfig),
        processingTime
      };
      
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('anonymizationFailed', { error, data, config });
      
      return {
        success: false,
        privacyLevel: 0,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Apply k-anonymity to a dataset
   */
  async applyKAnonymity(
    dataset: BiometricDataPoint[],
    k: number,
    quasiIdentifiers: string[]
  ): Promise<PrivacyResult> {
    const startTime = Date.now();
    
    try {
      if (k < 2) {
        throw new Error('k-anonymity requires k >= 2');
      }
      
      if (dataset.length < k) {
        throw new Error(`Dataset too small for ${k}-anonymity (need at least ${k} records)`);
      }
      
      // Group records by quasi-identifiers
      const groups = this.groupByQuasiIdentifiers(dataset, quasiIdentifiers);
      
      // Ensure each group has at least k records
      const anonymizedDataset = this.enforceKAnonymity(groups, k);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics('dataset', processingTime);
      
      this.emit('kAnonymityApplied', {
        k,
        quasiIdentifiers,
        originalSize: dataset.length,
        anonymizedSize: anonymizedDataset.length,
        processingTime
      });
      
      return {
        success: true,
        protectedData: anonymizedDataset,
        privacyLevel: this.calculateKAnonymityLevel(k),
        processingTime
      };
      
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('kAnonymityFailed', { error, dataset, k, quasiIdentifiers });
      
      return {
        success: false,
        privacyLevel: 0,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate a privacy report for a dataset
   */
  generatePrivacyReport(dataset: BiometricDataPoint[]): {
    identifiableFields: string[];
    sensitiveFields: string[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  } {
    const identifiableFields = [];
    const sensitiveFields = [];
    const recommendations = [];
    
    // Check for identifiable fields
    if (dataset.length > 0) {
      const sampleRecord = dataset[0];
      
      if (sampleRecord.userId && !this.isHashed(sampleRecord.userId)) {
        identifiableFields.push('userId');
      }
      
      if (sampleRecord.sessionId && !this.isHashed(sampleRecord.sessionId)) {
        identifiableFields.push('sessionId');
      }
      
      if (sampleRecord.deviceId) {
        identifiableFields.push('deviceId');
      }
      
      // Check for sensitive biometric fields
      sensitiveFields.push('heartRate', 'hrv', 'cognitiveLoad', 'attentionLevel', 'stressLevel');
      
      if (sampleRecord.skinTemperature) {
        sensitiveFields.push('skinTemperature');
      }
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (identifiableFields.length > 2) {
      riskLevel = 'high';
      recommendations.push('Apply strong anonymization or differential privacy');
      recommendations.push('Hash or remove direct identifiers');
    } else if (identifiableFields.length > 0) {
      riskLevel = 'medium';
      recommendations.push('Consider hashing identifiable fields');
      recommendations.push('Apply noise to sensitive measurements');
    }
    
    if (dataset.length < 100) {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
      recommendations.push('Small dataset increases re-identification risk');
    }
    
    if (riskLevel === 'low') {
      recommendations.push('Current privacy level is acceptable');
      recommendations.push('Consider periodic privacy reviews');
    }
    
    return {
      identifiableFields,
      sensitiveFields,
      riskLevel,
      recommendations
    };
  }

  /**
   * Get privacy metrics for monitoring
   */
  getMetrics(): PrivacyMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset privacy metrics
   */
  resetMetrics(): void {
    this.metrics = {
      privacyApplications: 0,
      anonymizationOperations: 0,
      datasetProtections: 0,
      failedOperations: 0,
      averageProcessingTime: 0
    };
    
    this.processingTimes = [];
    this.emit('metricsReset', { timestamp: Date.now() });
  }

  // ==================== Private Methods ====================

  /**
   * Add differential privacy noise to a value
   */
  private addNoise(
    value: number,
    sensitivity: number,
    epsilon: number,
    noiseType: 'laplacian' | 'gaussian'
  ): number {
    const scale = sensitivity / epsilon;
    
    let noise: number;
    if (noiseType === 'laplacian') {
      noise = this.laplacianNoise(0, scale);
    } else {
      noise = this.gaussianNoise(0, scale);
    }
    
    return Math.max(0, value + noise);
  }

  /**
   * Generate Laplacian noise
   */
  private laplacianNoise(mean: number, scale: number): number {
    const u = Math.random() - 0.5;
    return mean - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Generate Gaussian noise using Box-Muller transformation
   */
  private gaussianNoise(mean: number, scale: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + scale * z;
  }

  /**
   * Generate anonymous hash for identifiers
   */
  private generateAnonymousHash(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value + 'privacy_salt').digest('hex').substring(0, 16);
  }

  /**
   * Check if a value appears to be hashed
   */
  private isHashed(value: string): boolean {
    // Simple heuristic: hexadecimal string of reasonable length
    return /^[a-f0-9]{16,64}$/i.test(value);
  }

  /**
   * Group dataset by quasi-identifiers for k-anonymity
   */
  private groupByQuasiIdentifiers(
    dataset: BiometricDataPoint[],
    quasiIdentifiers: string[]
  ): Map<string, BiometricDataPoint[]> {
    const groups = new Map<string, BiometricDataPoint[]>();
    
    for (const record of dataset) {
      const key = quasiIdentifiers
        .map(field => record[field]?.toString() || '')
        .join('|');
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }
    
    return groups;
  }

  /**
   * Enforce k-anonymity by suppressing small groups
   */
  private enforceKAnonymity(
    groups: Map<string, BiometricDataPoint[]>,
    k: number
  ): BiometricDataPoint[] {
    const anonymizedDataset: BiometricDataPoint[] = [];
    
    for (const [key, group] of groups.entries()) {
      if (group.length >= k) {
        anonymizedDataset.push(...group);
      }
      // Small groups are suppressed (not included in result)
    }
    
    return anonymizedDataset;
  }

  /**
   * Calculate privacy level based on epsilon and delta
   */
  private calculatePrivacyLevel(epsilon: number, delta: number): number {
    // Higher epsilon = lower privacy, lower epsilon = higher privacy
    // Privacy level: 0-1 scale where 1 is maximum privacy
    const epsilonFactor = Math.max(0, 1 - epsilon / 10); // Normalize epsilon
    const deltaFactor = Math.max(0, 1 - delta * 1000000); // Normalize delta
    return (epsilonFactor + deltaFactor) / 2;
  }

  /**
   * Calculate anonymization level based on configuration
   */
  private calculateAnonymizationLevel(config: AnonymizationConfig): number {
    const totalFields = config.preserveFields.length + config.hashFields.length + 
                       config.removeFields.length + config.noiseFields.length;
    
    const protectedFields = config.hashFields.length + config.removeFields.length + 
                           config.noiseFields.length;
    
    return totalFields > 0 ? protectedFields / totalFields : 0;
  }

  /**
   * Calculate k-anonymity privacy level
   */
  private calculateKAnonymityLevel(k: number): number {
    // Higher k = higher privacy
    return Math.min(1, Math.log(k) / Math.log(100)); // Normalize to 0-1 scale
  }

  /**
   * Validate differential privacy configuration
   */
  private validateDifferentialPrivacyConfig(config: Partial<DifferentialPrivacyConfig>): void {
    if (config.epsilon !== undefined && (config.epsilon <= 0 || config.epsilon > 10)) {
      throw new Error('Epsilon must be between 0 and 10');
    }
    
    if (config.delta !== undefined && (config.delta <= 0 || config.delta >= 1)) {
      throw new Error('Delta must be between 0 and 1');
    }
    
    if (config.sensitivity !== undefined && config.sensitivity <= 0) {
      throw new Error('Sensitivity must be positive');
    }
  }

  /**
   * Update privacy metrics
   */
  private updateMetrics(operation: 'privacy' | 'anonymization' | 'dataset', processingTime: number): void {
    switch (operation) {
      case 'privacy':
        this.metrics.privacyApplications++;
        break;
      case 'anonymization':
        this.metrics.anonymizationOperations++;
        break;
      case 'dataset':
        this.metrics.datasetProtections++;
        break;
    }
    
    this.processingTimes.push(processingTime);
    
    // Keep only recent times for performance
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
    
    // Update average processing time
    const totalOperations = this.metrics.privacyApplications + 
                           this.metrics.anonymizationOperations + 
                           this.metrics.datasetProtections;
    
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (totalOperations - 1) + processingTime) / totalOperations;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.processingTimes = [];
  }
}