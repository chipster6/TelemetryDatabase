#!/usr/bin/env node

import https from 'https';
import crypto from 'crypto';

/**
 * Utility script to get Ollama certificate fingerprints for pinning
 * Usage: node scripts/get-ollama-cert.js [host] [port]
 */

const host = process.argv[2] || 'localhost';
const port = parseInt(process.argv[3]) || 11434;

console.log(`🔍 Getting certificate fingerprint for ${host}:${port}...`);

const options = {
  hostname: host,
  port: port,
  method: 'GET',
  path: '/',
  rejectUnauthorized: false, // We want to get the cert even if it's self-signed
};

const req = https.request(options, (res) => {
  const cert = res.socket.getPeerCertificate();
  
  if (!cert || !cert.raw) {
    console.error('❌ Could not retrieve certificate');
    process.exit(1);
  }

  // Calculate SHA-256 fingerprint
  const fingerprint = crypto.createHash('sha256').update(cert.raw).digest('hex').toUpperCase();
  
  console.log('\n✅ Certificate Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Host: ${host}:${port}`);
  console.log(`🏷️  Subject: ${cert.subject?.CN || 'Unknown'}`);
  console.log(`🏢 Issuer: ${cert.issuer?.CN || 'Unknown'}`);
  console.log(`📅 Valid From: ${cert.valid_from}`);
  console.log(`📅 Valid To: ${cert.valid_to}`);
  console.log(`🔐 SHA-256 Fingerprint: ${fingerprint}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 Environment Variable:');
  console.log(`OLLAMA_CERT_PINS="${fingerprint}"`);
  
  console.log('\n🔗 For multiple servers (comma-separated):');
  console.log(`OLLAMA_CERT_PINS="${fingerprint},ANOTHER_FINGERPRINT_HERE"`);
  
  console.log('\n⚠️  Security Notes:');
  console.log('• Store this fingerprint securely');
  console.log('• Update when certificates are renewed');
  console.log('• Monitor certificate expiration dates');
  console.log('• Use different pins for dev/staging/prod environments');
  
  // Check if certificate expires soon
  const expiryDate = new Date(cert.valid_to);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 30) {
    console.log(`\n⚠️  WARNING: Certificate expires in ${daysUntilExpiry} days!`);
  }
});

req.on('error', (error) => {
  console.error(`❌ Error connecting to ${host}:${port}:`, error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('• Ensure Ollama is running');
  console.log('• Check if HTTPS is enabled');
  console.log('• Verify the host and port are correct');
  console.log('• For self-signed certificates, this is normal');
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Connection timeout');
  process.exit(1);
});

req.setTimeout(10000); // 10 second timeout
req.end();