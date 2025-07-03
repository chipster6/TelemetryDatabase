#!/usr/bin/env node

// Test REAL CRYSTALS-Kyber implementation
import { realPostQuantumCrypto } from './dist/index.js';

console.log('🧪 Testing REAL CRYSTALS-Kyber Post-Quantum Encryption...\n');

async function testRealCrystalsKyber() {
  try {
    // Test data similar to biometric data
    const testBiometricData = {
      heartRate: 72,
      hrv: 45.2,
      stressLevel: 0.3,
      attentionLevel: 0.8,
      timestamp: Date.now(),
      userId: 'test-user-123',
      deviceId: 'polar-h10-001'
    };

    console.log('📊 Original biometric data:');
    console.log(JSON.stringify(testBiometricData, null, 2));
    console.log('');

    // 1. Test biometric data encryption
    console.log('🔒 Encrypting biometric data with REAL CRYSTALS-Kyber...');
    const encrypted = await realPostQuantumCrypto.encryptBiometricData(testBiometricData);
    
    console.log('✅ Encryption completed!');
    console.log(`   Algorithm: ${encrypted.algorithm}`);
    console.log(`   Key ID: ${encrypted.keyId}`);
    console.log(`   Kyber Ciphertext Size: ${Buffer.from(encrypted.kyberCiphertext, 'base64').length} bytes`);
    console.log(`   Total Encrypted Size: ${Buffer.from(encrypted.data, 'base64').length} bytes`);
    console.log('');

    // 2. Test decryption
    console.log('🔓 Decrypting biometric data with REAL CRYSTALS-Kyber...');
    const decrypted = await realPostQuantumCrypto.decrypt(encrypted);
    
    console.log('✅ Decryption completed!');
    console.log('📊 Decrypted biometric data:');
    console.log(JSON.stringify(decrypted, null, 2));
    console.log('');

    // 3. Verify data integrity
    const originalData = testBiometricData;
    const recoveredData = { ...decrypted };
    delete recoveredData._real_pqc_metadata; // Remove metadata for comparison

    const dataMatches = JSON.stringify(originalData) === JSON.stringify(recoveredData);
    
    console.log('🔍 Data Integrity Check:');
    console.log(`   Original matches decrypted: ${dataMatches ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');

    // 4. Show key status
    const status = realPostQuantumCrypto.getStatus();
    console.log('📋 REAL CRYSTALS-Kyber Status:');
    console.log(`   Current Key ID: ${status.currentKeyId}`);
    console.log(`   Algorithm: ${status.algorithm}`);
    console.log(`   Implementation: ${status.implementation}`);
    console.log(`   Quantum Resistant: ${status.quantumResistant}`);
    console.log(`   Public Key Length: ${status.keySpecs.publicKeyLen} bytes`);
    console.log(`   Message Length: ${status.keySpecs.msgLen} bytes`);
    console.log('');

    // 5. Run comprehensive test
    console.log('🧪 Running comprehensive implementation test...');
    const testResult = await realPostQuantumCrypto.testImplementation();
    
    if (testResult && dataMatches) {
      console.log('🎉 SUCCESS: REAL CRYSTALS-Kyber implementation is working perfectly!');
      console.log('✅ All tests passed - biometric data is properly protected with post-quantum encryption');
      return true;
    } else {
      console.log('❌ FAILURE: REAL CRYSTALS-Kyber implementation has issues');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testRealCrystalsKyber().then(success => {
  console.log(`\n${success ? '✅' : '❌'} REAL CRYSTALS-Kyber test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});