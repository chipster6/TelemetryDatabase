// Test CRYSTALS-Kyber with biometric data encryption
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import * as crypto from 'crypto';

console.log('🔐 Testing REAL CRYSTALS-Kyber with Biometric Data Encryption...\n');

async function testBiometricEncryption() {
  try {
    // Generate ML-KEM-768 key pair
    console.log('1. Generating ML-KEM-768 key pair...');
    const keyPair = ml_kem768.keygen();
    console.log(`   ✅ Key pair generated: ${keyPair.publicKey.length}B public, ${keyPair.secretKey.length}B secret`);

    // Simulate biometric data
    const biometricData = {
      heartRate: 72,
      hrv: 45.5,
      stressLevel: 0.35,
      attentionLevel: 0.85,
      cognitiveLoad: 0.6,
      skinTemperature: 36.2,
      timestamp: new Date().toISOString(),
      deviceSource: 'real-device'
    };

    console.log('2. Encrypting biometric data with CRYSTALS-Kyber...');
    
    // Serialize biometric data
    const serializedData = JSON.stringify(biometricData);
    const dataBuffer = Buffer.from(serializedData, 'utf8');
    
    // Perform Kyber key encapsulation
    const { sharedSecret, cipherText } = ml_kem768.encapsulate(keyPair.publicKey);
    console.log(`   🔑 Shared secret generated: ${sharedSecret.length} bytes`);
    console.log(`   📦 Kyber ciphertext: ${cipherText.length} bytes`);
    
    // Derive AES key from Kyber shared secret using HKDF
    const salt = crypto.randomBytes(32);
    const info = Buffer.from('CRYSTALS-KYBER-AES-256-GCM', 'utf8');
    const prk = crypto.createHmac('sha512', salt).update(Buffer.from(sharedSecret)).digest();
    const aesKey = crypto.createHmac('sha512', prk).update(Buffer.concat([info, Buffer.from([0x01])])).digest().slice(0, 32);
    
    // Encrypt with AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    
    let encrypted = cipher.update(dataBuffer);
    cipher.final();
    const authTag = cipher.getAuthTag();
    
    console.log(`   🔒 AES-256-GCM encryption complete: ${encrypted.length} bytes`);
    
    // Create final encrypted package
    const encryptedPackage = {
      kyberCiphertext: Buffer.from(cipherText).toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedData: encrypted.toString('base64'),
      algorithm: 'ML-KEM-768+AES-256-GCM'
    };

    console.log('3. Decrypting biometric data...');
    
    // Decrypt: First recover shared secret with Kyber
    const recoveredSecret = ml_kem768.decapsulate(cipherText, keyPair.secretKey);
    console.log(`   🔓 Shared secret recovered: ${recoveredSecret.length} bytes`);
    
    // Verify shared secrets match
    const secretsMatch = Buffer.from(sharedSecret).equals(Buffer.from(recoveredSecret));
    if (!secretsMatch) {
      throw new Error('Shared secrets do not match!');
    }
    
    // Re-derive AES key
    const recoveredPrk = crypto.createHmac('sha512', salt).update(Buffer.from(recoveredSecret)).digest();
    const recoveredAESKey = crypto.createHmac('sha512', recoveredPrk).update(Buffer.concat([info, Buffer.from([0x01])])).digest().slice(0, 32);
    
    // Decrypt with AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', recoveredAESKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decipher.final();
    
    const recoveredData = JSON.parse(decrypted.toString('utf8'));
    console.log(`   ✅ Decryption successful!`);
    
    // Verify data integrity
    const dataMatches = JSON.stringify(biometricData) === JSON.stringify(recoveredData);
    console.log(`   🔍 Data integrity check: ${dataMatches ? 'PASSED' : 'FAILED'}`);
    
    if (dataMatches) {
      console.log('\n🎉 REAL CRYSTALS-Kyber Biometric Encryption Test PASSED!');
      console.log('✅ Post-quantum protection for biometric data is working!');
      console.log(`📊 Encryption overhead: ${JSON.stringify(encryptedPackage).length - serializedData.length} bytes`);
      return true;
    } else {
      console.log('\n❌ Data integrity check failed!');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testBiometricEncryption().then(success => {
  console.log(`\n${success ? '🟢' : '🔴'} Test ${success ? 'COMPLETED SUCCESSFULLY' : 'FAILED'}`);
});