import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface CryptographicKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: number;
  expiresAt: number;
  usage: 'encryption' | 'signing' | 'authentication';
  status: 'active' | 'pending' | 'expired' | 'revoked';
}

export interface KeyRotationConfig {
  rotationInterval: number; // milliseconds
  keyRetentionPeriod: number; // milliseconds
  autoRotation: boolean;
  gracePeriod: number; // milliseconds for key overlap
}

export interface KeyMetrics {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  revokedKeys: number;
  rotationsPerformed: number;
  failedRotations: number;
  averageKeyAge: number;
}

export interface KeyGenerationOptions {
  keySize?: number;
  algorithm?: string;
  usage?: 'encryption' | 'signing' | 'authentication';
  expirationTime?: number;
}

/**
 * Comprehensive cryptographic key management system
 * Handles key generation, rotation, storage, and lifecycle management
 */
export class KeyManager extends EventEmitter {
  private keys: Map<string, CryptographicKey> = new Map();
  private config: KeyRotationConfig;
  private metrics: KeyMetrics;
  private rotationTimer: NodeJS.Timeout | null = null;
  private keyHistory: Map<string, CryptographicKey[]> = new Map();

  constructor(config: Partial<KeyRotationConfig> = {}) {
    super();
    
    this.config = {
      rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      keyRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      autoRotation: true,
      gracePeriod: 60 * 60 * 1000, // 1 hour
      ...config
    };

    this.metrics = {
      totalKeys: 0,
      activeKeys: 0,
      expiredKeys: 0,
      revokedKeys: 0,
      rotationsPerformed: 0,
      failedRotations: 0,
      averageKeyAge: 0
    };

    this.initializeDefaultKey();
    
    if (this.config.autoRotation) {
      this.startAutoRotation();
    }
  }

  /**
   * Generate a new cryptographic key
   */
  async generateKey(options: KeyGenerationOptions = {}): Promise<CryptographicKey> {
    try {
      const keyId = this.generateKeyId();
      const keySize = options.keySize || 32; // 256-bit default
      const algorithm = options.algorithm || 'aes-256-gcm';
      const usage = options.usage || 'encryption';
      const expirationTime = options.expirationTime || this.config.rotationInterval;
      
      const keyBuffer = crypto.randomBytes(keySize);
      const now = Date.now();
      
      const cryptographicKey: CryptographicKey = {
        id: keyId,
        key: keyBuffer,
        algorithm,
        createdAt: now,
        expiresAt: now + expirationTime,
        usage,
        status: 'active'
      };
      
      this.keys.set(keyId, cryptographicKey);
      this.updateMetrics();
      
      this.emit('keyGenerated', {
        keyId,
        algorithm,
        usage,
        createdAt: now,
        expiresAt: cryptographicKey.expiresAt
      });
      
      // Store in history for audit purposes
      this.addToHistory(keyId, cryptographicKey);
      
      return cryptographicKey;
      
    } catch (error) {
      this.emit('keyGenerationFailed', { error, options });
      throw new Error(`Key generation failed: ${error.message}`);
    }
  }

  /**
   * Rotate encryption keys for enhanced security
   */
  async rotateKeys(keyId?: string): Promise<void> {
    try {
      if (keyId) {
        await this.rotateSpecificKey(keyId);
      } else {
        await this.rotateAllKeys();
      }
      
      this.metrics.rotationsPerformed++;
      this.emit('keyRotationCompleted', {
        keyId: keyId || 'all',
        timestamp: Date.now(),
        rotationCount: this.metrics.rotationsPerformed
      });
      
    } catch (error) {
      this.metrics.failedRotations++;
      this.emit('keyRotationFailed', { error, keyId });
      throw error;
    }
  }

  /**
   * Get a key by ID
   */
  getKey(keyId: string): CryptographicKey | null {
    const key = this.keys.get(keyId);
    
    if (!key) {
      return null;
    }
    
    // Check if key is expired
    if (key.expiresAt <= Date.now() && key.status === 'active') {
      key.status = 'expired';
      this.emit('keyExpired', { keyId, expiredAt: Date.now() });
      this.updateMetrics();
    }
    
    return key;
  }

  /**
   * Get active keys by usage type
   */
  getActiveKeys(usage?: 'encryption' | 'signing' | 'authentication'): CryptographicKey[] {
    const now = Date.now();
    const activeKeys = Array.from(this.keys.values()).filter(key => 
      key.status === 'active' && 
      key.expiresAt > now &&
      (!usage || key.usage === usage)
    );
    
    return activeKeys;
  }

  /**
   * Revoke a key (mark as unusable)
   */
  async revokeKey(keyId: string, reason?: string): Promise<void> {
    const key = this.keys.get(keyId);
    
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    if (key.status === 'revoked') {
      throw new Error(`Key already revoked: ${keyId}`);
    }
    
    key.status = 'revoked';
    this.updateMetrics();
    
    this.emit('keyRevoked', {
      keyId,
      reason: reason || 'Manual revocation',
      revokedAt: Date.now(),
      previousStatus: key.status
    });
    
    // If this was the only active key of its type, generate a replacement
    const activeKeysOfSameType = this.getActiveKeys(key.usage);
    if (activeKeysOfSameType.length === 0) {
      await this.generateKey({ usage: key.usage, algorithm: key.algorithm });
      this.emit('replacementKeyGenerated', {
        originalKeyId: keyId,
        usage: key.usage,
        reason: 'No active keys remaining'
      });
    }
  }

  /**
   * Clean up expired and revoked keys
   */
  async cleanupKeys(): Promise<void> {
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (const [keyId, key] of this.keys.entries()) {
      // Remove keys that are expired and past retention period
      if ((key.status === 'expired' || key.status === 'revoked') && 
          (now - key.expiresAt) > this.config.keyRetentionPeriod) {
        keysToRemove.push(keyId);
      }
    }
    
    for (const keyId of keysToRemove) {
      this.keys.delete(keyId);
      
      // Clean up history as well
      const history = this.keyHistory.get(keyId);
      if (history) {
        // Keep only the most recent entry for audit purposes
        this.keyHistory.set(keyId, history.slice(-1));
      }
    }
    
    this.updateMetrics();
    
    if (keysToRemove.length > 0) {
      this.emit('keysCleanedUp', {
        removedKeys: keysToRemove,
        cleanupTime: Date.now(),
        keysRemoved: keysToRemove.length
      });
    }
  }

  /**
   * Export key for backup (secure format)
   */
  exportKey(keyId: string, encryptionKey?: Buffer): {
    keyId: string;
    encryptedKey?: string;
    metadata: {
      algorithm: string;
      createdAt: number;
      expiresAt: number;
      usage: string;
    };
  } {
    const key = this.keys.get(keyId);
    
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    if (key.status !== 'active') {
      throw new Error(`Cannot export non-active key: ${keyId}`);
    }
    
    let encryptedKey: string | undefined;
    
    if (encryptionKey) {
      // Encrypt the key for secure export
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipherGCM('aes-256-gcm', encryptionKey);
      cipher.setIVBytes(iv);
      
      let encrypted = cipher.update(key.key, undefined, 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      encryptedKey = JSON.stringify({
        data: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      });
    }
    
    this.emit('keyExported', {
      keyId,
      exportedAt: Date.now(),
      encrypted: !!encryptionKey
    });
    
    return {
      keyId,
      encryptedKey,
      metadata: {
        algorithm: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        usage: key.usage
      }
    };
  }

  /**
   * Import a key from backup
   */
  async importKey(
    keyData: {
      keyId: string;
      encryptedKey?: string;
      rawKey?: Buffer;
      metadata: {
        algorithm: string;
        createdAt: number;
        expiresAt: number;
        usage: string;
      };
    },
    decryptionKey?: Buffer
  ): Promise<void> {
    try {
      let keyBuffer: Buffer;
      
      if (keyData.encryptedKey && decryptionKey) {
        // Decrypt the imported key
        const encryptedData = JSON.parse(keyData.encryptedKey);
        const decipher = crypto.createDecipherGCM('aes-256-gcm', decryptionKey);
        decipher.setIVBytes(Buffer.from(encryptedData.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.data, 'hex');
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        keyBuffer = decrypted;
      } else if (keyData.rawKey) {
        keyBuffer = keyData.rawKey;
      } else {
        throw new Error('No key data provided for import');
      }
      
      const importedKey: CryptographicKey = {
        id: keyData.keyId,
        key: keyBuffer,
        algorithm: keyData.metadata.algorithm,
        createdAt: keyData.metadata.createdAt,
        expiresAt: keyData.metadata.expiresAt,
        usage: keyData.metadata.usage as 'encryption' | 'signing' | 'authentication',
        status: keyData.metadata.expiresAt > Date.now() ? 'active' : 'expired'
      };
      
      // Check if key already exists
      if (this.keys.has(keyData.keyId)) {
        throw new Error(`Key already exists: ${keyData.keyId}`);
      }
      
      this.keys.set(keyData.keyId, importedKey);
      this.addToHistory(keyData.keyId, importedKey);
      this.updateMetrics();
      
      this.emit('keyImported', {
        keyId: keyData.keyId,
        importedAt: Date.now(),
        status: importedKey.status,
        usage: importedKey.usage
      });
      
    } catch (error) {
      this.emit('keyImportFailed', { error, keyId: keyData.keyId });
      throw new Error(`Key import failed: ${error.message}`);
    }
  }

  /**
   * Get key management metrics
   */
  getMetrics(): KeyMetrics {
    return { ...this.metrics };
  }

  /**
   * Get key history for audit purposes
   */
  getKeyHistory(keyId?: string): Map<string, CryptographicKey[]> | CryptographicKey[] {
    if (keyId) {
      return this.keyHistory.get(keyId) || [];
    }
    return new Map(this.keyHistory);
  }

  /**
   * Update key management configuration
   */
  updateConfig(newConfig: Partial<KeyRotationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-rotation if interval changed
    if (newConfig.rotationInterval && this.rotationTimer) {
      this.stopAutoRotation();
      this.startAutoRotation();
    }
    
    this.emit('configUpdated', {
      oldConfig,
      newConfig: this.config,
      updatedAt: Date.now()
    });
  }

  // ==================== Private Methods ====================

  /**
   * Initialize default encryption key
   */
  private initializeDefaultKey(): void {
    this.generateKey({
      usage: 'encryption',
      algorithm: 'aes-256-gcm'
    }).then(key => {
      this.keys.set('default', key);
      this.emit('defaultKeyInitialized', { keyId: key.id });
    }).catch(error => {
      console.error('Failed to initialize default key:', error);
    });
  }

  /**
   * Start automatic key rotation
   */
  private startAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    this.rotationTimer = setInterval(async () => {
      try {
        await this.rotateKeys();
        await this.cleanupKeys();
      } catch (error) {
        console.error('Auto rotation failed:', error);
        this.emit('autoRotationFailed', { error, timestamp: Date.now() });
      }
    }, this.config.rotationInterval);
    
    this.emit('autoRotationStarted', {
      interval: this.config.rotationInterval,
      startedAt: Date.now()
    });
  }

  /**
   * Stop automatic key rotation
   */
  private stopAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      
      this.emit('autoRotationStopped', { stoppedAt: Date.now() });
    }
  }

  /**
   * Rotate a specific key
   */
  private async rotateSpecificKey(keyId: string): Promise<void> {
    const oldKey = this.keys.get(keyId);
    
    if (!oldKey) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    // Generate new key with same properties
    const newKey = await this.generateKey({
      algorithm: oldKey.algorithm,
      usage: oldKey.usage
    });
    
    // Mark old key as expired (but keep for grace period)
    oldKey.status = 'expired';
    oldKey.expiresAt = Date.now() + this.config.gracePeriod;
    
    this.emit('specificKeyRotated', {
      oldKeyId: keyId,
      newKeyId: newKey.id,
      rotatedAt: Date.now()
    });
  }

  /**
   * Rotate all active keys
   */
  private async rotateAllKeys(): Promise<void> {
    const activeKeys = this.getActiveKeys();
    const rotationPromises = [];
    
    for (const key of activeKeys) {
      rotationPromises.push(this.rotateSpecificKey(key.id));
    }
    
    await Promise.all(rotationPromises);
    
    this.emit('allKeysRotated', {
      keysRotated: activeKeys.length,
      rotatedAt: Date.now()
    });
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `key_${timestamp}_${randomBytes}`;
  }

  /**
   * Add key to history for audit purposes
   */
  private addToHistory(keyId: string, key: CryptographicKey): void {
    if (!this.keyHistory.has(keyId)) {
      this.keyHistory.set(keyId, []);
    }
    
    const history = this.keyHistory.get(keyId)!;
    
    // Store a copy without the actual key material for security
    const historyEntry: CryptographicKey = {
      ...key,
      key: Buffer.alloc(0) // Empty buffer for security
    };
    
    history.push(historyEntry);
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Update key management metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    let totalAge = 0;
    let activeCount = 0;
    let expiredCount = 0;
    let revokedCount = 0;
    
    for (const key of this.keys.values()) {
      totalAge += now - key.createdAt;
      
      switch (key.status) {
        case 'active':
          if (key.expiresAt > now) {
            activeCount++;
          } else {
            expiredCount++;
          }
          break;
        case 'expired':
          expiredCount++;
          break;
        case 'revoked':
          revokedCount++;
          break;
      }
    }
    
    this.metrics = {
      totalKeys: this.keys.size,
      activeKeys: activeCount,
      expiredKeys: expiredCount,
      revokedKeys: revokedCount,
      rotationsPerformed: this.metrics.rotationsPerformed,
      failedRotations: this.metrics.failedRotations,
      averageKeyAge: this.keys.size > 0 ? totalAge / this.keys.size : 0
    };
  }

  /**
   * Cleanup resources and secure key material
   */
  async shutdown(): Promise<void> {
    this.stopAutoRotation();
    
    // Securely clear all key material
    for (const key of this.keys.values()) {
      if (key.key) {
        key.key.fill(0); // Overwrite key material with zeros
      }
    }
    
    this.keys.clear();
    this.keyHistory.clear();
    this.removeAllListeners();
    
    this.emit('keyManagerShutdown', { shutdownAt: Date.now() });
  }
}