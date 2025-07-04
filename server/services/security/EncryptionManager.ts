import crypto from 'crypto';
import { EventEmitter } from 'events';
import { BiometricDataPoint } from '../BiometricPipelineService';

export interface EncryptedBiometricData {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyId: string;
  timestamp: number;
  algorithm: string;
}

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
  maxDataAge: number;
}

export interface EncryptionMetrics {
  encryptionOperations: number;
  decryptionOperations: number;
  failedOperations: number;
  averageEncryptionTime: number;
  averageDecryptionTime: number;
}

/**
 * Comprehensive encryption and decryption management for biometric data
 * Implements post-quantum safe encryption algorithms with integrity verification
 */
export class EncryptionManager extends EventEmitter {
  private config: EncryptionConfig;
  private metrics: EncryptionMetrics;
  private encryptionTimes: number[] = [];
  private decryptionTimes: number[] = [];

  constructor(config: Partial<EncryptionConfig> = {}) {
    super();
    
    this.config = {
      algorithm: 'aes-256-gcm',
      keySize: 32, // 256-bit key
      ivSize: 12, // GCM standard IV size
      maxDataAge: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };

    this.metrics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      failedOperations: 0,
      averageEncryptionTime: 0,
      averageDecryptionTime: 0
    };
  }

  /**
   * Encrypt biometric data with post-quantum safe algorithms
   */
  async encrypt(
    data: BiometricDataPoint,
    key: Buffer,
    keyId: string = 'default'
  ): Promise<EncryptedBiometricData> {
    const startTime = Date.now();
    
    try {
      // Input validation
      this.validateBiometricData(data);
      this.validateEncryptionKey(key);
      
      // Create cipher
      const iv = crypto.randomBytes(this.config.ivSize);
      const cipher = crypto.createCipherGCM(this.config.algorithm, key);
      cipher.setIVBytes(iv);
      
      // Serialize and encrypt data
      const serializedData = JSON.stringify(data);
      let encrypted = cipher.update(serializedData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      const result: EncryptedBiometricData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        keyId,
        timestamp: Date.now(),
        algorithm: this.config.algorithm
      };
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateEncryptionMetrics(processingTime);
      
      this.emit('encryptionCompleted', {
        keyId,
        algorithm: this.config.algorithm,
        processingTime,
        dataSize: serializedData.length
      });
      
      return result;
      
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('encryptionFailed', { error, keyId, data });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt biometric data with integrity verification
   */
  async decrypt(
    encryptedData: EncryptedBiometricData,
    key: Buffer
  ): Promise<BiometricDataPoint> {
    const startTime = Date.now();
    
    try {
      // Validate encrypted data structure
      this.validateEncryptedData(encryptedData);
      this.validateEncryptionKey(key);
      
      // Check data age (prevent replay attacks)
      const dataAge = Date.now() - encryptedData.timestamp;
      if (dataAge > this.config.maxDataAge) {
        throw new Error('Encrypted data is too old');
      }
      
      // Create decipher
      const algorithm = encryptedData.algorithm || this.config.algorithm;
      const decipher = crypto.createDecipherGCM(algorithm, key);
      decipher.setIVBytes(Buffer.from(encryptedData.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse and validate decrypted data
      const data: BiometricDataPoint = JSON.parse(decrypted);
      this.validateBiometricData(data);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateDecryptionMetrics(processingTime);
      
      this.emit('decryptionCompleted', {
        keyId: encryptedData.keyId,
        algorithm: encryptedData.algorithm,
        processingTime,
        dataAge
      });
      
      return data;
      
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('decryptionFailed', { error, encryptedData });
      throw new Error(`Decryption failed: ${error.message}`);
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
    try {
      const actualHash = this.generateDataHash(data);
      return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
    } catch (error) {
      this.emit('hashVerificationFailed', { error, data, expectedHash });
      return false;
    }
  }

  /**
   * Encrypt data with additional authentication data (AAD)
   */
  async encryptWithAAD(
    data: BiometricDataPoint,
    key: Buffer,
    aad: Buffer,
    keyId: string = 'default'
  ): Promise<EncryptedBiometricData> {
    const startTime = Date.now();
    
    try {
      this.validateBiometricData(data);
      this.validateEncryptionKey(key);
      
      const iv = crypto.randomBytes(this.config.ivSize);
      const cipher = crypto.createCipherGCM(this.config.algorithm, key);
      cipher.setIVBytes(iv);
      cipher.setAAD(aad);
      
      const serializedData = JSON.stringify(data);
      let encrypted = cipher.update(serializedData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result: EncryptedBiometricData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        keyId,
        timestamp: Date.now(),
        algorithm: this.config.algorithm
      };
      
      const processingTime = Date.now() - startTime;
      this.updateEncryptionMetrics(processingTime);
      
      return result;
      
    } catch (error) {
      this.metrics.failedOperations++;
      throw new Error(`AAD encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data with additional authentication data verification
   */
  async decryptWithAAD(
    encryptedData: EncryptedBiometricData,
    key: Buffer,
    aad: Buffer
  ): Promise<BiometricDataPoint> {
    const startTime = Date.now();
    
    try {
      this.validateEncryptedData(encryptedData);
      this.validateEncryptionKey(key);
      
      const algorithm = encryptedData.algorithm || this.config.algorithm;
      const decipher = crypto.createDecipherGCM(algorithm, key);
      decipher.setIVBytes(Buffer.from(encryptedData.iv, 'hex'));
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const data: BiometricDataPoint = JSON.parse(decrypted);
      this.validateBiometricData(data);
      
      const processingTime = Date.now() - startTime;
      this.updateDecryptionMetrics(processingTime);
      
      return data;
      
    } catch (error) {
      this.metrics.failedOperations++;
      throw new Error(`AAD decryption failed: ${error.message}`);
    }
  }

  /**
   * Get encryption performance metrics
   */
  getMetrics(): EncryptionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed performance statistics
   */
  getDetailedStats(): {
    metrics: EncryptionMetrics;
    recentEncryptionTimes: number[];
    recentDecryptionTimes: number[];
    throughput: {
      encryptionsPerSecond: number;
      decryptionsPerSecond: number;
    };
  } {
    const uptime = process.uptime() * 1000; // Convert to milliseconds
    
    return {
      metrics: this.metrics,
      recentEncryptionTimes: this.encryptionTimes.slice(-100), // Last 100 operations
      recentDecryptionTimes: this.decryptionTimes.slice(-100),
      throughput: {
        encryptionsPerSecond: (this.metrics.encryptionOperations / uptime) * 1000,
        decryptionsPerSecond: (this.metrics.decryptionOperations / uptime) * 1000
      }
    };
  }

  /**
   * Reset metrics and statistics
   */
  resetMetrics(): void {
    this.metrics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      failedOperations: 0,
      averageEncryptionTime: 0,
      averageDecryptionTime: 0
    };
    
    this.encryptionTimes = [];
    this.decryptionTimes = [];
    
    this.emit('metricsReset', { timestamp: Date.now() });
  }

  // ==================== Private Methods ====================

  /**
   * Validate biometric data structure
   */
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

  /**
   * Validate encrypted data structure
   */
  private validateEncryptedData(data: EncryptedBiometricData): void {
    const requiredFields = ['encryptedData', 'iv', 'authTag', 'keyId', 'timestamp'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required encrypted data field: ${field}`);
      }
    }
    
    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      throw new Error('Invalid timestamp in encrypted data');
    }
  }

  /**
   * Validate encryption key
   */
  private validateEncryptionKey(key: Buffer): void {
    if (!Buffer.isBuffer(key)) {
      throw new Error('Encryption key must be a Buffer');
    }
    
    if (key.length !== this.config.keySize) {
      throw new Error(`Invalid key size: expected ${this.config.keySize} bytes, got ${key.length}`);
    }
  }

  /**
   * Update encryption metrics
   */
  private updateEncryptionMetrics(processingTime: number): void {
    this.metrics.encryptionOperations++;
    this.encryptionTimes.push(processingTime);
    
    // Keep only recent times for performance
    if (this.encryptionTimes.length > 1000) {
      this.encryptionTimes.shift();
    }
    
    // Update average encryption time
    const totalEncryptions = this.metrics.encryptionOperations;
    this.metrics.averageEncryptionTime = 
      (this.metrics.averageEncryptionTime * (totalEncryptions - 1) + processingTime) / totalEncryptions;
  }

  /**
   * Update decryption metrics
   */
  private updateDecryptionMetrics(processingTime: number): void {
    this.metrics.decryptionOperations++;
    this.decryptionTimes.push(processingTime);
    
    // Keep only recent times for performance
    if (this.decryptionTimes.length > 1000) {
      this.decryptionTimes.shift();
    }
    
    // Update average decryption time
    const totalDecryptions = this.metrics.decryptionOperations;
    this.metrics.averageDecryptionTime = 
      (this.metrics.averageDecryptionTime * (totalDecryptions - 1) + processingTime) / totalDecryptions;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.encryptionTimes = [];
    this.decryptionTimes = [];
  }
}