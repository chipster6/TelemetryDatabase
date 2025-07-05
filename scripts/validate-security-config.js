#!/usr/bin/env node

/**
 * Security Configuration Validation Script
 * Run this before deploying to production to validate security settings
 */

const fs = require('fs');
const path = require('path');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const hasEnvFile = fs.existsSync(envPath);

console.log('🔒 TelemetryDatabase Security Configuration Validator');
console.log('================================================');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('');

const errors = [];
const warnings = [];
const recommendations = [];

// Critical environment variables for production
const requiredProdVars = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'WEAVIATE_URL',
  'WEAVIATE_API_KEY'
];

const recommendedVars = [
  'CORS_ALLOWED_ORIGINS',
  'REDIS_URL',
  'BCRYPT_ROUNDS',
  'TRUSTED_PROXIES'
];

const optionalSecurityVars = [
  'ADMIN_IP_WHITELIST',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS'
];

// Check required variables
console.log('🔍 Checking required environment variables...');
for (const envVar of requiredProdVars) {
  const value = process.env[envVar];
  if (!value) {
    errors.push(`Missing required environment variable: ${envVar}`);
  } else {
    console.log(`✅ ${envVar}: configured`);
  }
}

// Check recommended variables
console.log('\n💡 Checking recommended environment variables...');
for (const envVar of recommendedVars) {
  const value = process.env[envVar];
  if (!value) {
    warnings.push(`Missing recommended environment variable: ${envVar}`);
  } else {
    console.log(`✅ ${envVar}: configured`);
  }
}

// Security-specific validations
console.log('\n🔐 Validating security configuration...');

// Session secret validation
const sessionSecret = process.env.SESSION_SECRET;
if (sessionSecret) {
  if (sessionSecret === 'dev-secret' || sessionSecret.length < 32) {
    errors.push('SESSION_SECRET is weak or default (should be 32+ characters)');
  } else {
    console.log('✅ SESSION_SECRET: strong');
  }
}

// Database URL validation
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  if (process.env.NODE_ENV === 'production') {
    if (!dbUrl.includes('sslmode=require') && !dbUrl.includes('ssl=true')) {
      warnings.push('DATABASE_URL should enforce SSL in production (add ?sslmode=require)');
    } else {
      console.log('✅ DATABASE_URL: SSL enforced');
    }
  }
}

// CORS origins validation
const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
if (corsOrigins) {
  const origins = corsOrigins.split(',').map(o => o.trim());
  const httpOrigins = origins.filter(origin => origin.startsWith('http://'));
  
  if (process.env.NODE_ENV === 'production' && httpOrigins.length > 0) {
    errors.push(`Non-HTTPS origins in production: ${httpOrigins.join(', ')}`);
  } else {
    console.log(`✅ CORS_ALLOWED_ORIGINS: ${origins.length} origins configured`);
  }
} else if (process.env.NODE_ENV === 'production') {
  warnings.push('CORS_ALLOWED_ORIGINS not configured - may cause frontend connection issues');
}

// BCrypt rounds validation
const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
if (process.env.NODE_ENV === 'production' && bcryptRounds < 12) {
  warnings.push(`BCRYPT_ROUNDS (${bcryptRounds}) should be at least 12 for production`);
} else {
  console.log(`✅ BCRYPT_ROUNDS: ${bcryptRounds}`);
}

// File system checks
console.log('\n📁 Checking file system security...');

// Check if .env is in .gitignore
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignoreContent.includes('.env')) {
    errors.push('.env file should be added to .gitignore');
  } else {
    console.log('✅ .env is properly ignored by git');
  }
}

// Check for SSL certificates in production
if (process.env.NODE_ENV === 'production') {
  const certPaths = [
    process.env.SSL_CERT_PATH,
    process.env.SSL_KEY_PATH
  ];
  
  if (certPaths.some(path => path)) {
    console.log('✅ SSL certificate paths configured');
  } else {
    recommendations.push('Consider configuring SSL certificates for enhanced security');
  }
}

// Network security checks
console.log('\n🌐 Checking network security configuration...');

const trustedProxies = process.env.TRUSTED_PROXIES;
if (process.env.NODE_ENV === 'production') {
  if (!trustedProxies) {
    recommendations.push('Configure TRUSTED_PROXIES for production deployment behind reverse proxy');
  } else {
    console.log(`✅ TRUSTED_PROXIES: configured`);
  }
}

const adminWhitelist = process.env.ADMIN_IP_WHITELIST;
if (adminWhitelist) {
  const ips = adminWhitelist.split(',').length;
  console.log(`✅ ADMIN_IP_WHITELIST: ${ips} IPs configured`);
} else {
  recommendations.push('Consider configuring ADMIN_IP_WHITELIST for sensitive endpoints');
}

// Summary
console.log('\n📊 Validation Summary');
console.log('==================');

if (errors.length === 0) {
  console.log('✅ Security validation passed!');
} else {
  console.log('❌ Security validation failed with critical errors:');
  errors.forEach(error => console.log(`   🚨 ${error}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach(warning => console.log(`   ⚠️  ${warning}`));
}

if (recommendations.length > 0) {
  console.log('\n💡 Recommendations:');
  recommendations.forEach(rec => console.log(`   💡 ${rec}`));
}

// Environment-specific guidance
console.log('\n📖 Environment-specific guidance:');
if (process.env.NODE_ENV === 'production') {
  console.log('   🏭 Production mode detected');
  console.log('   - Ensure all HTTPS origins in CORS_ALLOWED_ORIGINS');
  console.log('   - Verify DATABASE_URL includes SSL enforcement');
  console.log('   - Consider IP whitelisting for admin endpoints');
  console.log('   - Monitor security logs regularly');
} else {
  console.log('   🛠️  Development mode detected');
  console.log('   - Test with production-like security settings before deploy');
  console.log('   - Ensure all environment variables are documented');
  console.log('   - Use strong secrets even in development');
}

console.log('\n🔗 Security endpoints:');
console.log('   - GET /api/security/status (IP-restricted security validation)');
console.log('   - Monitor application logs for security events');

// Exit with appropriate code
process.exit(errors.length > 0 ? 1 : 0);