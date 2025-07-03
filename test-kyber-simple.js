// Simple test for CRYSTALS-Kyber implementation
import { ml_kem768 } from '@noble/post-quantum/ml-kem';

console.log('Testing REAL CRYSTALS-Kyber with @noble/post-quantum...');

try {
  // Generate a key pair
  console.log('1. Generating ML-KEM-768 key pair...');
  const keyPair = ml_kem768.keygen();
  console.log(`   ✅ Key pair generated!`);
  console.log(`   Public key: ${keyPair.publicKey.length} bytes`);
  console.log(`   Secret key: ${keyPair.secretKey.length} bytes`);

  // Encapsulate (generate shared secret + ciphertext)
  console.log('2. Performing key encapsulation...');
  const encResult = ml_kem768.encapsulate(keyPair.publicKey);
  console.log(`   ✅ Encapsulation complete!`);
  console.log(`   Shared secret: ${encResult.sharedSecret.length} bytes`);
  console.log(`   Ciphertext: ${encResult.cipherText.length} bytes`);

  // Decapsulate (recover shared secret from ciphertext)
  console.log('3. Performing key decapsulation...');
  const decResult = ml_kem768.decapsulate(encResult.cipherText, keyPair.secretKey);
  console.log(`   ✅ Decapsulation complete!`);
  console.log(`   Recovered shared secret: ${decResult.length} bytes`);

  // Verify shared secrets match
  const secretsMatch = Buffer.from(encResult.sharedSecret).equals(Buffer.from(decResult));
  console.log(`4. Verifying shared secrets match: ${secretsMatch ? '✅ SUCCESS' : '❌ FAILED'}`);

  if (secretsMatch) {
    console.log('\n🎉 REAL CRYSTALS-Kyber (ML-KEM-768) test PASSED!');
    console.log('✅ Post-quantum cryptography is working correctly!');
  } else {
    console.log('\n❌ CRYSTALS-Kyber test FAILED - shared secrets do not match!');
  }

} catch (error) {
  console.error('❌ Test failed with error:', error.message);
  console.error('Stack:', error.stack);
}