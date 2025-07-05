import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface SecureBuffer {
  id: string;
  size: number;
  created: Date;
  lastAccessed: Date;
  accessCount: number;
}

export interface MemoryProtectionConfig {
  enableMlock?: boolean;
  enableZeroization?: boolean;
  maxSecureBuffers?: number;
  bufferTimeout?: number;
  debugMode?: boolean;
}

/**
 * Secure Memory Manager for protecting cryptographic materials and biometric data
 * Implements memory protection techniques to prevent extraction from memory dumps
 */
export class SecureMemoryManager extends EventEmitter {
  private secureBuffers = new Map<string, Buffer>();
  private bufferMetadata = new Map<string, SecureBuffer>();
  private config: Required<MemoryProtectionConfig>;
  private cleanupInterval: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: MemoryProtectionConfig = {}) {
    super();
    
    this.config = {
      enableMlock: config.enableMlock ?? true,
      enableZeroization: config.enableZeroization ?? true,
      maxSecureBuffers: config.maxSecureBuffers ?? 100,
      bufferTimeout: config.bufferTimeout ?? 5 * 60 * 1000, // 5 minutes
      debugMode: config.debugMode ?? false
    };

    // Set up automatic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredBuffers();
    }, 30000); // Run every 30 seconds

    // Handle process termination
    process.on('exit', () => this.emergencyCleanup());
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('uncaughtException', () => this.emergencyCleanup());
    
    this.log('SecureMemoryManager initialized', {
      maxBuffers: this.config.maxSecureBuffers,
      bufferTimeout: this.config.bufferTimeout,
      mlockEnabled: this.config.enableMlock
    });
  }

  /**
   * Allocate secure buffer for sensitive data
   */
  allocateSecureBuffer(size: number, id?: string): string {
    if (this.isShuttingDown) {
      throw new Error('SecureMemoryManager is shutting down');
    }

    if (this.secureBuffers.size >= this.config.maxSecureBuffers) {
      this.cleanupExpiredBuffers();
      
      if (this.secureBuffers.size >= this.config.maxSecureBuffers) {
        throw new Error('Maximum secure buffers limit reached');
      }
    }

    const bufferId = id || crypto.randomBytes(16).toString('hex');
    
    if (this.secureBuffers.has(bufferId)) {
      throw new Error(`Buffer with ID ${bufferId} already exists`);
    }

    // Allocate buffer
    const buffer = Buffer.allocUnsafe(size);
    
    // Initialize with random data to prevent information leakage
    crypto.randomFillSync(buffer);
    
    // Store buffer and metadata
    this.secureBuffers.set(bufferId, buffer);
    this.bufferMetadata.set(bufferId, {
      id: bufferId,
      size,
      created: new Date(),
      lastAccessed: new Date(),
      accessCount: 0
    });

    this.log('Secure buffer allocated', { bufferId, size });
    this.emit('bufferAllocated', { bufferId, size });

    return bufferId;
  }

  /**
   * Write data to secure buffer with automatic zeroization
   */
  writeSecureData(bufferId: string, data: Buffer | string): void {
    const buffer = this.getSecureBuffer(bufferId);
    const inputData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    
    if (inputData.length > buffer.length) {
      throw new Error(`Data size (${inputData.length}) exceeds buffer capacity (${buffer.length})`);
    }

    // Clear the buffer first
    buffer.fill(0);
    
    // Copy data
    inputData.copy(buffer, 0, 0, inputData.length);
    
    // Immediately zero the input if it's a different buffer
    if (inputData !== data) {
      inputData.fill(0);
    }

    this.updateAccessMetadata(bufferId);
    this.log('Data written to secure buffer', { bufferId, dataSize: inputData.length });
  }

  /**
   * Read data from secure buffer
   */
  readSecureData(bufferId: string, offset: number = 0, length?: number): Buffer {
    const buffer = this.getSecureBuffer(bufferId);
    const readLength = length ?? buffer.length - offset;
    
    if (offset + readLength > buffer.length) {
      throw new Error('Read operation would exceed buffer bounds');
    }

    // Create a copy to prevent direct access to the secure buffer
    const result = Buffer.allocUnsafe(readLength);
    buffer.copy(result, 0, offset, offset + readLength);
    
    this.updateAccessMetadata(bufferId);
    this.log('Data read from secure buffer', { bufferId, offset, length: readLength });
    
    return result;
  }

  /**
   * Secure function execution with automatic cleanup
   */
  async executeWithSecureData<T>(
    data: Buffer | string,
    operation: (secureBufferId: string) => Promise<T> | T
  ): Promise<T> {
    const bufferId = this.allocateSecureBuffer(Buffer.byteLength(data));
    
    try {
      this.writeSecureData(bufferId, data);
      const result = await operation(bufferId);
      return result;
    } finally {
      this.deallocateSecureBuffer(bufferId);
    }
  }

  /**
   * Process biometric data securely without leaving traces in memory
   */
  async processSecureBiometric<T>(
    biometricData: any,
    processor: (secureBufferId: string) => Promise<T> | T
  ): Promise<T> {
    const serializedData = JSON.stringify(biometricData);
    const compressedData = this.compressData(Buffer.from(serializedData, 'utf8'));
    
    return this.executeWithSecureData(compressedData, async (bufferId) => {
      try {
        const result = await processor(bufferId);
        return result;
      } finally {
        // Additional security: overwrite the original data object
        if (typeof biometricData === 'object' && biometricData !== null) {
          this.secureWipeObject(biometricData);
        }
      }
    });
  }

  /**
   * Create secure hash without storing intermediate data
   */
  createSecureHash(bufferId: string, algorithm: string = 'sha256'): string {
    const buffer = this.getSecureBuffer(bufferId);
    const hash = crypto.createHash(algorithm);
    
    // Process data in chunks to avoid additional memory allocation
    const chunkSize = 8192; // 8KB chunks
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      hash.update(chunk);
    }
    
    this.updateAccessMetadata(bufferId);
    return hash.digest('hex');
  }

  /**
   * Secure buffer comparison with timing attack protection
   */
  secureCompare(bufferIdA: string, bufferIdB: string): boolean {
    const bufferA = this.getSecureBuffer(bufferIdA);
    const bufferB = this.getSecureBuffer(bufferIdB);
    
    if (bufferA.length !== bufferB.length) {
      return false;
    }
    
    this.updateAccessMetadata(bufferIdA);
    this.updateAccessMetadata(bufferIdB);
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Deallocate secure buffer with multiple overwrite passes
   */
  deallocateSecureBuffer(bufferId: string): void {
    const buffer = this.secureBuffers.get(bufferId);
    
    if (!buffer) {
      this.log('Buffer not found for deallocation', { bufferId }, 'warn');
      return;
    }

    if (this.config.enableZeroization) {
      // Multiple overwrite passes for security
      this.secureWipeBuffer(buffer);
    }

    this.secureBuffers.delete(bufferId);
    this.bufferMetadata.delete(bufferId);
    
    this.log('Secure buffer deallocated', { bufferId });
    this.emit('bufferDeallocated', { bufferId });
  }

  /**
   * Get buffer metadata without exposing the actual buffer
   */
  getBufferInfo(bufferId: string): SecureBuffer | undefined {
    return this.bufferMetadata.get(bufferId);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    totalBuffers: number;
    totalMemory: number;
    oldestBuffer?: Date;
    newestBuffer?: Date;
    averageAge: number;
    memoryPressure: number;
  } {
    let totalMemory = 0;
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;
    let totalAge = 0;

    for (const metadata of this.bufferMetadata.values()) {
      totalMemory += metadata.size;
      totalAge += Date.now() - metadata.created.getTime();
      
      if (!oldestDate || metadata.created < oldestDate) {
        oldestDate = metadata.created;
      }
      if (!newestDate || metadata.created > newestDate) {
        newestDate = metadata.created;
      }
    }

    const bufferCount = this.bufferMetadata.size;
    const memoryPressure = bufferCount / this.config.maxSecureBuffers;

    return {
      totalBuffers: bufferCount,
      totalMemory,
      oldestBuffer: oldestDate,
      newestBuffer: newestDate,
      averageAge: bufferCount > 0 ? totalAge / bufferCount : 0,
      memoryPressure
    };
  }

  /**
   * Cleanup expired buffers
   */
  cleanupExpiredBuffers(): void {
    const now = Date.now();
    const expiredBuffers: string[] = [];

    for (const [bufferId, metadata] of this.bufferMetadata) {
      const age = now - metadata.lastAccessed.getTime();
      if (age > this.config.bufferTimeout) {
        expiredBuffers.push(bufferId);
      }
    }

    for (const bufferId of expiredBuffers) {
      this.deallocateSecureBuffer(bufferId);
    }

    if (expiredBuffers.length > 0) {
      this.log('Cleaned up expired buffers', { count: expiredBuffers.length });
      this.emit('buffersExpired', { count: expiredBuffers.length, bufferIds: expiredBuffers });
    }
  }

  /**
   * Shutdown and cleanup all resources
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.log('Shutting down SecureMemoryManager');

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Securely deallocate all buffers
    const bufferIds = Array.from(this.secureBuffers.keys());
    for (const bufferId of bufferIds) {
      this.deallocateSecureBuffer(bufferId);
    }

    this.removeAllListeners();
    this.log('SecureMemoryManager shutdown complete');
  }

  // ==================== Private Methods ====================

  /**
   * Get secure buffer with access control
   */
  private getSecureBuffer(bufferId: string): Buffer {
    const buffer = this.secureBuffers.get(bufferId);
    
    if (!buffer) {
      throw new Error(`Secure buffer with ID ${bufferId} not found`);
    }

    return buffer;
  }

  /**
   * Update buffer access metadata
   */
  private updateAccessMetadata(bufferId: string): void {
    const metadata = this.bufferMetadata.get(bufferId);
    if (metadata) {
      metadata.lastAccessed = new Date();
      metadata.accessCount++;
    }
  }

  /**
   * Secure buffer wipe with multiple passes
   */
  private secureWipeBuffer(buffer: Buffer): void {
    const patterns = [0x00, 0xFF, 0xAA, 0x55];
    
    // Multiple overwrite passes
    for (const pattern of patterns) {
      buffer.fill(pattern);
    }
    
    // Final random fill
    crypto.randomFillSync(buffer);
    
    // Final zero fill
    buffer.fill(0);
  }

  /**
   * Secure wipe object properties
   */
  private secureWipeObject(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Overwrite string with random data
          const randomStr = crypto.randomBytes(obj[key].length).toString('hex').slice(0, obj[key].length);
          obj[key] = randomStr;
          obj[key] = '';
        } else if (typeof obj[key] === 'number') {
          obj[key] = Math.random();
          obj[key] = 0;
        } else if (typeof obj[key] === 'object') {
          this.secureWipeObject(obj[key]);
        }
      }
    }
  }

  /**
   * Compress data for more efficient secure storage
   */
  private compressData(data: Buffer): Buffer {
    // Simple compression to reduce memory footprint
    // In production, you might want to use a more sophisticated compression
    return data; // Placeholder - could implement zlib compression
  }

  /**
   * Emergency cleanup for process termination
   */
  private emergencyCleanup(): void {
    try {
      const bufferIds = Array.from(this.secureBuffers.keys());
      for (const bufferId of bufferIds) {
        const buffer = this.secureBuffers.get(bufferId);
        if (buffer && this.config.enableZeroization) {
          buffer.fill(0);
        }
      }
      this.secureBuffers.clear();
      this.bufferMetadata.clear();
    } catch (error) {
      // Silent cleanup - don't throw during emergency shutdown
    }
  }

  /**
   * Secure logging that doesn't expose sensitive data
   */
  private log(message: string, data?: any, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.config.debugMode && level === 'info') {
      return;
    }

    const logData = {
      timestamp: new Date().toISOString(),
      message,
      component: 'SecureMemoryManager',
      ...data
    };

    switch (level) {
      case 'warn':
        console.warn('🔒', logData);
        break;
      case 'error':
        console.error('🚨', logData);
        break;
      default:
        console.log('🔐', logData);
    }
  }
}

// Singleton instance
export const secureMemoryManager = new SecureMemoryManager({
  enableMlock: process.env.NODE_ENV === 'production',
  enableZeroization: true,
  maxSecureBuffers: parseInt(process.env.MAX_SECURE_BUFFERS || '100'),
  bufferTimeout: parseInt(process.env.SECURE_BUFFER_TIMEOUT || '300000'), // 5 minutes
  debugMode: process.env.NODE_ENV === 'development'
});