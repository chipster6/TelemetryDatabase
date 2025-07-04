// Enhanced Security and Privacy Service for Biometric Pipeline
// Now uses specialized services for better separation of concerns

import { EventEmitter } from 'events';
import { BiometricDataPoint } from './BiometricPipelineService';
import { EncryptionManager, EncryptedBiometricData } from './security/EncryptionManager';
import { PrivacyEngine, DifferentialPrivacyConfig, PrivacyResult } from './security/PrivacyEngine';
import { ThreatDetector, ThreatDetectionResult, AnomalyResult } from './security/ThreatDetector';
import { KeyManager, CryptographicKey, KeyRotationConfig } from './security/KeyManager';

// ==================== Core Types ====================

export interface SecurityMetrics {
  encryptionOperations: number;
  decryptionOperations: number;
  privacyApplications: number;
  failedOperations: number;
  averageProcessingTime: number;
  keyRotations: number;
  threatsDetected: number;
}

export interface SecurityEvent {
  type: 'encryption' | 'decryption' | 'privacy' | 'validation' | 'threat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface SecurityConfig {
  enableEncryption: boolean;
  enablePrivacyProtection: boolean;
  enableThreatDetection: boolean;
  enableKeyRotation: boolean;
  rateLimitThreshold: number;
  rateLimitWindow: number;
}

// ==================== Enhanced Security Service ====================

export class BiometricSecurityService extends EventEmitter {
  private encryptionManager: EncryptionManager;
  private privacyEngine: PrivacyEngine;
  private threatDetector: ThreatDetector;
  private keyManager: KeyManager;
  private config: SecurityConfig;
  private securityMetrics: SecurityMetrics;
  private rateLimiter: Map<string, { count: number; resetTime: number }> = new Map();
  private auditLogger: SecurityAuditLogger;
  
  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    
    this.config = {
      enableEncryption: true,
      enablePrivacyProtection: true,
      enableThreatDetection: true,
      enableKeyRotation: true,
      rateLimitThreshold: 1000, // requests per minute
      rateLimitWindow: 60000, // 1 minute
      ...config
    };
    
    this.securityMetrics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      privacyApplications: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      keyRotations: 0,
      threatsDetected: 0
    };
    
    // Initialize specialized services
    this.encryptionManager = new EncryptionManager();
    this.privacyEngine = new PrivacyEngine();
    this.threatDetector = new ThreatDetector();
    this.keyManager = new KeyManager({
      autoRotation: this.config.enableKeyRotation
    });
    this.auditLogger = new SecurityAuditLogger();
    
    this.setupEventHandlers();
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
      if (!this.config.enableEncryption) {
        throw new Error('Encryption is disabled');
      }
      
      // Rate limiting check
      if (!this.checkRateLimit(data.userId)) {
        throw new Error('Rate limit exceeded for user');
      }
      
      // Threat detection
      if (this.config.enableThreatDetection) {
        const threatResult = await this.threatDetector.detectThreats(data);
        if (threatResult.isThreat) {
          await this.handleThreatDetection(threatResult, data);
          throw new Error(`Security threat detected: ${threatResult.details}`);
        }
      }
      
      // Apply differential privacy if configured
      let protectedData = data;
      if (this.config.enablePrivacyProtection) {
        const privacyResult = await this.privacyEngine.applyDifferentialPrivacy(data);
        if (privacyResult.success) {
          protectedData = privacyResult.protectedData as BiometricDataPoint;
          this.securityMetrics.privacyApplications++;
        }
      }
      
      // Get encryption key
      const key = this.keyManager.getKey(keyId);
      if (!key || key.status !== 'active') {
        throw new Error('Encryption key not found or inactive');
      }
      
      // Encrypt data
      const result = await this.encryptionManager.encrypt(protectedData, key.key, keyId);
      
      // Update metrics
      this.updateMetrics('encryption', Date.now() - startTime);
      
      // Audit log
      await this.auditLogger.logSecurityEvent({
        type: 'encryption',
        severity: 'low',
        message: 'Biometric data encrypted successfully',
        timestamp: Date.now(),
        userId: data.userId,
        metadata: { keyId, algorithm: result.algorithm }
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
      if (!this.config.enableEncryption) {
        throw new Error('Encryption is disabled');
      }
      
      // Get decryption key
      const key = this.keyManager.getKey(keyId || encryptedData.keyId);
      if (!key) {
        throw new Error('Decryption key not found');
      }
      
      // Decrypt data using encryption manager
      const data = await this.encryptionManager.decrypt(encryptedData, key.key);
      
      // Update metrics
      this.updateMetrics('decryption', Date.now() - startTime);
      
      // Audit log
      await this.auditLogger.logSecurityEvent({
        type: 'decryption',
        severity: 'low',
        message: 'Biometric data decrypted successfully',
        timestamp: Date.now(),
        userId: data.userId,
        metadata: { keyId: encryptedData.keyId, algorithm: encryptedData.algorithm }
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
      if (!this.config.enablePrivacyProtection) {
        throw new Error('Privacy protection is disabled');
      }
      
      const result = await this.privacyEngine.applyDatasetPrivacy(data, config);
      
      if (!result.success) {
        throw new Error(result.error || 'Privacy application failed');
      }
      
      this.securityMetrics.privacyApplications++;
      
      await this.auditLogger.logSecurityEvent({
        type: 'privacy',
        severity: 'low',
        message: 'Differential privacy applied to dataset',
        timestamp: Date.now(),
        metadata: { 
          datasetSize: data.length,
          epsilon: config.epsilon,
          noiseType: config.noiseType,
          privacyLevel: result.privacyLevel
        }
      });
      
      return result.protectedData as BiometricDataPoint[];
      
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
      if (!this.config.enableThreatDetection) {
        return true; // Skip validation if threat detection is disabled
      }
      
      // Threat detection
      const threatResult = await this.threatDetector.detectThreats(data);
      if (threatResult.isThreat) {
        await this.auditLogger.logSecurityEvent({
          type: 'validation',
          severity: 'high',
          message: `Threat detected during validation: ${threatResult.details}`,
          timestamp: Date.now(),
          userId: data.userId,
          metadata: { threat: threatResult }
        });
        return false;
      }
      
      // Anomaly detection
      const anomalyResult = await this.threatDetector.analyzeAnomalies(data);
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
    return this.encryptionManager.generateDataHash(data);
  }
  
  /**
   * Verify data integrity using hash
   */
  verifyDataHash(data: BiometricDataPoint, expectedHash: string): boolean {
    return this.encryptionManager.verifyDataHash(data, expectedHash);
  }
  
  /**
   * Get comprehensive security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const encryptionMetrics = this.encryptionManager.getMetrics();
    const privacyMetrics = this.privacyEngine.getMetrics();
    const threatMetrics = this.threatDetector.getMetrics();
    const keyMetrics = this.keyManager.getMetrics();
    
    return {
      encryptionOperations: encryptionMetrics.encryptionOperations,
      decryptionOperations: encryptionMetrics.decryptionOperations,
      privacyApplications: privacyMetrics.privacyApplications,
      failedOperations: this.securityMetrics.failedOperations,
      averageProcessingTime: this.securityMetrics.averageProcessingTime,
      keyRotations: keyMetrics.rotationsPerformed,
      threatsDetected: threatMetrics.threatsDetected
    };
  }
  
  /**
   * Rotate encryption keys for enhanced security
   */
  async rotateEncryptionKey(keyId?: string): Promise<void> {
    try {
      if (!this.config.enableKeyRotation) {
        throw new Error('Key rotation is disabled');
      }
      
      await this.keyManager.rotateKeys(keyId);
      this.securityMetrics.keyRotations++;
      
      await this.auditLogger.logSecurityEvent({
        type: 'encryption',
        severity: 'low',
        message: 'Encryption key rotated',
        timestamp: Date.now(),
        metadata: { keyId: keyId || 'all' }
      });
      
      this.emit('keyRotated', { keyId: keyId || 'all', timestamp: Date.now() });
      
    } catch (error) {
      this.emit('securityError', { type: 'keyRotation', error, keyId });
      throw error;
    }
  }
  
  /**
   * Get detailed security status
   */
  getSecurityStatus(): {
    config: SecurityConfig;
    metrics: SecurityMetrics;
    activeKeys: number;
    threatLevel: 'low' | 'medium' | 'high';
    lastKeyRotation?: number;
  } {
    const metrics = this.getSecurityMetrics();
    const keyMetrics = this.keyManager.getMetrics();
    
    // Calculate threat level based on recent activity
    let threatLevel: 'low' | 'medium' | 'high' = 'low';
    if (metrics.threatsDetected > 10) {
      threatLevel = 'high';
    } else if (metrics.threatsDetected > 3) {
      threatLevel = 'medium';
    }
    
    return {
      config: this.config,
      metrics,
      activeKeys: keyMetrics.activeKeys,
      threatLevel,
      lastKeyRotation: keyMetrics.rotationsPerformed > 0 ? Date.now() : undefined
    };
  }
  
  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update key manager if key rotation setting changed
    if (newConfig.enableKeyRotation !== undefined) {
      this.keyManager.updateConfig({ autoRotation: newConfig.enableKeyRotation });
    }
    
    this.emit('configUpdated', this.config);
  }
  
  // ==================== Private Methods ====================
  
  /**
   * Setup event handlers for component communication
   */
  private setupEventHandlers(): void {
    // Encryption Manager events
    this.encryptionManager.on('encryptionCompleted', (event) => {
      this.securityMetrics.encryptionOperations++;
    });
    
    this.encryptionManager.on('decryptionCompleted', (event) => {
      this.securityMetrics.decryptionOperations++;
    });
    
    this.encryptionManager.on('encryptionFailed', (event) => {
      this.securityMetrics.failedOperations++;
    });
    
    // Privacy Engine events
    this.privacyEngine.on('privacyApplied', (event) => {
      this.securityMetrics.privacyApplications++;
    });
    
    // Threat Detector events
    this.threatDetector.on('threatDetected', (event) => {
      this.securityMetrics.threatsDetected++;
      this.emit('threatDetected', event);
    });
    
    // Key Manager events
    this.keyManager.on('keyRotated', (event) => {
      this.securityMetrics.keyRotations++;
      this.emit('keyRotated', event);
    });
  }
  
  /**
   * Check rate limiting for user
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimiter.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit
      this.rateLimiter.set(userId, {
        count: 1,
        resetTime: now + this.config.rateLimitWindow
      });
      return true;
    }
    
    if (userLimit.count >= this.config.rateLimitThreshold) {
      return false;
    }
    
    userLimit.count++;
    return true;
  }
  
  /**
   * Update processing metrics
   */
  private updateMetrics(operation: 'encryption' | 'decryption', processingTime: number): void {
    // Update average processing time
    const totalOperations = this.securityMetrics.encryptionOperations + this.securityMetrics.decryptionOperations;
    if (totalOperations > 0) {
      this.securityMetrics.averageProcessingTime = 
        (this.securityMetrics.averageProcessingTime * (totalOperations - 1) + processingTime) / totalOperations;
    } else {
      this.securityMetrics.averageProcessingTime = processingTime;
    }
  }
  
  /**
   * Handle threat detection events
   */
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
        if (data?.userId) {
          const userLimit = this.rateLimiter.get(data.userId);
          if (userLimit) {
            userLimit.count = this.config.rateLimitThreshold; // Block user
          }
        }
        break;
      case 'replay':
        // Log for manual review
        break;
      case 'tampering':
        // Alert security team
        this.emit('securityAlert', { type: 'tampering', threat, data });
        break;
      case 'anomaly':
        // Flag for manual review
        break;
    }
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Clear sensitive data
    this.rateLimiter.clear();
    
    // Shutdown components
    await Promise.all([
      this.encryptionManager.shutdown(),
      this.privacyEngine.shutdown(),
      this.threatDetector.shutdown(),
      this.keyManager.shutdown(),
      this.auditLogger.shutdown()
    ]);
    
    this.removeAllListeners();
  }
}

// ==================== Supporting Classes ====================

/**
 * Security Audit Logger (unchanged from original implementation)
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

// ==================== Backward Compatibility ====================
// Note: The original supporting classes have been decomposed into separate services:
// - DifferentialPrivacyEngine -> PrivacyEngine
// - BiometricThreatDetector -> ThreatDetector  
// - Encryption/Decryption logic -> EncryptionManager
// - Key management -> KeyManager
// - SecurityAuditLogger -> Integrated audit logger

export default BiometricSecurityService;