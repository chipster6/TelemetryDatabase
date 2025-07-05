import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Redis } from 'ioredis';

import { 
  ErrorFactory, 
  ErrorType, 
  createErrorHandler, 
  asyncHandler,
  withTimeout,
  handleDatabaseError,
  handleExternalServiceError,
  validateInput,
  validators
} from '../../src/utils/errorHandler';
import { SecurityMonitor } from '../../src/services/SecurityMonitor';
import { logger } from '../../src/utils/logger';

describe('Error Handling Security Tests', () => {
  let app: express.Application;
  let redis: Redis;
  let securityMonitor: SecurityMonitor;

  beforeAll(async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15
    });

    securityMonitor = new SecurityMonitor(redis, logger);
    await securityMonitor.startMonitoring();

    app = express();
    app.use(express.json());
    
    // Add request ID middleware
    app.use((req, res, next) => {
      req.headers['x-request-id'] = `test_${Date.now()}`;
      next();
    });

    setupTestRoutes();
  });

  afterAll(async () => {
    await securityMonitor.stopMonitoring();
    await redis.flushdb();
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  function setupTestRoutes() {
    // Route that throws validation error
    app.get('/api/validation-error', (req, res, next) => {
      next(ErrorFactory.validationError('Invalid input provided', 'testField'));
    });

    // Route that throws authentication error
    app.get('/api/auth-error', (req, res, next) => {
      next(ErrorFactory.authenticationError('Token expired'));
    });

    // Route that throws authorization error
    app.get('/api/auth-denied', (req, res, next) => {
      next(ErrorFactory.authorizationError('Admin access required'));
    });

    // Route that throws rate limit error
    app.get('/api/rate-limit', (req, res, next) => {
      next(ErrorFactory.rateLimitError(60));
    });

    // Route that throws prompt security error
    app.post('/api/prompt-security', (req, res, next) => {
      next(ErrorFactory.promptSecurityError('Injection attempt detected'));
    });

    // Route that throws LLM error
    app.get('/api/llm-error', (req, res, next) => {
      next(ErrorFactory.llmError('Model unavailable', true));
    });

    // Route that throws internal error
    app.get('/api/internal-error', (req, res, next) => {
      next(ErrorFactory.internalError('Database connection failed'));
    });

    // Route that throws unknown error
    app.get('/api/unknown-error', (req, res, next) => {
      const error = new Error('Unknown error occurred');
      error.name = 'UnknownError';
      next(error);
    });

    // Route with async error
    app.get('/api/async-error', asyncHandler(async (req, res) => {
      throw ErrorFactory.timeoutError('Database query', 5000);
    }));

    // Route with validation
    app.post('/api/validate', (req, res, next) => {
      try {
        validateInput(req.body.email, 'email', [validators.required, validators.email]);
        validateInput(req.body.name, 'name', [validators.required, validators.minLength(2), validators.maxLength(50)]);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    });

    // Route that simulates database errors
    app.get('/api/db-error/:type', (req, res, next) => {
      const { type } = req.params;
      let dbError;

      switch (type) {
        case 'connection':
          dbError = new Error('Connection refused');
          dbError.code = 'ECONNREFUSED';
          break;
        case 'timeout':
          dbError = new Error('Connection timeout');
          dbError.code = 'ETIMEDOUT';
          break;
        case 'validation':
          dbError = new Error('Validation failed');
          dbError.name = 'SequelizeValidationError';
          break;
        default:
          dbError = new Error('Generic database error');
      }

      next(handleDatabaseError(dbError));
    });

    // Route that simulates external service errors
    app.get('/api/external-error/:service/:type', (req, res, next) => {
      const { service, type } = req.params;
      let extError;

      switch (type) {
        case 'timeout':
          extError = new Error('Request timeout');
          extError.code = 'ETIMEDOUT';
          break;
        case 'notfound':
          extError = new Error('Service not found');
          extError.code = 'ENOTFOUND';
          break;
        case '500':
          extError = new Error('Internal server error');
          extError.response = { status: 500 };
          break;
        case '400':
          extError = new Error('Bad request');
          extError.response = { status: 400 };
          break;
        default:
          extError = new Error('Generic external error');
      }

      next(handleExternalServiceError(extError, service));
    });

    // Add error handler with security monitoring
    app.use(createErrorHandler({ 
      securityMonitor, 
      includeStack: process.env.NODE_ENV === 'development',
      logLevel: 'error'
    }));
  }

  describe('Error Factory Tests', () => {
    it('should create validation errors correctly', () => {
      const error = ErrorFactory.validationError('Invalid email', 'email');
      
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.statusCode).toBe(400);
      expect(error.userMessage).toBe('Invalid input: Invalid email');
      expect(error.metadata?.field).toBe('email');
    });

    it('should create authentication errors correctly', () => {
      const error = ErrorFactory.authenticationError('Token expired');
      
      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.statusCode).toBe(401);
      expect(error.userMessage).toBe('Authentication required');
      expect(error.internalMessage).toBe('Authentication failed: Token expired');
      expect(error.sensitive).toBe(true);
    });

    it('should create rate limit errors with retry-after', () => {
      const error = ErrorFactory.rateLimitError(120);
      
      expect(error.type).toBe(ErrorType.RATE_LIMIT);
      expect(error.statusCode).toBe(429);
      expect(error.metadata?.retryAfter).toBe(120);
    });

    it('should create prompt security errors', () => {
      const error = ErrorFactory.promptSecurityError('Injection detected');
      
      expect(error.type).toBe(ErrorType.PROMPT_SECURITY);
      expect(error.statusCode).toBe(422);
      expect(error.metadata?.securityViolation).toBe(true);
    });
  });

  describe('Error Handler Middleware Tests', () => {
    it('should handle validation errors with proper response format', async () => {
      const response = await request(app)
        .get('/api/validation-error')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', ErrorType.VALIDATION);
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should handle authentication errors securely', async () => {
      const response = await request(app)
        .get('/api/auth-error')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe(ErrorType.AUTHENTICATION);
      expect(response.body).not.toHaveProperty('internal'); // Should not expose internal details
      expect(response.headers).toHaveProperty('x-security-warning');
    });

    it('should handle authorization errors securely', async () => {
      const response = await request(app)
        .get('/api/auth-denied')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
      expect(response.body.code).toBe(ErrorType.AUTHORIZATION);
      expect(response.headers).toHaveProperty('x-security-warning');
    });

    it('should handle rate limit errors with retry-after header', async () => {
      const response = await request(app)
        .get('/api/rate-limit')
        .expect(429);

      expect(response.body.error).toContain('Rate limit exceeded');
      expect(response.headers).toHaveProperty('retry-after', '60');
    });

    it('should handle prompt security errors', async () => {
      const response = await request(app)
        .post('/api/prompt-security')
        .send({ prompt: 'malicious prompt' })
        .expect(422);

      expect(response.body.error).toBe('Prompt contains potentially harmful content');
      expect(response.body.code).toBe(ErrorType.PROMPT_SECURITY);
      expect(response.headers).toHaveProperty('x-security-warning');
    });

    it('should handle LLM service errors', async () => {
      const response = await request(app)
        .get('/api/llm-error')
        .expect(503);

      expect(response.body.error).toBe('LLM service temporarily unavailable');
      expect(response.body.code).toBe(ErrorType.LLM_ERROR);
    });

    it('should handle internal errors without exposing sensitive information', async () => {
      const response = await request(app)
        .get('/api/internal-error')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.code).toBe(ErrorType.INTERNAL);
      expect(response.body).not.toHaveProperty('internal'); // Should not expose sensitive details
    });

    it('should convert unknown errors to secure format', async () => {
      const response = await request(app)
        .get('/api/unknown-error')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.code).toBe(ErrorType.INTERNAL);
      expect(response.body).toHaveProperty('requestId');
    });

    it('should set security headers correctly', async () => {
      const response = await request(app)
        .get('/api/validation-error')
        .expect(400);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });
  });

  describe('Async Error Handling Tests', () => {
    it('should handle async errors correctly', async () => {
      const response = await request(app)
        .get('/api/async-error')
        .expect(504);

      expect(response.body.error).toBe('Request timeout');
      expect(response.body.code).toBe(ErrorType.TIMEOUT);
    });

    it('should handle timeout wrapper correctly', async () => {
      const slowPromise = new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(
        withTimeout(slowPromise, 100, 'test operation')
      ).rejects.toMatchObject({
        type: ErrorType.TIMEOUT,
        statusCode: 504
      });
    });
  });

  describe('Input Validation Tests', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({})
        .expect(400);

      expect(response.body.code).toBe(ErrorType.VALIDATION);
      expect(response.body.error).toContain('Field is required');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({ email: 'invalid-email', name: 'John' })
        .expect(400);

      expect(response.body.code).toBe(ErrorType.VALIDATION);
      expect(response.body.error).toContain('Must be a valid email');
    });

    it('should validate string length', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({ email: 'test@example.com', name: 'A' })
        .expect(400);

      expect(response.body.code).toBe(ErrorType.VALIDATION);
      expect(response.body.error).toContain('Must be at least 2 characters');
    });

    it('should pass validation with correct input', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({ email: 'test@example.com', name: 'John Doe' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should detect XSS attempts', () => {
      expect(() => {
        validateInput('<script>alert("xss")</script>', 'content', [validators.noXSS]);
      }).toThrow('Contains potentially dangerous content');
    });

    it('should detect SQL injection attempts', () => {
      expect(() => {
        validateInput('{"$ne": null}', 'query', [validators.noSqlInjection]);
      }).toThrow('Contains invalid characters');
    });
  });

  describe('Database Error Handling Tests', () => {
    it('should handle database connection errors', async () => {
      const response = await request(app)
        .get('/api/db-error/connection')
        .expect(503);

      expect(response.body.error).toBe('Database temporarily unavailable');
      expect(response.body.code).toBe(ErrorType.DATABASE);
    });

    it('should handle database timeout errors', async () => {
      const response = await request(app)
        .get('/api/db-error/timeout')
        .expect(503);

      expect(response.body.error).toBe('Database temporarily unavailable');
    });

    it('should handle database validation errors', async () => {
      const response = await request(app)
        .get('/api/db-error/validation')
        .expect(400);

      expect(response.body.error).toContain('Invalid input');
      expect(response.body.code).toBe(ErrorType.VALIDATION);
    });

    it('should handle generic database errors', async () => {
      const response = await request(app)
        .get('/api/db-error/generic')
        .expect(500);

      expect(response.body.error).toBe('Database error occurred');
      expect(response.body.code).toBe(ErrorType.DATABASE);
    });
  });

  describe('External Service Error Handling Tests', () => {
    it('should handle external service timeout', async () => {
      const response = await request(app)
        .get('/api/external-error/api-service/timeout')
        .expect(504);

      expect(response.body.error).toBe('Request timeout');
      expect(response.body.code).toBe(ErrorType.NETWORK);
    });

    it('should handle external service not found', async () => {
      const response = await request(app)
        .get('/api/external-error/api-service/notfound')
        .expect(504);

      expect(response.body.error).toBe('Request timeout');
      expect(response.body.code).toBe(ErrorType.NETWORK);
    });

    it('should handle external service 5xx errors', async () => {
      const response = await request(app)
        .get('/api/external-error/api-service/500')
        .expect(503);

      expect(response.body.error).toBe('External service temporarily unavailable');
      expect(response.body.code).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it('should handle external service 4xx errors', async () => {
      const response = await request(app)
        .get('/api/external-error/api-service/400')
        .expect(502);

      expect(response.body.error).toBe('External service error');
      expect(response.body.code).toBe(ErrorType.EXTERNAL_SERVICE);
    });
  });

  describe('Security Event Recording Tests', () => {
    it('should record security events for security-related errors', async () => {
      await request(app)
        .get('/api/auth-error')
        .expect(401);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = await securityMonitor.getSecurityMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
    });

    it('should record prompt security violations', async () => {
      await request(app)
        .post('/api/prompt-security')
        .send({ prompt: 'malicious content' })
        .expect(422);

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = await securityMonitor.getSecurityMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
    });
  });

  describe('Error Response Security Tests', () => {
    it('should not leak stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/internal-error')
        .expect(500);

      expect(response.body).not.toHaveProperty('internal');
      expect(response.body).not.toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include debug information in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/api/validation-error')
        .expect(400);

      // Non-sensitive errors should include internal details in development
      expect(response.body).toHaveProperty('internal');

      process.env.NODE_ENV = originalEnv;
    });

    it('should never leak sensitive information even in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/api/auth-error')
        .expect(401);

      // Sensitive errors should never expose internal details
      expect(response.body).not.toHaveProperty('internal');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Validator Tests', () => {
    it('should validate UUIDs correctly', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'not-a-uuid';

      expect(validators.uuid(validUUID)).toBe(true);
      expect(validators.uuid(invalidUUID)).toContain('Must be a valid UUID');
    });

    it('should validate number ranges', () => {
      const rangeValidator = validators.range(1, 10);
      
      expect(rangeValidator(5)).toBe(true);
      expect(rangeValidator(0)).toContain('Must be between 1 and 10');
      expect(rangeValidator(11)).toContain('Must be between 1 and 10');
    });

    it('should validate string lengths', () => {
      const minLengthValidator = validators.minLength(3);
      const maxLengthValidator = validators.maxLength(5);

      expect(minLengthValidator('abc')).toBe(true);
      expect(minLengthValidator('ab')).toContain('Must be at least 3 characters');
      
      expect(maxLengthValidator('abcde')).toBe(true);
      expect(maxLengthValidator('abcdef')).toContain('Must be no more than 5 characters');
    });
  });
});