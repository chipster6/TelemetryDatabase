# Certificate Pinning for Ollama Security

This document explains how to obtain and configure certificate pinning for secure communication with your Ollama server.

## What is Certificate Pinning?

Certificate pinning is a security technique that validates the exact certificate used by a server, preventing man-in-the-middle attacks even with valid but unauthorized certificates.

## Getting Certificate Fingerprints

### Method 1: Using Our Helper Script (Recommended)

```bash
# Get fingerprint for default Ollama server
npm run get-ollama-cert

# Get fingerprint for specific host/port
npm run get-ollama-cert -- your-ollama-host.com 11434
```

### Method 2: Using OpenSSL

```bash
# For localhost
echo | openssl s_client -servername localhost -connect localhost:11434 2>/dev/null | \
openssl x509 -fingerprint -sha256 -noout | \
sed 's/SHA256 Fingerprint=//g' | \
sed 's/://g'

# For remote host
echo | openssl s_client -servername your-host.com -connect your-host.com:11434 2>/dev/null | \
openssl x509 -fingerprint -sha256 -noout | \
sed 's/SHA256 Fingerprint=//g' | \
sed 's/://g'
```

### Method 3: Using Browser
1. Navigate to `https://your-ollama-host:11434`
2. Click the lock icon → Certificate → Details
3. Copy SHA-256 fingerprint (remove colons)

## Configuration

### Environment Variables

```bash
# Single certificate
OLLAMA_CERT_PINS="A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF123456"

# Multiple certificates (for load balancers, failover, etc.)
OLLAMA_CERT_PINS="CERT1_FINGERPRINT,CERT2_FINGERPRINT,CERT3_FINGERPRINT"

# Optional: Custom CA certificate
OLLAMA_CA_CERT_PATH="/path/to/ca-cert.pem"

# Optional: Client certificate authentication
OLLAMA_CLIENT_CERT_PATH="/path/to/client-cert.pem"
OLLAMA_CLIENT_KEY_PATH="/path/to/client-key.pem"

# Admin API token for certificate management
ADMIN_API_TOKEN="your-secure-admin-token"
```

### Docker Environment

```yaml
# docker-compose.yml
services:
  llm-service:
    environment:
      - OLLAMA_HOST=https://ollama-server:11434
      - OLLAMA_CERT_PINS=A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF123456
      - ADMIN_API_TOKEN=your-secure-admin-token
```

## Certificate Management APIs

### Get Security Status
```bash
curl -H "X-Admin-Token: your-admin-token" \
  http://localhost:3001/api/security/status
```

### Update Certificate Pins
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d '{"fingerprints":["NEW_CERT_FINGERPRINT"]}' \
  http://localhost:3001/api/security/certificate-pins
```

### Test Secure Connection
```bash
curl -X POST \
  -H "X-Admin-Token: your-admin-token" \
  http://localhost:3001/api/security/test-connection
```

### Security Audit Report
```bash
curl -H "X-Admin-Token: your-admin-token" \
  http://localhost:3001/api/security/audit
```

## Certificate Renewal Process

When your Ollama server certificate is renewed:

1. **Get new fingerprint:**
   ```bash
   npm run get-ollama-cert -- your-host 11434
   ```

2. **Update via API (zero-downtime):**
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-Admin-Token: your-admin-token" \
     -d '{"fingerprints":["NEW_FINGERPRINT","OLD_FINGERPRINT"]}' \
     http://localhost:3001/api/security/certificate-pins
   ```

3. **Test new configuration:**
   ```bash
   curl -X POST \
     -H "X-Admin-Token: your-admin-token" \
     http://localhost:3001/api/security/test-connection
   ```

4. **Remove old fingerprint:**
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-Admin-Token: your-admin-token" \
     -d '{"fingerprints":["NEW_FINGERPRINT"]}' \
     http://localhost:3001/api/security/certificate-pins
   ```

## Security Best Practices

### 1. Environment-Specific Pins
- Use different certificate pins for dev/staging/production
- Never share certificate pins between environments

### 2. Certificate Monitoring
- Monitor certificate expiration dates
- Set up alerts for certificates expiring within 30 days
- Automate certificate renewal where possible

### 3. Pin Management
- Store pins securely (encrypted environment variables, secret managers)
- Rotate pins when certificates are renewed
- Use multiple pins only during certificate transitions

### 4. Access Control
- Restrict access to certificate management APIs
- Use strong admin tokens
- Audit all certificate pin changes

## Troubleshooting

### Certificate Pinning Failed
```
Certificate pinning failed. Expected: ABC123..., Got: DEF456...
```
**Solution:** Certificate has changed. Update pins with new fingerprint.

### Connection Timeout
**Check:**
- Ollama server is running
- Network connectivity
- Firewall settings
- HTTPS is properly configured

### Self-Signed Certificates
Self-signed certificates work fine with pinning. The fingerprint validates the exact certificate regardless of CA trust.

### Multiple Load Balancers
If using load balancers with different certificates, pin all certificate fingerprints:
```bash
OLLAMA_CERT_PINS="LB1_CERT,LB2_CERT,LB3_CERT"
```

## Production Deployment

### 1. Initial Setup
```bash
# 1. Get certificate fingerprints for all Ollama servers
npm run get-ollama-cert -- ollama-1.prod.com 11434
npm run get-ollama-cert -- ollama-2.prod.com 11434

# 2. Set environment variables
export OLLAMA_CERT_PINS="CERT1,CERT2"
export ADMIN_API_TOKEN="$(openssl rand -hex 32)"

# 3. Deploy and test
npm run build
npm start
```

### 2. Monitoring
Set up monitoring for:
- Certificate expiration dates
- Failed certificate validations
- Security audit metrics

### 3. Incident Response
If certificate pinning alerts trigger:
1. Verify if legitimate certificate renewal
2. Update pins if legitimate
3. Investigate potential security incident if unexpected

## Integration with CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Update Certificate Pins
  run: |
    NEW_CERT=$(npm run get-ollama-cert -- $OLLAMA_HOST 11434 | grep -o '[A-F0-9]\{64\}')
    curl -X POST \
      -H "Content-Type: application/json" \
      -H "X-Admin-Token: $ADMIN_API_TOKEN" \
      -d "{\"fingerprints\":[\"$NEW_CERT\"]}" \
      $API_URL/api/security/certificate-pins
```