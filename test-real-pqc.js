// Test the complete RealPostQuantumCrypto service
import { RealPostQuantumCrypto } from './server/services/real-post-quantum-crypto.ts';

console.log('Testing RealPostQuantumCrypto service...');

try {
  // Create a new instance
  const pqc = new RealPostQuantumCrypto('ml-kem-768');
  
  // Test the implementation
  console.log('Running test implementation...');
  const testResult = await pqc.testImplementation();
  
  if (testResult) {
    console.log('🎉 RealPostQuantumCrypto test PASSED!');
    
    // Get status
    const status = pqc.getStatus();
    console.log('\nService Status:');
    console.log(`  Algorithm: ${status.algorithm}`);
    console.log(`  Implementation: ${status.implementation}`);
    console.log(`  Quantum Resistant: ${status.quantumResistant}`);
    console.log(`  Current Key ID: ${status.currentKeyId}`);
    console.log(`  Total Keys: ${status.totalKeys}`);
    console.log(`  Key Specs:`, status.keySpecs);
    
  } else {
    console.log('❌ RealPostQuantumCrypto test FAILED!');
  }

} catch (error) {
  console.error('❌ Test failed with error:', error.message);
  console.error('Stack:', error.stack);
}