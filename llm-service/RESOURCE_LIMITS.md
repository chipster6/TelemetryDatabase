# Resource Limits and Anti-Abuse System

This document describes the comprehensive resource limits and anti-abuse mechanisms implemented to protect the LLM service from misuse and ensure system stability.

## Overview

The system implements multiple layers of protection:

1. **Resource Limits** - Control computational resources and prevent abuse
2. **Abuse Detection** - Monitor user behavior patterns and detect malicious activity
3. **Rate Limiting** - Control request frequency per user and IP
4. **Content Security** - Analyze prompts for security threats

## Resource Limits

### Token Management

```typescript
// Default Configuration
{
  maxTokensPerRequest: 8192,      // Maximum tokens per single request
  maxTokensPerUser: 100000,       // Maximum tokens per user per hour
  maxTokensPerUserDaily: 500000,  // Maximum tokens per user per day
}
```

### Concurrency Controls

```typescript
{
  maxConcurrentRequests: 50,        // Global concurrent request limit
  maxConcurrentRequestsPerUser: 3,  // Per-user concurrent request limit
  maxProcessingTimeMs: 300000,      // 5-minute timeout per request
}
```

### Content Limits

```typescript
{
  maxPromptLength: 50000,     // Maximum characters in prompt
  maxResponseLength: 100000,  // Maximum characters in response
}
```

## Abuse Detection

### Pattern Detection

The system monitors for suspicious behavior patterns:

- **Prompt Repetition**: Detects users sending identical or similar prompts repeatedly
- **Request Bursts**: Identifies unusual spikes in request frequency
- **Token Velocity**: Monitors excessive token consumption rates
- **Error Patterns**: Tracks high error rates that may indicate automated abuse

### Content Analysis

```typescript
// Suspicious Keywords Detection
const suspiciousKeywords = [
  'ignore', 'forget', 'disregard', 'override', 'bypass',
  'jailbreak', 'system prompt', 'instructions',
  'pretend', 'roleplay as', 'act as if',
  'developer mode', 'admin mode', 'god mode'
];
```

### Risk Scoring

Users are assigned risk scores based on behavior:

- **Low Risk (1-25)**: Normal usage patterns
- **Medium Risk (26-50)**: Some suspicious activity
- **High Risk (51-100)**: Multiple abuse indicators
- **Critical Risk (100+)**: Automatic blocking

### Response Actions

```typescript
{
  warningThreshold: 30,           // Log warnings
  temporaryBlockThreshold: 60,    // 1-hour block
  permanentBlockThreshold: 120,   // 7-day block
}
```

## API Endpoints

### User Resource Monitoring

```bash
# Get user token usage and limits
GET /api/admin/user-stats/{userId}
Headers: X-Admin-Token: your-admin-token

Response:
{
  "success": true,
  "data": {
    "userId": "user123",
    "tokenUsage": {
      "hourlyUsage": 5000,
      "hourlyLimit": 100000,
      "dailyUsage": 25000,
      "dailyLimit": 500000,
      "hourlyResetIn": 1800000,
      "dailyResetIn": 72000000
    },
    "riskProfile": {
      "riskScore": 15,
      "recentEvents": [],
      "isBlocked": false
    }
  }
}
```

### System Resource Metrics

```bash
# Get overall system resource usage
GET /api/admin/resource-metrics
Headers: X-Admin-Token: your-admin-token

Response:
{
  "success": true,
  "data": {
    "resources": {
      "activeRequests": 12,
      "totalActiveRequests": 12,
      "memoryUsage": {
        "rss": 134217728,
        "heapUsed": 67108864,
        "external": 16777216
      }
    },
    "abuse": {
      "totalUsers": 150,
      "blockedUsers": 3,
      "highRiskUsers": 8,
      "recentAbuseEvents": 5
    }
  }
}
```

### User Management

```bash
# Unblock a user
POST /api/admin/unblock-user
Headers: 
  Content-Type: application/json
  X-Admin-Token: your-admin-token
Body:
{
  "userId": "user123"
}
```

### Security Status Overview

```bash
# Get comprehensive security status
GET /api/admin/security-status
Headers: X-Admin-Token: your-admin-token
```

## Configuration

### Environment Variables

```bash
# Redis configuration (required for resource limits)
REDIS_URL=redis://localhost:6379

# Admin access
ADMIN_API_TOKEN=your-secure-admin-token

# Production vs Development limits
NODE_ENV=production  # Enables stricter limits
```

### Docker Configuration

```yaml
services:
  llm-service:
    environment:
      - REDIS_URL=redis://redis:6379
      - ADMIN_API_TOKEN=${ADMIN_API_TOKEN}
      - NODE_ENV=production
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

## Error Responses

### Resource Limit Exceeded

```json
{
  "success": false,
  "error": "User hourly token limit of 100000 exceeded",
  "code": "HOURLY_TOKEN_LIMIT",
  "retryAfter": 1800
}
```

### Concurrent Request Limit

```json
{
  "success": false,
  "error": "User has 3 concurrent requests. Max allowed: 3",
  "code": "USER_CONCURRENT_LIMIT",
  "retryAfter": 30
}
```

### Abuse Detection

```json
{
  "success": false,
  "error": "Account temporarily suspended due to suspicious activity",
  "code": "ACCOUNT_SUSPENDED"
}
```

### Server Overload

```json
{
  "success": false,
  "error": "Server at maximum capacity. Please try again later.",
  "code": "SERVER_OVERLOADED",
  "retryAfter": 60
}
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Resource Utilization**
   - Active concurrent requests
   - Memory usage
   - Token consumption rates

2. **Abuse Indicators**
   - Number of blocked users
   - High-risk user count
   - Recent abuse events

3. **System Health**
   - Request success rates
   - Average response times
   - Error rates

### Automated Alerts

Set up monitoring for:

```bash
# High resource usage
active_requests > 40  # 80% of limit

# Abuse detection
blocked_users > 10
high_risk_users > 20

# System performance
response_time_p95 > 30000  # 30 seconds
error_rate > 5%
```

## Security Best Practices

### 1. Token Management
- Regularly review user token consumption patterns
- Adjust limits based on legitimate usage patterns
- Monitor for token farming or reselling

### 2. Abuse Prevention
- Review blocked users periodically
- Analyze abuse patterns to improve detection
- Update suspicious keyword lists

### 3. System Protection
- Set conservative limits in production
- Implement graceful degradation under load
- Use circuit breakers for external dependencies

### 4. Monitoring
- Set up real-time dashboards
- Configure automated alerts
- Regular security audits

## Troubleshooting

### High False Positive Rate

If legitimate users are being blocked:

1. Review abuse detection thresholds
2. Analyze user behavior patterns
3. Adjust risk scoring weights
4. Whitelist known good users

### Performance Issues

If the system is slow:

1. Check Redis performance
2. Review resource limit thresholds
3. Monitor memory usage
4. Analyze request patterns

### Configuration Issues

```bash
# Test resource limits
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","prompt":"test"}' \
  http://localhost:3001/api/generate

# Check admin endpoints
curl -H "X-Admin-Token: your-token" \
  http://localhost:3001/api/admin/resource-metrics
```

## Production Deployment

### 1. Redis Setup

Ensure Redis is properly configured:

```bash
# Redis memory configuration
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence for rate limiting data
save 900 1
save 300 10
```

### 2. Monitoring Setup

```yaml
# Prometheus metrics
- name: llm_active_requests
  help: Number of active LLM requests
  type: gauge

- name: llm_blocked_users
  help: Number of currently blocked users
  type: gauge

- name: llm_token_consumption
  help: Token consumption rate
  type: counter
```

### 3. Load Testing

Test the limits before deployment:

```bash
# Concurrent request testing
for i in {1..10}; do
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"userId":"load-test-'$i'","prompt":"test"}' \
    http://localhost:3001/api/generate &
done
```

## Integration with CI/CD

```yaml
# .github/workflows/security-test.yml
- name: Test Resource Limits
  run: |
    # Start service
    npm run build
    npm start &
    
    # Test limits
    npm run test:security
    
    # Check for abuse detection
    npm run test:abuse-detection
```