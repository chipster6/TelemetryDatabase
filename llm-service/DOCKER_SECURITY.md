# Docker Security Guide

This document outlines the comprehensive security measures implemented in the Docker configuration for the LLM service.

## Security Overview

The secure Docker implementation follows defense-in-depth principles:

1. **Supply Chain Security** - Verified base images and dependency pinning
2. **Container Hardening** - Minimal attack surface with security controls  
3. **Runtime Security** - Proper isolation and access controls
4. **Network Security** - Segmented networks with minimal exposure
5. **Secrets Management** - Secure handling of sensitive data

## Dockerfile Security Features

### Base Image Security

```dockerfile
# Pinned base image with SHA256 verification
FROM nvidia/cuda:12.0-devel-ubuntu22.04@sha256:89be7b94d83264d311f6ec2d8ecdcbb9ea3c8888e29e79b29f1ad9b30f16b69e
```

**Benefits:**
- Prevents supply chain attacks through image tampering
- Ensures reproducible builds
- Guards against upstream vulnerabilities

### Package Pinning

```dockerfile
# Pinned package versions for security and reproducibility
RUN apt-get install -y --no-install-recommends \
    curl=7.81.0-1ubuntu1.16 \
    wget=1.21.2-2ubuntu1 \
    ca-certificates=20230311ubuntu0.22.04.1
```

**Benefits:**
- Prevents malicious package updates
- Ensures consistent security posture
- Enables vulnerability tracking

### Multi-Stage Build Security

```dockerfile
# Stage 1: Base with minimal dependencies
FROM base as dependencies
# Stage 2: Application build
FROM dependencies as builder  
# Stage 3: Production runtime
FROM minimal-runtime as production
```

**Benefits:**
- Reduces final image size and attack surface
- Separates build-time from runtime dependencies
- Prevents build tool access in production

### User Security

```dockerfile
# Create non-root user
RUN groupadd --gid 10001 appgroup && \
    useradd --uid 10001 --gid appgroup --shell /bin/bash --create-home appuser
USER appuser
```

**Benefits:**
- Prevents privilege escalation
- Limits damage from container escape
- Follows principle of least privilege

### File System Security

```dockerfile
# Set secure file permissions
RUN chmod 755 /app && \
    find /app -type f -exec chmod 644 {} \; && \
    chmod +x /app/dist/index.js
```

**Benefits:**
- Prevents unauthorized file access
- Reduces privilege escalation risks
- Enforces secure defaults

## Docker Compose Security

### Network Isolation

```yaml
networks:
  llm-internal:
    driver: bridge
    internal: false  # Controlled external access
  database-internal:
    driver: bridge
    internal: true   # Fully isolated
```

**Benefits:**
- Prevents lateral movement
- Limits blast radius of compromise
- Enforces network segmentation

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 8G
      pids: 100
```

**Benefits:**
- Prevents resource exhaustion attacks
- Limits impact of compromised containers
- Ensures system stability

### Security Context

```yaml
# Security hardening options
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
security_opt:
  - no-new-privileges:true
read_only: true
```

**Benefits:**
- Removes unnecessary capabilities
- Prevents privilege escalation
- Makes filesystem immutable

### Secrets Management

```yaml
secrets:
  admin_token:
    file: ./secrets/admin_token.txt
  ollama_certs:
    file: ./secrets/ollama_cert_pins.txt
```

**Benefits:**
- Keeps secrets out of environment variables
- Provides secure secret injection
- Enables secret rotation

## Security Scanning

### Automated Scanning Script

The `scripts/security-scan.sh` provides comprehensive security analysis:

```bash
# Full security scan
./scripts/security-scan.sh scan

# Specific scans
./scripts/security-scan.sh dockerfile
./scripts/security-scan.sh npm
./scripts/security-scan.sh secrets
```

### Scanning Tools Integration

1. **Hadolint** - Dockerfile best practices
2. **Trivy** - Vulnerability scanning
3. **Docker Scout** - Supply chain security
4. **npm audit** - Dependency vulnerabilities

### Example Scan Output

```
🔒 Starting Security Scan for LLM Service
==================================================

🔍 Scanning Dockerfile for security issues...
✅ Dockerfile security scan passed

🔍 Scanning Node.js dependencies...
✅ No critical npm vulnerabilities found

📊 Generating security report...
✅ Security report generated: ./security-reports/security_report_20241205_143022.md
```

## Production Deployment

### Pre-Deployment Security Checklist

- [ ] Run comprehensive security scan
- [ ] Verify all dependencies are pinned
- [ ] Ensure secrets are properly configured
- [ ] Test resource limits
- [ ] Validate network isolation
- [ ] Check file permissions
- [ ] Verify non-root user configuration

### Security Monitoring

```bash
# Monitor running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check security contexts
docker inspect llm-service-secure | jq '.[0].HostConfig.SecurityOpt'

# Monitor resource usage
docker stats llm-service-secure
```

### Incident Response

If a security issue is detected:

1. **Immediate Actions**
   ```bash
   # Stop compromised container
   docker stop llm-service-secure
   
   # Preserve logs for analysis
   docker logs llm-service-secure > incident-logs.txt
   
   # Check for persistence
   docker inspect llm-service-secure
   ```

2. **Investigation**
   ```bash
   # Run security scan
   ./scripts/security-scan.sh scan
   
   # Check for indicators of compromise
   grep -i "error\|fail\|attack" incident-logs.txt
   ```

3. **Recovery**
   ```bash
   # Rebuild with latest security updates
   docker build -f Dockerfile.secure -t telemetry-llm-service:secure .
   
   # Restart with security monitoring
   docker-compose -f docker-compose.security.yml up -d
   ```

## Security Configuration Files

### Required Security Files

```
security/
├── certs/
│   ├── ca-cert.pem
│   ├── client-cert.pem
│   └── client-key.pem
├── secrets/
│   ├── admin_token.txt
│   ├── ollama_cert_pins.txt
│   └── redis_password.txt
└── configs/
    ├── security-policies.json
    └── clair-config.yaml
```

### File Permissions

```bash
# Set secure permissions
chmod 600 secrets/*.txt
chmod 644 certs/*.pem
chmod 600 certs/*-key.pem
chmod 755 configs/
```

## Compliance and Standards

### Security Standards Compliance

- **NIST Cybersecurity Framework**
- **CIS Docker Benchmark**
- **OWASP Container Security**
- **SOC 2 Type II**

### Audit Requirements

Regular security audits should include:

1. **Monthly** - Dependency vulnerability scans
2. **Quarterly** - Full security assessment
3. **Annually** - Third-party security audit
4. **Continuous** - Automated security monitoring

## Best Practices Summary

### Container Security

✅ **DO:**
- Use pinned base images with SHA verification
- Pin all package versions
- Run as non-root user
- Use multi-stage builds
- Implement health checks
- Set resource limits
- Use read-only filesystems where possible

❌ **DON'T:**
- Use `latest` tags in production
- Run containers as root
- Include build tools in production images
- Store secrets in environment variables
- Disable security features
- Ignore security scan results

### Operational Security

✅ **DO:**
- Regularly update base images
- Monitor security advisories
- Implement automated scanning
- Use secrets management
- Monitor container behavior
- Maintain security documentation

❌ **DON'T:**
- Ignore security warnings
- Use default passwords
- Skip security updates
- Disable logging
- Allow unnecessary network access
- Mix development and production configurations

## Troubleshooting

### Common Security Issues

1. **Permission Denied Errors**
   ```bash
   # Check user configuration
   docker exec llm-service-secure id
   
   # Verify file permissions
   docker exec llm-service-secure ls -la /app
   ```

2. **Network Connectivity Issues**
   ```bash
   # Check network configuration
   docker network ls
   docker network inspect llm-internal
   ```

3. **Secret Access Problems**
   ```bash
   # Verify secret mounting
   docker exec llm-service-secure ls -la /run/secrets/
   ```

### Performance vs Security

Balance security with performance:

- **Read-only filesystem**: May require writable tmpfs mounts
- **Capability dropping**: May affect application functionality
- **Network isolation**: May complicate service discovery
- **Resource limits**: May impact processing performance

### Security Testing

```bash
# Test container security
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image telemetry-llm-service:secure

# Test network isolation
docker exec llm-service-secure netstat -tuln

# Test file permissions
docker exec llm-service-secure find /app -perm /o+w
```

## Updates and Maintenance

### Security Update Process

1. **Monitor Advisories**
   - Subscribe to security mailing lists
   - Use automated vulnerability scanning
   - Track upstream security updates

2. **Test Updates**
   ```bash
   # Build updated image
   docker build -f Dockerfile.secure -t llm-service:test .
   
   # Run security scan
   ./scripts/security-scan.sh scan
   
   # Test functionality
   docker-compose -f docker-compose.test.yml up
   ```

3. **Deploy Updates**
   ```bash
   # Rolling update
   docker-compose -f docker-compose.security.yml up -d --no-deps llm-service
   ```

### Emergency Security Updates

For critical vulnerabilities:

```bash
# Emergency rebuild and deploy
docker build -f Dockerfile.secure -t llm-service:emergency .
docker tag llm-service:emergency llm-service:secure
docker-compose -f docker-compose.security.yml up -d --force-recreate
```

## Conclusion

This security configuration provides comprehensive protection through:

- **Supply chain security** with image and dependency verification
- **Runtime security** with proper isolation and access controls  
- **Network security** with segmentation and minimal exposure
- **Operational security** with monitoring and incident response

Regular security reviews and updates ensure continued protection against evolving threats.