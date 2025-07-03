import { realPostQuantumCrypto } from './server/services/real-post-quantum-crypto.ts';

console.log('Testing REAL CRYSTALS-Kyber implementation...');

try {
  const result = await realPostQuantumCrypto.testImplementation();
  console.log('\nTest result:', result ? 'SUCCESS ✅' : 'FAILED ❌');
  
  const status = realPostQuantumCrypto.getStatus();
  console.log('\nStatus:', JSON.stringify(status, null, 2));
} catch (error) {
  console.error('Test error:', error.message);
  console.error('Stack:', error.stack);
}