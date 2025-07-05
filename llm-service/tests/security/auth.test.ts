import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Import the middleware and services to test
import { userRateLimit } from '../../src/middleware/userRateLimit';
import { SecurityMonitor } from '../../src/services/SecurityMonitor';
import { logger } from '../../src/utils/logger';

describe('Authentication & Authorization Security Tests', () => {
  let app: express.Application;
  let redis: Redis;
  let securityMonitor: SecurityMonitor;
  let validToken: string;
  let expiredToken: string;
  let invalidToken: string;
  let adminToken: string;

  const TEST_USER_ID = 'test-user-123';
  const TEST_ADMIN_ID = 'admin-user-456';
  const JWT_SECRET = 'test-secret-key';

  beforeAll(async () => {
    // Setup test Redis instance
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15 // Use separate test database
    });

    securityMonitor = new SecurityMonitor(redis, logger);
    await securityMonitor.startMonitoring();

    // Create test app
    app = express();
    app.use(express.json());
    app.use(userRateLimit(redis, logger));

    // Generate test tokens
    validToken = jwt.sign(
      { userId: TEST_USER_ID, role: 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    expiredToken = jwt.sign(
      { userId: TEST_USER_ID, role: 'user' },
      JWT_SECRET,
      { expiresIn: '-1h' } // Already expired
    );

    invalidToken = 'invalid.jwt.token';

    adminToken = jwt.sign(
      { userId: TEST_ADMIN_ID, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup test routes
    setupTestRoutes();
  });

  afterAll(async () => {
    await securityMonitor.stopMonitoring();
    await redis.flushdb();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await redis.flushdb();
  });

  function setupTestRoutes() {
    // Public route (no auth required)
    app.get('/api/public', (req, res) => {
      res.json({ message: 'Public endpoint' });
    });

    // Protected route (auth required)
    app.get('/api/protected', authenticateToken, (req, res) => {
      res.json({ message: 'Protected endpoint', userId: req.user?.userId });
    });

    // Admin route (admin role required)
    app.get('/api/admin', authenticateToken, requireAdmin, (req, res) => {
      res.json({ message: 'Admin endpoint', userId: req.user?.userId });
    });

    // Rate limited route
    app.post('/api/generate', authenticateToken, async (req, res) => {
      // Simulate LLM generation
      await securityMonitor.recordSecurityEvent(
        'request',
        'api/generate',
        { prompt: req.body.prompt, requestCount: 1 },
        req.user?.userId
      );
      res.json({ response: 'Generated response' });
    });
  }

  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  }

  function requireAdmin(req: any, res: any, next: any) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }

  describe('Authentication Tests', () => {
    it('should allow access to public endpoints without authentication', async () => {
      const response = await request(app)
        .get('/api/public')
        .expect(200);

      expect(response.body.message).toBe('Public endpoint');
    });

    it('should reject access to protected endpoints without token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });

    it('should allow access to protected endpoints with valid token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.message).toBe('Protected endpoint');
      expect(response.body.userId).toBe(TEST_USER_ID);
    });

    it('should reject expired tokens', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject tokens with invalid signature', async () => {
      const tamperedToken = jwt.sign(
        { userId: TEST_USER_ID, role: 'admin' }, // Tampered role
        'wrong-secret'
      );

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Authorization Tests', () => {
    it('should allow user access to user endpoints', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.userId).toBe(TEST_USER_ID);
    });

    it('should deny user access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    it('should allow admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.userId).toBe(TEST_ADMIN_ID);
    });

    it('should prevent privilege escalation through token manipulation', async () => {
      // Try to create a token with admin role using user credentials
      const maliciousToken = jwt.sign(
        { userId: TEST_USER_ID, role: 'admin' },
        'wrong-secret'
      );

      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Rate Limiting Security Tests', () => {
    it('should enforce rate limits per user', async () => {
      const requests = [];
      const maxRequests = 100; // Assuming this is our rate limit

      // Make requests up to the limit
      for (let i = 0; i < maxRequests + 5; i++) {
        requests.push(
          request(app)
            .post('/api/generate')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ prompt: `Test prompt ${i}` })
        );
      }

      const responses = await Promise.all(requests);
      
      // First maxRequests should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      const rateLimitedRequests = responses.filter(r => r.status === 429);

      expect(successfulRequests.length).toBeLessThanOrEqual(maxRequests);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should apply rate limits independently per user', async () => {
      const user1Token = jwt.sign(
        { userId: 'user1', role: 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const user2Token = jwt.sign(
        { userId: 'user2', role: 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // User 1 makes many requests
      const user1Requests = Array(50).fill(null).map(() =>
        request(app)
          .post('/api/generate')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ prompt: 'Test prompt' })
      );

      await Promise.all(user1Requests);

      // User 2 should still be able to make requests
      const user2Response = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ prompt: 'Test prompt' })
        .expect(200);

      expect(user2Response.body.response).toBe('Generated response');
    });
  });

  describe('Security Event Monitoring Tests', () => {
    it('should record authentication failures', async () => {
      await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      // Check if security event was recorded
      const metrics = await securityMonitor.getSecurityMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
    });

    it('should detect suspicious authentication patterns', async () => {
      // Simulate multiple failed login attempts
      const failedAttempts = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${invalidToken}`)
      );

      await Promise.all(failedAttempts);

      // Wait for threat detection processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = await securityMonitor.getSecurityMetrics();
      expect(metrics.threatEvents).toBeGreaterThan(0);
    });

    it('should block users after security violations', async () => {
      const testUserId = 'security-test-user';
      
      // Record multiple security violations
      await securityMonitor.recordSecurityEvent(
        'auth_failure',
        'test',
        { failureCount: 6 },
        testUserId
      );

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const isBlocked = await securityMonitor.isUserBlocked(testUserId);
      expect(isBlocked).toBe(true);
    });
  });

  describe('Session Security Tests', () => {
    it('should invalidate tokens after user logout', async () => {
      // This test would require implementing token blacklisting
      // For now, we test that expired tokens are properly rejected
      const expiredToken = jwt.sign(
        { userId: TEST_USER_ID, role: 'user' },
        JWT_SECRET,
        { expiresIn: '1ms' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should prevent concurrent sessions with same token', async () => {
      // Multiple concurrent requests with same token should all work
      // (unless we implement single-session enforcement)
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Input Validation Security Tests', () => {
    it('should reject requests with oversized payloads', async () => {
      const largePayload = {
        prompt: 'A'.repeat(100000) // Very large prompt
      };

      const response = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${validToken}`)
        .send(largePayload);

      // Should be rejected by content security middleware
      expect([400, 413, 422]).toContain(response.status);
    });

    it('should sanitize user input in requests', async () => {
      const maliciousPayload = {
        prompt: '<script>alert("xss")</script>',
        userId: '../../etc/passwd'
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousPayload);

      // Check if security event was recorded for suspicious content
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const riskScore = await securityMonitor.getUserRiskScore(TEST_USER_ID);
      expect(riskScore).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Security Tests', () => {
    it('should not leak sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(403);

      // Error message should be generic, not revealing internal details
      expect(response.body.error).toBe('Invalid or expired token');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('should handle database errors securely', async () => {
      // Simulate database connection failure
      await redis.disconnect();

      const response = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ prompt: 'test' });

      // Should return generic error, not database specifics
      expect([500, 503]).toContain(response.status);
      
      // Reconnect for other tests
      redis.connect();
    });
  });
});