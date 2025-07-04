# Deployment Guide - Trail of Bits Audited Post-Quantum Cryptography

This application uses **professionally audited post-quantum cryptography** from Trail of Bits via the `oqs.js` library, which provides Node.js bindings for the audited `liboqs` implementation.

## 🔒 Security Notice

- **Cryptographic Library**: Trail of Bits audited liboqs (April 2025)
- **Algorithm**: ML-KEM-768 (NIST FIPS 203 compliant)
- **Audit Status**: Professionally audited by Trail of Bits
- **Use Case**: Biometric data protection with quantum-resistant encryption

## 📋 Prerequisites

### Required Build Tools

This application **requires cmake** for compiling the audited cryptographic libraries:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y cmake build-essential python3-dev

# macOS
brew install cmake

# Alpine Linux (Docker)
apk add --no-cache cmake make g++ python3 python3-dev linux-headers

# Verify installation
cmake --version
```

### Node.js Version

- **Required**: Node.js 18.x or higher
- **Recommended**: Node.js 20.x (LTS)

## 🚀 Deployment Options

### 1. GitHub Actions (Recommended)

The project includes pre-configured workflows:

- **CI Pipeline**: `.github/workflows/ci.yml`
  - Installs cmake automatically
  - Tests audited cryptography
  - Runs security verification
  
- **Deployment Pipeline**: `.github/workflows/deploy.yml`
  - Verifies crypto security before deployment
  - Deploys to Cloudflare Pages
  - Includes post-deployment verification

**Required Secrets:**
```
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

### 2. Docker Deployment

```bash
# Build with audited cryptography
docker build -t biometric-telemetry .

# Run container
docker run -p 3000:3000 biometric-telemetry
```

The Dockerfile automatically:
- Installs cmake and build tools
- Compiles Trail of Bits audited liboqs
- Verifies cryptographic security
- Creates production-ready container

### 3. Local Development

```bash
# Install dependencies (requires cmake)
npm install

# Verify cryptographic setup
npm run verify:crypto

# Start development server
npm run dev
```

### 4. Cloudflare Pages/Workers

For Cloudflare deployment:

```bash
# Verify security before deployment
npm run verify:crypto

# Deploy to production
npm run deploy

# Deploy preview
npm run deploy:preview
```

## 🔍 Security Verification

### Automatic Verification

The application includes automatic security checks:

```bash
# Test audited post-quantum cryptography
npm run test:crypto

# Verify cmake availability
npm run verify:cmake

# Complete cryptographic verification
npm run verify:crypto
```

### Manual Verification

Verify the audited implementation status:

```javascript
import { auditedPostQuantumCrypto } from './server/services/audited-post-quantum-crypto.ts';

const status = auditedPostQuantumCrypto.getStatus();
console.log('Security Status:', status);

// Expected output includes:
// - auditFirm: "Trail of Bits"
// - auditStatus: "PROFESSIONALLY_AUDITED"
// - algorithm: "ML-KEM-768"
// - quantumResistant: true
```

## 🛠 Troubleshooting

### cmake Not Found

```bash
# Error: cmake command not found
# Solution: Install cmake
sudo apt-get install cmake  # Ubuntu/Debian
brew install cmake          # macOS
```

### Build Failures

```bash
# Error: node-gyp build failed
# Solution: Install build tools
sudo apt-get install build-essential python3-dev
```

### Cryptographic Verification Failures

```bash
# Error: Trail of Bits audit verification failed
# Solution: Reinstall oqs.js
npm uninstall oqs.js
npm install oqs.js@^0.1.0
npm run verify:crypto
```

## 📊 Deployment Checklist

- [ ] cmake installed and available
- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Cryptographic verification passed (`npm run verify:crypto`)
- [ ] Build completed successfully (`npm run build`)
- [ ] Security audit status confirmed (Trail of Bits)
- [ ] NIST FIPS 203 compliance verified (ML-KEM-768)

## 🔐 Security Compliance

This deployment setup ensures:

- ✅ **Professional Audit**: Trail of Bits cryptographic security audit
- ✅ **NIST Compliance**: FIPS 203 compliant ML-KEM implementation  
- ✅ **Quantum Resistance**: Post-quantum cryptographic algorithms
- ✅ **Biometric Protection**: Appropriate security for sensitive biometric data
- ✅ **Build Verification**: Automatic security checks in CI/CD pipeline
- ✅ **Runtime Verification**: Continuous cryptographic status monitoring

## 📞 Support

For deployment issues related to:
- **cmake/build tools**: Check system package manager installation
- **Cryptographic failures**: Verify Trail of Bits audit status
- **Security compliance**: Review audit verification output