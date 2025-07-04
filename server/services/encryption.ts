// Post-quantum encryption implementation - Updated to use Trail of Bits AUDITED ML-KEM
import { auditedPostQuantumCrypto, type AuditedPQCEncryptedData } from './audited-post-quantum-crypto.js';

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
    console.log('Post-quantum encryption wrapper initialized - delegating to Trail of Bits AUDITED ML-KEM implementation');
  }

  /**
   * Generate a new Trail of Bits AUDITED ML-KEM key pair
   */
  generateKeyPair(): string {
    return auditedPostQuantumCrypto.generateKeyPair();
  }

  /**
   * Encrypt data using Trail of Bits AUDITED ML-KEM algorithm
   */
  async encrypt(data: any): Promise<EncryptedData> {
    try {
      const auditedPqcResult = await auditedPostQuantumCrypto.encrypt(data);
      
      // Convert to legacy format for backward compatibility
      return {
        data: auditedPqcResult.data,
        keyId: auditedPqcResult.keyId,
        timestamp: auditedPqcResult.timestamp,
        signature: auditedPqcResult.authTag // Use auth tag as signature
      };
    } catch (error) {
      console.error('Trail of Bits AUDITED ML-KEM Encryption failed:', error);
      throw new Error('Audited post-quantum encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Decrypt data using Trail of Bits AUDITED ML-KEM algorithm
   */
  async decrypt(encryptedData: EncryptedData): Promise<any> {
    try {
      // Convert from legacy format to AUDITED PQC format
      const auditedPqcData: AuditedPQCEncryptedData = {
        data: encryptedData.data,
        keyId: encryptedData.keyId,
        timestamp: encryptedData.timestamp,
        algorithm: 'AUDITED-ML-KEM-768-aes-256-gcm',
        authTag: encryptedData.signature,
        encapsulatedKey: '', // Legacy field
        kemCiphertext: '', // Will be extracted from data payload
        version: 'AUDITED-LIBOQS-v1.0'
      };
      
      return await auditedPostQuantumCrypto.decrypt(auditedPqcData);
    } catch (error) {
      console.error('Trail of Bits AUDITED ML-KEM Decryption failed:', error);
      throw new Error('Audited post-quantum decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Rotate Trail of Bits AUDITED ML-KEM keys for forward secrecy
   */
  rotateKeys(): string {
    return auditedPostQuantumCrypto.rotateKeys();
  }

  /**
   * Get current Trail of Bits AUDITED ML-KEM key ID
   */
  getCurrentKeyId(): string {
    return auditedPostQuantumCrypto.getCurrentKeyId();
  }

  /**
   * Export key for cloud backup (security limited)
   */
  exportKey(keyId: string): QuantumKeyPair | undefined {
    const keyInfo = auditedPostQuantumCrypto.getKeyInfo(keyId);
    if (!keyInfo) return undefined;
    
    // Return limited key info for backward compatibility
    return {
      publicKey: Buffer.from(keyInfo.publicKey).toString('base64'),
      privateKey: '[TRAIL-OF-BITS-AUDITED-ML-KEM-PROTECTED]', // Don't expose private key
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
   * Encrypt biometric data (at rest) with Trail of Bits AUDITED ML-KEM protection
   */
  async encryptBiometricData(biometricData: any): Promise<EncryptedData> {
    if (!this.restEncryptionEnabled) {
      throw new Error('Data at rest encryption is disabled');
    }
    
    try {
      const auditedPqcResult = await auditedPostQuantumCrypto.encryptBiometricData(biometricData);
      
      // Convert to legacy format
      return {
        data: auditedPqcResult.data,
        keyId: auditedPqcResult.keyId,
        timestamp: auditedPqcResult.timestamp,
        signature: auditedPqcResult.authTag
      };
    } catch (error) {
      console.error('Trail of Bits AUDITED ML-KEM biometric data encryption failed:', error);
      throw new Error('Audited biometric encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
   * Get Trail of Bits AUDITED ML-KEM encryption status
   */
  getEncryptionStatus(): { rest: boolean; transit: boolean; auditedPqcStatus: any } {
    return {
      rest: this.restEncryptionEnabled,
      transit: this.transitEncryptionEnabled,
      auditedPqcStatus: auditedPostQuantumCrypto.getStatus()
    };
  }
}

export const postQuantumEncryption = new PostQuantumEncryption();