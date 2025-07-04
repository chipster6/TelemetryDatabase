#!/usr/bin/env node

/**
 * Environment validation script for security hardening
 * Validates required environment variables and their security properties
 * Fails fast in CI/CD to prevent insecure deployments
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Calculate entropy of a string (Shannon entropy)
 */
function calculateEntropy(str) {
  const freq = {};
  for (let char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  
  for (let count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

/**
 * Check if string has sufficient randomness
 */
function hasGoodRandomness(str, minEntropy = 4.0) {
  const entropy = calculateEntropy(str);
  const hasUppercase = /[A-Z]/.test(str);
  const hasLowercase = /[a-z]/.test(str);
  const hasNumbers = /\d/.test(str);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(str);
  
  const charTypeCount = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  
  return {
    entropy,
    hasGoodEntropy: entropy >= minEntropy,
    hasVariedChars: charTypeCount >= 3,
    score: (entropy / 8) * (charTypeCount / 4) * 100
  };
}

/**
 * Environment variable validation rules
 */
const validationRules = {
  // Required secrets with entropy requirements
  SESSION_SECRET: {
    required: true,
    minLength: 32,
    minEntropy: 4.5,
    type: 'secret',
    description: 'Session encryption secret'
  },
  
  // Weaviate configuration
  WEAVIATE_URL: {
    required: true,
    type: 'url',
    description: 'Weaviate instance URL'
  },
  WEAVIATE_API_KEY: {
    required: true,
    minLength: 20,
    type: 'secret',
    description: 'Weaviate API key'
  },
  
  // Database configuration
  DATABASE_URL: {
    required: false, // Optional since we're using Weaviate primarily
    type: 'url',
    description: 'Database connection URL'
  },
  
  REDIS_URL: {
    required: false, // Optional - falls back to in-memory if not available
    type: 'url',
    description: 'Redis connection URL for distributed state management'
  },
  
  // Security configuration
  CORS_ALLOWED_ORIGINS: {
    required: true,
    type: 'string',
    description: 'Comma-separated list of allowed CORS origins'
  },
  
  // WebAuthn configuration
  WEBAUTHN_RP_ID: {
    required: true,
    type: 'domain',
    description: 'WebAuthn Relying Party ID'
  },
  WEBAUTHN_ORIGIN: {
    required: true,
    type: 'url',
    description: 'WebAuthn origin URL'
  },
  
  // Environment
  NODE_ENV: {
    required: true,
    allowedValues: ['development', 'production', 'test', 'staging'],
    type: 'enum',
    description: 'Node environment'
  }
};

/**
 * Validate a single environment variable
 */
function validateEnvVar(name, value, rule) {
  const errors = [];
  const warnings = [];
  
  // Check if required
  if (rule.required && (!value || value.trim() === '')) {
    errors.push(`${name} is required but not set`);
    return { errors, warnings, valid: false };
  }
  
  // Skip further validation if not set and not required
  if (!value) {
    return { errors, warnings, valid: true };
  }
  
  // Length validation
  if (rule.minLength && value.length < rule.minLength) {
    errors.push(`${name} must be at least ${rule.minLength} characters long (current: ${value.length})`);
  }
  
  // Type-specific validation
  switch (rule.type) {
    case 'secret':
      if (rule.minEntropy) {
        const randomness = hasGoodRandomness(value, rule.minEntropy);
        if (!randomness.hasGoodEntropy) {
          errors.push(`${name} has insufficient entropy (${randomness.entropy.toFixed(2)} < ${rule.minEntropy})`);
        }
        if (!randomness.hasVariedChars) {
          warnings.push(`${name} should contain uppercase, lowercase, numbers, and special characters`);
        }
        if (randomness.score < 70) {
          warnings.push(`${name} security score is low (${randomness.score.toFixed(1)}%)`);
        }
      }
      break;
      
    case 'url':
      try {
        new URL(value);
      } catch (e) {
        errors.push(`${name} is not a valid URL`);
      }
      break;
      
    case 'domain':
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)) {
        errors.push(`${name} is not a valid domain`);
      }
      break;
      
    case 'enum':
      if (rule.allowedValues && !rule.allowedValues.includes(value)) {
        errors.push(`${name} must be one of: ${rule.allowedValues.join(', ')}`);
      }
      break;
  }
  
  return { errors, warnings, valid: errors.length === 0 };
}

/**
 * Check for common security anti-patterns
 */
function checkSecurityAntiPatterns(envVars) {
  const issues = [];
  
  // Check for default/weak passwords
  const weakPatterns = [
    /password/i,
    /123456/,
    /admin/i,
    /test/i,
    /demo/i,
    /secret/i,
    /key/i
  ];
  
  for (const [name, value] of Object.entries(envVars)) {
    if (name.toLowerCase().includes('password') || name.toLowerCase().includes('secret')) {
      for (const pattern of weakPatterns) {
        if (pattern.test(value)) {
          issues.push(`${name} appears to contain weak/default values`);
          break;
        }
      }
    }
  }
  
  // Check for localhost in production
  if (envVars.NODE_ENV === 'production') {
    for (const [name, value] of Object.entries(envVars)) {
      if (value && value.includes('localhost')) {
        issues.push(`${name} contains localhost in production environment`);
      }
    }
  }
  
  return issues;
}

/**
 * Main validation function
 */
function validateEnvironment() {
  info('🔍 Starting environment validation...');
  
  // Load environment variables
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    error('.env file not found');
    process.exit(1);
  }
  
  // Parse .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  info(`📋 Validating ${Object.keys(validationRules).length} environment variables...`);
  
  // Validate each rule
  for (const [name, rule] of Object.entries(validationRules)) {
    const value = envVars[name];
    const result = validateEnvVar(name, value, rule);
    
    if (result.errors.length > 0) {
      error(`${name}: ${rule.description}`);
      result.errors.forEach(err => error(`  ${err}`));
      totalErrors += result.errors.length;
    } else if (value) {
      success(`${name}: ✓`);
    }
    
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => warning(`  ${name}: ${warn}`));
      totalWarnings += result.warnings.length;
    }
  }
  
  // Check for security anti-patterns
  const securityIssues = checkSecurityAntiPatterns(envVars);
  securityIssues.forEach(issue => {
    error(`Security: ${issue}`);
    totalErrors++;
  });
  
  // Generate missing secrets if in development
  if (envVars.NODE_ENV === 'development' && totalErrors > 0) {
    info('\n🔧 Development mode detected. Generating secure values...');
    
    if (!envVars.SESSION_SECRET || validateEnvVar('SESSION_SECRET', envVars.SESSION_SECRET, validationRules.SESSION_SECRET).errors.length > 0) {
      const newSecret = crypto.randomBytes(64).toString('hex');
      info(`Suggested SESSION_SECRET=${newSecret}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  if (totalErrors === 0) {
    success(`✅ Environment validation passed! (${totalWarnings} warnings)`);
    return true;
  } else {
    error(`❌ Environment validation failed! (${totalErrors} errors, ${totalWarnings} warnings)`);
    if (process.env.CI === 'true') {
      error('Failing CI build due to environment validation errors');
    }
    return false;
  }
}

// Run validation
const isValid = validateEnvironment();
process.exit(isValid ? 0 : 1);