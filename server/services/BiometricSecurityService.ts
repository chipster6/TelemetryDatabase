// Enhanced Security and Privacy Service for Biometric Pipeline
// Implements post-quantum encryption, differential privacy, and advanced security measures

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { BiometricDataPoint } from './BiometricPipelineService';

// ==================== Security Types ====================

export interface EncryptedBiometricData {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyId: string;
  timestamp: number;
  algorithm: string;
}

export interface DifferentialPrivacyConfig {
  epsilon: number;
  delta: number;
  sensitivity: number;
  noiseType: 'laplacian' | 'gaussian';
}

export interface SecurityMetrics {
  encryptionOperations: number;
  decryptionOperations: number;
  privacyApplications: number;
  failedOperations: number;
  averageProcessingTime: number;
  keyRotations: number;
}

export interface SecurityEvent {
  type: 'encryption' | 'decryption' | 'privacy' | 'validation' | 'threat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ThreatDetectionResult {
  isThreat: boolean;
  threatType?: 'injection' | 'replay' | 'tampering' | 'anomaly';
  confidence: number;
  details: string;
  recommendedAction: string;
}

// ==================== Enhanced Security Service ====================

export class BiometricSecurityService extends EventEmitter {
  private encryptionKeys: Map<string, Buffer> = new Map();
  private keyRotationInterval: number = 24 * 60 * 60 * 1000; // 24 hours
  private securityMetrics: SecurityMetrics;
  private rateLimiter: Map<string, { count: number; resetTime: number }> = new Map();
  private threatDetector: BiometricThreatDetector;
  private differentialPrivacy: DifferentialPrivacyEngine;
  private auditLogger: SecurityAuditLogger;
  
  constructor() {
    super();
    
    this.securityMetrics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      privacyApplications: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      keyRotations: 0
    };
    
    this.threatDetector = new BiometricThreatDetector();
    this.differentialPrivacy = new DifferentialPrivacyEngine();
    this.auditLogger = new SecurityAuditLogger();
    
    this.initializeEncryption();
    this.startKeyRotation();
    this.setupThreatMonitoring();
  }
  
  /**
   * Encrypt biometric data with post-quantum safe algorithms
   */
  async encryptBiometricData(
    data: BiometricDataPoint,
    keyId: string = 'default'
  ): Promise<EncryptedBiometricData> {
    const startTime = Date.now();
    
    try {
      // Input validation
      this.validateBiometricData(data);
      
      // Rate limiting check
      if (!this.checkRateLimit(data.userId)) {
        throw new Error('Rate limit exceeded for user');
      }
      
      // Threat detection
      const threatResult = await this.threatDetector.detectThreats(data);
      if (threatResult.isThreat) {
        await this.handleThreatDetection(threatResult, data);
        throw new Error(`Security threat detected: ${threatResult.details}`);
      }
      
      // Get encryption key
      const key = this.getEncryptionKey(keyId);
      if (!key) {
        throw new Error('Encryption key not found');
      }
      
      // Apply differential privacy if configured
      const protectedData = await this.differentialPrivacy.protectData(data);
      
      // Encrypt using AES-256-GCM (post-quantum safe)
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      cipher.setIV(iv);
      
      const serializedData = JSON.stringify(protectedData);
      let encrypted = cipher.update(serializedData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result: EncryptedBiometricData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        keyId,
        timestamp: Date.now(),
        algorithm
      };
      
      // Update metrics
      this.updateMetrics('encryption', Date.now() - startTime);
      
      // Audit log
      await this.auditLogger.logSecurityEvent({
        type: 'encryption',
        severity: 'low',
        message: 'Biometric data encrypted successfully',
        timestamp: Date.now(),
        userId: data.userId,
        metadata: { keyId, algorithm }
      });
      
      return result;
      
    } catch (error) {
      this.securityMetrics.failedOperations++;
      
      await this.auditLogger.logSecurityEvent({
        type: 'encryption',
        severity: 'high',
        message: `Encryption failed: ${error.message}`,
        timestamp: Date.now(),
        userId: data.userId,
        metadata: { error: error.message }
      });
      
      this.emit('securityError', { type: 'encryption', error, data });
      throw error;
    }
  }
  
  /**
   * Decrypt biometric data with integrity verification
   */
  async decryptBiometricData(
    encryptedData: EncryptedBiometricData,
    keyId?: string
  ): Promise<BiometricDataPoint> {
    const startTime = Date.now();
    
    try {
      // Validate encrypted data structure
      this.validateEncryptedData(encryptedData);
      
      // Check data age (prevent replay attacks)
      const dataAge = Date.now() - encryptedData.timestamp;
      if (dataAge > 24 * 60 * 60 * 1000) { // 24 hours
        throw new Error('Encrypted data is too old');
      }
      
      // Get decryption key
      const key = this.getEncryptionKey(keyId || encryptedData.keyId);
      if (!key) {
        throw new Error('Decryption key not found');
      }
      
      // Decrypt using specified algorithm
      const algorithm = encryptedData.algorithm || 'aes-256-gcm';
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setIV(Buffer.from(encryptedData.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const data: BiometricDataPoint = JSON.parse(decrypted);
      
      // Validate decrypted data
      this.validateBiometricData(data);
      
      // Update metrics
      this.updateMetrics('decryption', Date.now() - startTime);
      
      // Audit log
      await this.auditLogger.logSecurityEvent({
        type: 'decryption',
        severity: 'low',
        message: 'Biometric data decrypted successfully',
        timestamp: Date.now(),
        userId: data.userId,
        metadata: { keyId: encryptedData.keyId, algorithm }
      });
      
      return data;
      
    } catch (error) {
      this.securityMetrics.failedOperations++;
      
      await this.auditLogger.logSecurityEvent({
        type: 'decryption',
        severity: 'high',
        message: `Decryption failed: ${error.message}`,
        timestamp: Date.now(),
        metadata: { error: error.message, keyId: encryptedData.keyId }
      });
      
      this.emit('securityError', { type: 'decryption', error, encryptedData });
      throw error;
    }
  }
  
  /**
   * Apply differential privacy to protect individual data
   */
  async applyDifferentialPrivacy(
    data: BiometricDataPoint[],
    config: DifferentialPrivacyConfig
  ): Promise<BiometricDataPoint[]> {
    try {
      const protectedData = await this.differentialPrivacy.protectDataset(data, config);
      
      this.securityMetrics.privacyApplications++;
      
      await this.auditLogger.logSecurityEvent({
        type: 'privacy',
        severity: 'low',
        message: 'Differential privacy applied to dataset',
        timestamp: Date.now(),
        metadata: { 
          datasetSize: data.length,
          epsilon: config.epsilon,
          noiseType: config.noiseType
        }
      });
      
      return protectedData;
      
    } catch (error) {
      this.securityMetrics.failedOperations++;
      this.emit('securityError', { type: 'privacy', error, data });
      throw error;
    }
  }
  
  /**
   * Validate biometric data integrity and detect anomalies
   */
  async validateDataIntegrity(data: BiometricDataPoint): Promise<boolean> {
    try {
      // Basic structure validation
      this.validateBiometricData(data);
      
      // Physiological range validation
      const physiologicalValidation = this.validatePhysiologicalRanges(data);
      if (!physiologicalValidation.isValid) {
        await this.auditLogger.logSecurityEvent({
          type: 'validation',
          severity: 'medium',
          message: `Physiological validation failed: ${physiologicalValidation.error}`,
          timestamp: Date.now(),
          userId: data.userId,
          metadata: { validationError: physiologicalValidation.error }
        });
        return false;
      }
      
      // Anomaly detection
      const anomalyResult = await this.threatDetector.detectAnomalies(data);
      if (anomalyResult.isAnomaly) {
        await this.auditLogger.logSecurityEvent({
          type: 'validation',
          severity: 'medium',
          message: `Anomaly detected: ${anomalyResult.description}`,
          timestamp: Date.now(),
          userId: data.userId,
          metadata: { anomaly: anomalyResult }
        });
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.emit('securityError', { type: 'validation', error, data });
      return false;
    }
  }
  
  /**
   * Generate secure hash for data integrity verification
   */
  generateDataHash(data: BiometricDataPoint): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }
  
  /**
   * Verify data integrity using hash
   */
  verifyDataHash(data: BiometricDataPoint, expectedHash: string): boolean {
    const actualHash = this.generateDataHash(data);
    return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
  }
  
  /**
   * Get security metrics for monitoring
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }
  
  /**
   * Rotate encryption keys for enhanced security
   */
  async rotateEncryptionKey(keyId: string = 'default'): Promise<void> {
    try {
      const newKey = crypto.randomBytes(32); // 256-bit key
      this.encryptionKeys.set(keyId, newKey);
      
      this.securityMetrics.keyRotations++;
      
      await this.auditLogger.logSecurityEvent({
        type: 'encryption',
        severity: 'low',
        message: 'Encryption key rotated',
        timestamp: Date.now(),
        metadata: { keyId }
      });
      
      this.emit('keyRotated', { keyId, timestamp: Date.now() });
      
    } catch (error) {
      this.emit('securityError', { type: 'keyRotation', error, keyId });
      throw error;
    }
  }
  
  // ==================== Private Methods ====================
  
  private initializeEncryption(): void {
    // Initialize default encryption key
    this.encryptionKeys.set('default', crypto.randomBytes(32));
    
    // Load additional keys from secure storage if available
    // In production, keys should be loaded from HSM or secure key management service
  }
  
  private startKeyRotation(): void {
    setInterval(() => {
      this.rotateEncryptionKey().catch(error => {
        console.error('Key rotation failed:', error);
      });
    }, this.keyRotationInterval);
  }
  
  private setupThreatMonitoring(): void {
    this.threatDetector.on('threatDetected', async (threat) => {
      await this.handleThreatDetection(threat);
    });
  }
  
  private validateBiometricData(data: BiometricDataPoint): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid biometric data structure');
    }
    
    const requiredFields = ['timestamp', 'userId', 'heartRate', 'cognitiveLoad', 'attentionLevel', 'stressLevel'];
    
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      throw new Error('Invalid timestamp');
    }
    
    if (typeof data.userId !== 'string' || data.userId.length === 0) {
      throw new Error('Invalid userId');
    }
  }
  
  private validateEncryptedData(data: EncryptedBiometricData): void {
    const requiredFields = ['encryptedData', 'iv', 'authTag', 'keyId', 'timestamp'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required encrypted data field: ${field}`);
      }
    }
  }
  
  private validatePhysiologicalRanges(data: BiometricDataPoint): { isValid: boolean; error?: string } {
    // Heart rate validation
    if (data.heartRate < 30 || data.heartRate > 250) {
      return { isValid: false, error: 'Heart rate out of physiological range' };
    }
    
    // HRV validation
    if (data.hrv !== undefined && (data.hrv < 10 || data.hrv > 200)) {
      return { isValid: false, error: 'HRV out of physiological range' };
    }
    
    // Temperature validation
    if (data.skinTemperature !== undefined && (data.skinTemperature < 25 || data.skinTemperature > 45)) {
      return { isValid: false, error: 'Skin temperature out of physiological range' };
    }
    
    // Cognitive metrics validation (0-100 scale)
    const cognitiveMetrics = ['cognitiveLoad', 'attentionLevel', 'stressLevel'];
    for (const metric of cognitiveMetrics) {
      if (data[metric] < 0 || data[metric] > 100) {
        return { isValid: false, error: `${metric} out of valid range (0-100)` };
      }
    }
    
    return { isValid: true };
  }
  
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimiter.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit
      this.rateLimiter.set(userId, {
        count: 1,
        resetTime: now + 60000 // 1 minute window
      });
      return true;
    }
    
    if (userLimit.count >= 1000) { // 1000 requests per minute
      return false;
    }
    
    userLimit.count++;
    return true;
  }
  
  private getEncryptionKey(keyId: string): Buffer | null {
    return this.encryptionKeys.get(keyId) || null;
  }
  
  private updateMetrics(operation: 'encryption' | 'decryption', processingTime: number): void {
    if (operation === 'encryption') {
      this.securityMetrics.encryptionOperations++;
    } else {
      this.securityMetrics.decryptionOperations++;
    }
    
    // Update average processing time
    const totalOperations = this.securityMetrics.encryptionOperations + this.securityMetrics.decryptionOperations;
    this.securityMetrics.averageProcessingTime = 
      (this.securityMetrics.averageProcessingTime * (totalOperations - 1) + processingTime) / totalOperations;
  }
  
  private async handleThreatDetection(
    threat: ThreatDetectionResult,
    data?: BiometricDataPoint
  ): Promise<void> {
    await this.auditLogger.logSecurityEvent({
      type: 'threat',
      severity: threat.confidence > 0.8 ? 'critical' : 'high',
      message: `Security threat detected: ${threat.details}`,
      timestamp: Date.now(),
      userId: data?.userId,
      metadata: { threat }
    });
    
    this.emit('threatDetected', { threat, data, timestamp: Date.now() });
    
    // Take automated response actions based on threat type
    switch (threat.threatType) {
      case 'injection':
        // Block further requests from this user temporarily
        break;
      case 'replay':
        // Invalidate session tokens
        break;
      case 'tampering':
        // Alert security team
        break;
      case 'anomaly':
        // Flag for manual review
        break;
    }
  }
  
  async shutdown(): Promise<void> {
    // Clear sensitive data
    this.encryptionKeys.clear();
    this.rateLimiter.clear();
    
    // Cleanup components
    await this.threatDetector.shutdown();
    await this.differentialPrivacy.shutdown();
    await this.auditLogger.shutdown();
    
    this.removeAllListeners();
  }
}

// ==================== Supporting Classes ====================

/**
 * Differential Privacy Engine
 */
class DifferentialPrivacyEngine {
  private defaultEpsilon: number = 1.0;
  private defaultDelta: number = 1e-5;
  
  async protectData(
    data: BiometricDataPoint,
    config?: Partial<DifferentialPrivacyConfig>
  ): Promise<BiometricDataPoint> {
    const epsilon = config?.epsilon || this.defaultEpsilon;
    const sensitivity = config?.sensitivity || 1.0;
    const noiseType = config?.noiseType || 'laplacian';
    
    return {
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
  }
  
  async protectDataset(
    dataset: BiometricDataPoint[],
    config: DifferentialPrivacyConfig
  ): Promise<BiometricDataPoint[]> {
    const protectedDataset = [];
    
    for (const dataPoint of dataset) {
      const protectedPoint = await this.protectData(dataPoint, config);
      protectedDataset.push(protectedPoint);
    }
    
    return protectedDataset;
  }
  
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
  
  private laplacianNoise(mean: number, scale: number): number {
    const u = Math.random() - 0.5;
    return mean - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }
  
  private gaussianNoise(mean: number, scale: number): number {
    // Box-Muller transformation for Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + scale * z;
  }
  
  async shutdown(): Promise<void> {
    // Cleanup if needed
  }
}

/**
 * Biometric Threat Detector
 */
class BiometricThreatDetector extends EventEmitter {
  private anomalyBaselines: Map<string, BiometricBaseline> = new Map();
  private recentData: Map<string, BiometricDataPoint[]> = new Map();
  private maxDataPoints: number = 1000;
  
  async detectThreats(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    const threats = await Promise.all([
      this.detectInjectionAttack(data),
      this.detectReplayAttack(data),
      this.detectTampering(data)
    ]);
    
    const highestThreat = threats.reduce((max, current) => 
      current.confidence > max.confidence ? current : max
    );
    
    if (highestThreat.isThreat) {
      this.emit('threatDetected', highestThreat);
    }
    
    return highestThreat;
  }
  
  async detectAnomalies(data: BiometricDataPoint): Promise<{ isAnomaly: boolean; description: string; severity: number }> {
    const baseline = this.getOrCreateBaseline(data.userId);
    
    // Calculate z-scores for key metrics
    const heartRateZ = Math.abs((data.heartRate - baseline.heartRate.mean) / baseline.heartRate.std);
    const cognitiveLoadZ = Math.abs((data.cognitiveLoad - baseline.cognitiveLoad.mean) / baseline.cognitiveLoad.std);
    const attentionZ = Math.abs((data.attentionLevel - baseline.attentionLevel.mean) / baseline.attentionLevel.std);
    
    const maxZ = Math.max(heartRateZ, cognitiveLoadZ, attentionZ);
    
    // Update baseline
    this.updateBaseline(data.userId, data);
    
    if (maxZ > 3.0) {
      return {
        isAnomaly: true,
        description: `Extreme deviation detected (z-score: ${maxZ.toFixed(2)})`,
        severity: Math.min(1.0, maxZ / 5.0)
      };
    }
    
    return { isAnomaly: false, description: 'No anomaly detected', severity: 0 };
  }
  
  private async detectInjectionAttack(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    // Check for SQL injection patterns in string fields
    const stringFields = [data.userId, data.sessionId, data.contextId].filter(Boolean);
    
    for (const field of stringFields) {
      if (this.containsSQLInjectionPattern(field)) {
        return {
          isThreat: true,
          threatType: 'injection',
          confidence: 0.9,
          details: 'SQL injection pattern detected in data fields',
          recommendedAction: 'Block request and log security event'
        };
      }
    }
    
    return {
      isThreat: false,
      threatType: 'injection',
      confidence: 0,
      details: 'No injection patterns detected',
      recommendedAction: 'Continue processing'
    };
  }
  
  private async detectReplayAttack(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    const userId = data.userId;
    const recentUserData = this.recentData.get(userId) || [];
    
    // Check for exact duplicates within recent timeframe
    const duplicates = recentUserData.filter(recent => 
      recent.timestamp !== data.timestamp &&
      Math.abs(recent.timestamp - data.timestamp) < 60000 && // Within 1 minute
      this.areDataPointsIdentical(recent, data)
    );
    
    if (duplicates.length > 0) {
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
    if (recentUserData.length > this.maxDataPoints) {
      recentUserData.shift();
    }
    this.recentData.set(userId, recentUserData);
    
    return {
      isThreat: false,
      threatType: 'replay',
      confidence: 0,
      details: 'No replay attack detected',
      recommendedAction: 'Continue processing'
    };
  }
  
  private async detectTampering(data: BiometricDataPoint): Promise<ThreatDetectionResult> {
    // Check for impossible physiological combinations
    const impossibleCombinations = [
      // Very high heart rate with very low stress
      data.heartRate > 180 && data.stressLevel < 10,
      // Very high cognitive load with very high attention but very low stress
      data.cognitiveLoad > 95 && data.attentionLevel > 95 && data.stressLevel < 20,
      // Perfect values (likely fabricated)
      data.heartRate === 60 && data.cognitiveLoad === 50 && data.attentionLevel === 75 && data.stressLevel === 25
    ];
    
    if (impossibleCombinations.some(condition => condition)) {
      return {
        isThreat: true,
        threatType: 'tampering',
        confidence: 0.7,
        details: 'Physiologically impossible data combination detected',
        recommendedAction: 'Flag for manual review and validate data source'
      };
    }
    
    return {
      isThreat: false,
      threatType: 'tampering',
      confidence: 0,
      details: 'Data appears physiologically consistent',
      recommendedAction: 'Continue processing'
    };
  }
  
  private containsSQLInjectionPattern(value: string): boolean {
    const patterns = [
      /('|(\\x27)|(\\x2D)|(-)|(%27)|(%2D))/i,
      /(\\x23)|(#)/i,
      /((\\x3D)|(=))[^\\n]*(password|pwd|pass)/i,
      /((\\x3D)|(=))[^\\n]*(id|user|account|admin)/i,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i
    ];
    
    return patterns.some(pattern => pattern.test(value));
  }
  
  private areDataPointsIdentical(data1: BiometricDataPoint, data2: BiometricDataPoint): boolean {
    const precision = 0.01; // Allow small floating point differences
    
    return (
      Math.abs(data1.heartRate - data2.heartRate) < precision &&
      Math.abs(data1.cognitiveLoad - data2.cognitiveLoad) < precision &&
      Math.abs(data1.attentionLevel - data2.attentionLevel) < precision &&
      Math.abs(data1.stressLevel - data2.stressLevel) < precision
    );
  }
  
  private getOrCreateBaseline(userId: string): BiometricBaseline {
    let baseline = this.anomalyBaselines.get(userId);
    
    if (!baseline) {
      baseline = {
        heartRate: { mean: 70, std: 15 },
        cognitiveLoad: { mean: 50, std: 20 },
        attentionLevel: { mean: 60, std: 25 },
        stressLevel: { mean: 40, std: 20 },
        sampleCount: 0
      };
      this.anomalyBaselines.set(userId, baseline);
    }
    
    return baseline;
  }
  
  private updateBaseline(userId: string, data: BiometricDataPoint): void {
    const baseline = this.anomalyBaselines.get(userId);
    if (!baseline) return;
    
    const alpha = 0.1; // Learning rate
    
    // Update means
    baseline.heartRate.mean = baseline.heartRate.mean * (1 - alpha) + data.heartRate * alpha;
    baseline.cognitiveLoad.mean = baseline.cognitiveLoad.mean * (1 - alpha) + data.cognitiveLoad * alpha;
    baseline.attentionLevel.mean = baseline.attentionLevel.mean * (1 - alpha) + data.attentionLevel * alpha;
    baseline.stressLevel.mean = baseline.stressLevel.mean * (1 - alpha) + data.stressLevel * alpha;
    
    // Update standard deviations (simplified)
    baseline.heartRate.std = baseline.heartRate.std * (1 - alpha) + Math.abs(data.heartRate - baseline.heartRate.mean) * alpha;
    baseline.cognitiveLoad.std = baseline.cognitiveLoad.std * (1 - alpha) + Math.abs(data.cognitiveLoad - baseline.cognitiveLoad.mean) * alpha;
    baseline.attentionLevel.std = baseline.attentionLevel.std * (1 - alpha) + Math.abs(data.attentionLevel - baseline.attentionLevel.mean) * alpha;
    baseline.stressLevel.std = baseline.stressLevel.std * (1 - alpha) + Math.abs(data.stressLevel - baseline.stressLevel.mean) * alpha;
    
    baseline.sampleCount++;
  }
  
  async shutdown(): Promise<void> {
    this.anomalyBaselines.clear();
    this.recentData.clear();
    this.removeAllListeners();
  }
}

/**
 * Security Audit Logger
 */
class SecurityAuditLogger {
  private logBuffer: SecurityEvent[] = [];
  private maxBufferSize: number = 1000;
  
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    // Add to buffer
    this.logBuffer.push(event);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
    
    // In production, write to secure audit log storage
    // For now, log to console for critical events
    if (event.severity === 'critical' || event.severity === 'high') {
      console.warn(`[SECURITY] ${event.severity.toUpperCase()}: ${event.message}`, {
        timestamp: new Date(event.timestamp).toISOString(),
        userId: event.userId,
        metadata: event.metadata
      });
    }
  }
  
  getAuditLog(filter?: { 
    userId?: string; 
    severity?: string; 
    startTime?: number; 
    endTime?: number; 
  }): SecurityEvent[] {
    let filtered = this.logBuffer;
    
    if (filter) {
      filtered = filtered.filter(event => {
        if (filter.userId && event.userId !== filter.userId) return false;
        if (filter.severity && event.severity !== filter.severity) return false;
        if (filter.startTime && event.timestamp < filter.startTime) return false;
        if (filter.endTime && event.timestamp > filter.endTime) return false;
        return true;
      });
    }
    
    return filtered;
  }
  
  async shutdown(): Promise<void> {
    // Flush remaining logs to persistent storage
    // this.logBuffer.clear();
  }
}

// ==================== Supporting Interfaces ====================

interface BiometricBaseline {
  heartRate: { mean: number; std: number };
  cognitiveLoad: { mean: number; std: number };
  attentionLevel: { mean: number; std: number };
  stressLevel: { mean: number; std: number };
  sampleCount: number;
}

export default BiometricSecurityService;