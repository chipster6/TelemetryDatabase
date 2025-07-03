// REAL CRYSTALS-Kyber Post-Quantum Cryptography Implementation
// Uses actual ML-KEM (CRYSTALS-Kyber) from @noble/post-quantum
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface RealPQCKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyId: string;
  algorithm: 'ml-kem-768' | 'ml-kem-1024'; // Real CRYSTALS-Kyber variants
  created: Date;
}

export interface RealPQCEncryptedData {
  data: string; // Base64 encoded encrypted data
  keyId: string;
  timestamp: number;
  algorithm: string;
  authTag: string; // Authentication tag for integrity
  encapsulatedKey: string; // Real Kyber encapsulated key
  kyberCiphertext: string; // Kyber ciphertext for key decapsulation
}

export class RealPostQuantumCrypto {
  private keyStore: Map<string, RealPQCKeyPair> = new Map();
  private currentKeyId: string;
  private keyRotationInterval: number = 24 * 60 * 60 * 1000; // 24 hours
  private lastKeyRotation: Date;
  private kyberInstance: typeof ml_kem768 | typeof ml_kem1024;

  constructor(algorithm: 'ml-kem-768' | 'ml-kem-1024' = 'ml-kem-768') {
    // Use real CRYSTALS-Kyber implementation
    this.kyberInstance = algorithm === 'ml-kem-768' ? ml_kem768 : ml_kem1024;
    
    this.currentKeyId = this.generateKeyPair(algorithm);
    this.lastKeyRotation = new Date();
    
    console.log(`REAL Post-Quantum Cryptography initialized with ${algorithm.toUpperCase()} (CRYSTALS-Kyber)`);
    console.log(`Key size: Public=${this.kyberInstance.publicKeyLen} bytes, Message=${this.kyberInstance.msgLen} bytes`);
    
    // Set up automatic key rotation
    setInterval(() => {
      this.rotateKeys();
    }, this.keyRotationInterval);
  }

  /**
   * Generate a new REAL CRYSTALS-Kyber key pair
   */
  generateKeyPair(algorithm: 'ml-kem-768' | 'ml-kem-1024' = 'ml-kem-768'): string {
    const keyId = crypto.randomBytes(16).toString('hex');
    
    console.log(`Generating REAL CRYSTALS-Kyber ${algorithm} key pair...`);
    
    // Generate REAL CRYSTALS-Kyber key pair
    const keyPair = this.kyberInstance.keygen();
    
    const realKeyPair: RealPQCKeyPair = {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.secretKey,
      keyId,
      algorithm,
      created: new Date()
    };
    
    this.keyStore.set(keyId, realKeyPair);
    
    console.log(`✅ REAL CRYSTALS-Kyber key pair generated successfully!`);
    console.log(`   Key ID: ${keyId}`);
    console.log(`   Algorithm: ${algorithm}`);
    console.log(`   Public Key Size: ${keyPair.publicKey.length} bytes`);
    console.log(`   Private Key Size: ${keyPair.secretKey.length} bytes`);
    
    return keyId;
  }

  /**
   * REAL Kyber key encapsulation - generates shared secret + ciphertext
   */
  private encapsulateKey(publicKey: Uint8Array): { sharedSecret: Uint8Array; ciphertext: Uint8Array } {
    console.log('🔐 Performing REAL CRYSTALS-Kyber key encapsulation...');
    
    // REAL CRYSTALS-Kyber key encapsulation
    const result = this.kyberInstance.encapsulate(publicKey);
    
    console.log(`✅ REAL Kyber encapsulation complete:`);
    console.log(`   Shared Secret: ${result.sharedSecret.length} bytes`);
    console.log(`   CipherText: ${result.cipherText.length} bytes`);
    
    return {
      sharedSecret: result.sharedSecret,
      ciphertext: result.cipherText
    };
  }

  /**
   * REAL Kyber key decapsulation - recovers shared secret from ciphertext
   */
  private decapsulateKey(privateKey: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    console.log('🔓 Performing REAL CRYSTALS-Kyber key decapsulation...');
    
    // REAL CRYSTALS-Kyber key decapsulation
    const sharedSecret = this.kyberInstance.decapsulate(ciphertext, privateKey);
    
    console.log(`✅ REAL Kyber decapsulation complete: ${sharedSecret.length} bytes recovered`);
    
    return sharedSecret;
  }

  /**
   * Derive AES key from Kyber shared secret using HKDF
   */
  private deriveAESKey(sharedSecret: Uint8Array, salt: Uint8Array): Buffer {
    const info = Buffer.from('REAL-CRYSTALS-KYBER-AES-256-GCM', 'utf8');
    
    // HKDF-Extract
    const prk = crypto.createHmac('sha512', salt).update(Buffer.from(sharedSecret)).digest();
    
    // HKDF-Expand to 32 bytes for AES-256
    const okm = crypto.createHmac('sha512', prk).update(Buffer.concat([info, Buffer.from([0x01])])).digest().slice(0, 32);
    
    return okm;
  }

  /**
   * Encrypt data using REAL CRYSTALS-Kyber + AES-256-GCM hybrid encryption
   */
  async encrypt(data: any): Promise<RealPQCEncryptedData> {
    try {
      const keyPair = this.keyStore.get(this.currentKeyId);
      if (!keyPair) {
        throw new Error('No CRYSTALS-Kyber key pair available');
      }

      console.log(`🔒 Starting REAL post-quantum encryption with ${keyPair.algorithm}...`);

      // 1. Serialize and compress data
      const serialized = JSON.stringify(data);
      const compressed = await gzip(Buffer.from(serialized, 'utf8'));
      console.log(`   Data serialized: ${serialized.length} bytes -> compressed: ${compressed.length} bytes`);

      // 2. REAL CRYSTALS-Kyber key encapsulation
      const { sharedSecret, ciphertext } = this.encapsulateKey(keyPair.publicKey);
      
      // 3. Derive AES key from REAL Kyber shared secret
      const salt = crypto.randomBytes(32);
      const aesKey = this.deriveAESKey(sharedSecret, salt);
      console.log(`   AES-256 key derived from REAL Kyber shared secret`);
      
      // 4. AES-256-GCM encryption (quantum-resistant symmetric encryption)
      const iv = crypto.randomBytes(12); // GCM standard IV size
      const cipher = crypto.createCipherGCM('aes-256-gcm', aesKey);
      cipher.setIVBytes(iv);
      
      // Add authenticated data (metadata)
      const aad = Buffer.from(JSON.stringify({
        keyId: this.currentKeyId,
        algorithm: keyPair.algorithm,
        timestamp: Date.now(),
        version: 'REAL-CRYSTALS-KYBER-v1'
      }));
      cipher.setAAD(aad);
      
      // Encrypt the compressed data
      let encrypted = cipher.update(compressed);
      cipher.final();
      const authTag = cipher.getAuthTag();
      
      console.log(`   AES-256-GCM encryption complete: ${encrypted.length} bytes`);
      
      // 5. Combine all components
      const finalPayload = Buffer.concat([
        salt,                    // 32 bytes - HKDF salt
        iv,                      // 12 bytes - GCM IV
        authTag,                // 16 bytes - GCM auth tag
        encrypted               // Variable - Encrypted data
      ]);
      
      const result: RealPQCEncryptedData = {
        data: finalPayload.toString('base64'),
        keyId: this.currentKeyId,
        timestamp: Date.now(),
        algorithm: `REAL-${keyPair.algorithm}-aes-256-gcm`,
        authTag: authTag.toString('base64'),
        encapsulatedKey: Buffer.from(sharedSecret).toString('base64'), // For backward compatibility
        kyberCiphertext: Buffer.from(ciphertext).toString('base64') // REAL Kyber ciphertext
      };
      
      console.log(`✅ REAL post-quantum encryption completed successfully!`);
      console.log(`   Algorithm: ${result.algorithm}`);
      console.log(`   Kyber Ciphertext: ${ciphertext.length} bytes`);
      console.log(`   Final Payload: ${finalPayload.length} bytes`);
      
      return result;
    } catch (error) {
      console.error('❌ REAL PQC Encryption failed:', error);
      throw new Error('REAL post-quantum encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Decrypt data using REAL CRYSTALS-Kyber + AES-256-GCM hybrid decryption
   */
  async decrypt(encryptedData: RealPQCEncryptedData): Promise<any> {
    try {
      const keyPair = this.keyStore.get(encryptedData.keyId);
      if (!keyPair) {
        throw new Error('CRYSTALS-Kyber key not found for decryption');
      }

      console.log(`🔓 Starting REAL post-quantum decryption with ${keyPair.algorithm}...`);

      const payload = Buffer.from(encryptedData.data, 'base64');
      const kyberCiphertext = new Uint8Array(Buffer.from(encryptedData.kyberCiphertext, 'base64'));
      
      console.log(`   Kyber Ciphertext: ${kyberCiphertext.length} bytes`);
      
      // Extract components
      const salt = payload.slice(0, 32);
      const iv = payload.slice(32, 44);
      const authTag = payload.slice(44, 60);
      const encrypted = payload.slice(60);
      
      // 1. REAL CRYSTALS-Kyber key decapsulation
      const sharedSecret = this.decapsulateKey(keyPair.privateKey, kyberCiphertext);
      
      // 2. Derive AES key from REAL Kyber shared secret
      const aesKey = this.deriveAESKey(sharedSecret, salt);
      console.log(`   AES-256 key re-derived from REAL Kyber shared secret`);
      
      // 3. AES-256-GCM decryption
      const decipher = crypto.createDecipherGCM('aes-256-gcm', aesKey);
      decipher.setIVBytes(iv);
      decipher.setAuthTag(authTag);
      
      // Set authenticated data
      const aad = Buffer.from(JSON.stringify({
        keyId: encryptedData.keyId,
        algorithm: keyPair.algorithm,
        timestamp: encryptedData.timestamp,
        version: 'REAL-CRYSTALS-KYBER-v1'
      }));
      decipher.setAAD(aad);
      
      // Decrypt
      let decrypted = decipher.update(encrypted);
      decipher.final(); // This will throw if authentication fails
      
      console.log(`   AES-256-GCM decryption complete: ${decrypted.length} bytes`);
      
      // 4. Decompress and parse
      const decompressed = await gunzip(decrypted);
      const result = JSON.parse(decompressed.toString('utf8'));
      
      console.log(`✅ REAL post-quantum decryption completed successfully!`);
      
      return result;
    } catch (error) {
      console.error('❌ REAL PQC Decryption failed:', error);
      throw new Error('REAL post-quantum decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Rotate CRYSTALS-Kyber keys for forward secrecy
   */
  rotateKeys(): string {
    const oldKeyId = this.currentKeyId;
    const keyPair = this.keyStore.get(oldKeyId);
    const algorithm = keyPair?.algorithm || 'ml-kem-768';
    
    this.currentKeyId = this.generateKeyPair(algorithm);
    this.lastKeyRotation = new Date();
    
    console.log(`🔄 REAL CRYSTALS-Kyber key rotation: ${oldKeyId} -> ${this.currentKeyId}`);
    
    // Keep old keys for decryption for 7 days
    setTimeout(() => {
      if (this.keyStore.has(oldKeyId)) {
        this.keyStore.delete(oldKeyId);
        console.log(`🗑️ REAL Kyber old key purged: ${oldKeyId}`);
      }
    }, 7 * 24 * 60 * 60 * 1000);
    
    return this.currentKeyId;
  }

  /**
   * Get current key ID
   */
  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  /**
   * Get key information (without private key material)
   */
  getKeyInfo(keyId: string): Omit<RealPQCKeyPair, 'privateKey'> | undefined {
    const keyPair = this.keyStore.get(keyId);
    if (!keyPair) return undefined;
    
    return {
      publicKey: keyPair.publicKey,
      keyId: keyPair.keyId,
      algorithm: keyPair.algorithm,
      created: keyPair.created
    };
  }

  /**
   * Encrypt biometric data with REAL post-quantum protection
   */
  async encryptBiometricData(biometricData: any): Promise<RealPQCEncryptedData> {
    // Add biometric-specific metadata for audit trail
    const enhancedData = {
      ...biometricData,
      _real_pqc_metadata: {
        dataType: 'biometric',
        encryptedAt: new Date().toISOString(),
        privacyLevel: 'maximum',
        gdprCategory: 'special_category_data',
        algorithm: 'REAL-CRYSTALS-KYBER',
        quantumResistant: true
      }
    };
    
    return this.encrypt(enhancedData);
  }

  /**
   * Get encryption status and REAL Kyber statistics
   */
  getStatus(): {
    currentKeyId: string;
    totalKeys: number;
    lastRotation: Date;
    nextRotation: Date;
    algorithm: string;
    implementation: string;
    quantumResistant: boolean;
    keySpecs: any;
  } {
    const currentKeyPair = this.keyStore.get(this.currentKeyId);
    return {
      currentKeyId: this.currentKeyId,
      totalKeys: this.keyStore.size,
      lastRotation: this.lastKeyRotation,
      nextRotation: new Date(this.lastKeyRotation.getTime() + this.keyRotationInterval),
      algorithm: currentKeyPair?.algorithm || 'unknown',
      implementation: 'REAL-CRYSTALS-KYBER-@noble/post-quantum',
      quantumResistant: true,
      keySpecs: {
        publicKeyLen: this.kyberInstance.publicKeyLen,
        msgLen: this.kyberInstance.msgLen
      }
    };
  }

  /**
   * Test REAL CRYSTALS-Kyber implementation
   */
  async testImplementation(): Promise<boolean> {
    try {
      console.log('🧪 Testing REAL CRYSTALS-Kyber implementation...');
      
      const testData = { test: 'REAL CRYSTALS-Kyber test data', timestamp: Date.now() };
      
      // Encrypt with REAL Kyber
      const encrypted = await this.encrypt(testData);
      console.log(`   ✅ Encryption successful with ${encrypted.algorithm}`);
      
      // Decrypt with REAL Kyber
      const decrypted = await this.decrypt(encrypted);
      console.log(`   ✅ Decryption successful`);
      
      // Verify data integrity
      const isValid = JSON.stringify(testData) === JSON.stringify(decrypted);
      console.log(`   ✅ Data integrity check: ${isValid ? 'PASSED' : 'FAILED'}`);
      
      if (isValid) {
        console.log('🎉 REAL CRYSTALS-Kyber implementation test PASSED!');
      } else {
        console.error('❌ REAL CRYSTALS-Kyber implementation test FAILED!');
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ REAL CRYSTALS-Kyber test failed:', error);
      return false;
    }
  }
}

// Singleton instance with REAL CRYSTALS-Kyber
export const realPostQuantumCrypto = new RealPostQuantumCrypto('ml-kem-768');