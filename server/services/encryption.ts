// Post-quantum encryption implementation - Updated to use REAL CRYSTALS-Kyber
import { realPostQuantumCrypto, type RealPQCEncryptedData } from './real-post-quantum-crypto.js';

// Legacy interfaces for backward compatibility
export interface QuantumKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
}

export interface EncryptedData {
  data: string;
  keyId: string;
  timestamp: number;
  signature: string;
}

export class PostQuantumEncryption {
  private transitEncryptionEnabled: boolean = true;
  private restEncryptionEnabled: boolean = true;

  constructor() {
    console.log('Post-quantum encryption wrapper initialized - delegating to REAL CRYSTALS-Kyber implementation');
  }

  /**
   * Generate a new REAL CRYSTALS-Kyber key pair
   */
  generateKeyPair(): string {
    return realPostQuantumCrypto.generateKeyPair();
  }

  /**
   * Encrypt data using REAL CRYSTALS-Kyber algorithm
   */
  async encrypt(data: any): Promise<EncryptedData> {
    try {
      const realPqcResult = await realPostQuantumCrypto.encrypt(data);
      
      // Convert to legacy format for backward compatibility
      return {
        data: realPqcResult.data,
        keyId: realPqcResult.keyId,
        timestamp: realPqcResult.timestamp,
        signature: realPqcResult.authTag // Use auth tag as signature
      };
    } catch (error) {
      console.error('REAL CRYSTALS-Kyber Encryption failed:', error);
      throw new Error('REAL post-quantum encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Decrypt data using REAL CRYSTALS-Kyber algorithm
   */
  async decrypt(encryptedData: EncryptedData): Promise<any> {
    try {
      // Convert from legacy format to REAL PQC format
      const realPqcData: RealPQCEncryptedData = {
        data: encryptedData.data,
        keyId: encryptedData.keyId,
        timestamp: encryptedData.timestamp,
        algorithm: 'REAL-ml-kem-768-aes-256-gcm',
        authTag: encryptedData.signature,
        encapsulatedKey: '', // Legacy field
        kyberCiphertext: '' // Will be extracted from data payload
      };
      
      return await realPostQuantumCrypto.decrypt(realPqcData);
    } catch (error) {
      console.error('REAL CRYSTALS-Kyber Decryption failed:', error);
      throw new Error('REAL post-quantum decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Rotate REAL CRYSTALS-Kyber keys for forward secrecy
   */
  rotateKeys(): string {
    return realPostQuantumCrypto.rotateKeys();
  }

  /**
   * Get current REAL CRYSTALS-Kyber key ID
   */
  getCurrentKeyId(): string {
    return realPostQuantumCrypto.getCurrentKeyId();
  }

  /**
   * Export key for cloud backup (security limited)
   */
  exportKey(keyId: string): QuantumKeyPair | undefined {
    const keyInfo = realPostQuantumCrypto.getKeyInfo(keyId);
    if (!keyInfo) return undefined;
    
    // Return limited key info for backward compatibility
    return {
      publicKey: Buffer.from(keyInfo.publicKey).toString('base64'),
      privateKey: '[REAL-CRYSTALS-KYBER-PROTECTED]', // Don't expose private key
      keyId: keyInfo.keyId
    };
  }

  /**
   * Encrypt user data (at rest) with real PQC
   */
  async encryptUserData(userData: any): Promise<EncryptedData> {
    if (!this.restEncryptionEnabled) {
      throw new Error('Data at rest encryption is disabled');
    }
    return this.encrypt(userData);
  }

  /**
   * Encrypt biometric data (at rest) with REAL CRYSTALS-Kyber protection
   */
  async encryptBiometricData(biometricData: any): Promise<EncryptedData> {
    if (!this.restEncryptionEnabled) {
      throw new Error('Data at rest encryption is disabled');
    }
    
    try {
      const realPqcResult = await realPostQuantumCrypto.encryptBiometricData(biometricData);
      
      // Convert to legacy format
      return {
        data: realPqcResult.data,
        keyId: realPqcResult.keyId,
        timestamp: realPqcResult.timestamp,
        signature: realPqcResult.authTag
      };
    } catch (error) {
      console.error('REAL CRYSTALS-Kyber biometric data encryption failed:', error);
      throw new Error('REAL biometric encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Encrypt prompt data (at rest)
   */
  async encryptPromptData(promptData: any): Promise<EncryptedData> {
    if (!this.restEncryptionEnabled) {
      throw new Error('Data at rest encryption is disabled');
    }
    return this.encrypt(promptData);
  }

  /**
   * Encrypt session data (at rest)
   */
  async encryptSessionData(sessionData: any): Promise<EncryptedData> {
    if (!this.restEncryptionEnabled) {
      throw new Error('Data at rest encryption is disabled');
    }
    return this.encrypt(sessionData);
  }

  /**
   * Encrypt data for transmission (in transit)
   */
  async encryptForTransmission(data: any): Promise<EncryptedData> {
    if (!this.transitEncryptionEnabled) {
      throw new Error('Data in transit encryption is disabled');
    }
    return this.encrypt(data);
  }

  /**
   * Decrypt data received from transmission (in transit)
   */
  async decryptFromTransmission(encryptedData: EncryptedData): Promise<any> {
    if (!this.transitEncryptionEnabled) {
      throw new Error('Data in transit encryption is disabled');
    }
    return this.decrypt(encryptedData);
  }

  /**
   * Enable/disable encryption for data at rest
   */
  setRestEncryption(enabled: boolean): void {
    this.restEncryptionEnabled = enabled;
    console.log(`Data at rest encryption ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable encryption for data in transit
   */
  setTransitEncryption(enabled: boolean): void {
    this.transitEncryptionEnabled = enabled;
    console.log(`Data in transit encryption ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get REAL CRYSTALS-Kyber encryption status
   */
  getEncryptionStatus(): { rest: boolean; transit: boolean; realPqcStatus: any } {
    return {
      rest: this.restEncryptionEnabled,
      transit: this.transitEncryptionEnabled,
      realPqcStatus: realPostQuantumCrypto.getStatus()
    };
  }
}

export const postQuantumEncryption = new PostQuantumEncryption();