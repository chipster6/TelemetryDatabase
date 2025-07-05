import { Request, Response, NextFunction } from 'express';
import { SecurityMonitor } from '../services/SecurityMonitor';
import { logger } from '../utils/logger';

interface SecurityRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
  securityEvent?: {
    type: string;
    source: string;
    details: Record<string, any>;
  };
}

export function securityIntegrationMiddleware(securityMonitor: SecurityMonitor) {
  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    try {
      // Record general request security event
      const securityEvent = {
        type: 'request',
        source: `${req.method} ${req.path}`,
        details: {
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          contentLength: req.get('content-length'),
          timestamp: new Date().toISOString()
        }
      };

      // Add to request for later use
      req.securityEvent = securityEvent;

      // Check if user is blocked
      if (req.user?.userId) {
        const isBlocked = await securityMonitor.isUserBlocked(req.user.userId);
        if (isBlocked) {
          logger.warn('Blocked user attempted access', {
            userId: req.user.userId,
            path: req.path,
            ip: req.ip
          });

          return res.status(403).json({
            error: 'Access denied due to security policy violation'
          });
        }

        // Record user-specific event
        await securityMonitor.recordSecurityEvent(
          securityEvent.type,
          securityEvent.source,
          securityEvent.details,
          req.user.userId
        );
      } else {
        // Record anonymous event
        await securityMonitor.recordSecurityEvent(
          securityEvent.type,
          securityEvent.source,
          securityEvent.details
        );
      }

      next();
    } catch (error) {
      logger.error('Security integration middleware error', { error });
      next(); // Continue despite error to avoid breaking the application
    }
  };
}

export function authFailureHandler(securityMonitor: SecurityMonitor) {
  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    // This middleware should be called when authentication fails
    try {
      const clientIp = req.ip;
      const userAgent = req.get('User-Agent');

      await securityMonitor.recordSecurityEvent(
        'auth_failure',
        `${req.method} ${req.path}`,
        {
          ip: clientIp,
          userAgent,
          timestamp: new Date().toISOString(),
          failureReason: 'invalid_token'
        }
      );

      // Check for brute force patterns
      const recentFailures = await securityMonitor.redis.get(`auth_failures:${clientIp}`);
      const failureCount = parseInt(recentFailures || '0') + 1;

      await securityMonitor.redis.setex(`auth_failures:${clientIp}`, 3600, failureCount);

      if (failureCount >= 5) {
        await securityMonitor.recordSecurityEvent(
          'auth_failure',
          'brute_force_detection',
          {
            ip: clientIp,
            failureCount,
            userAgent
          }
        );
      }

      next();
    } catch (error) {
      logger.error('Auth failure handler error', { error });
      next();
    }
  };
}

export function promptSecurityHandler(securityMonitor: SecurityMonitor) {
  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    try {
      if (req.body && req.body.prompt) {
        const prompt = req.body.prompt;
        const promptLength = prompt.length;

        // Analyze prompt for security risks
        const suspiciousPatterns = {
          systemOverride: /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|prompts?|rules?)/gi,
          roleManipulation: /(?:act\s+as|pretend\s+to\s+be|you\s+are\s+now)\s+(?:a\s+)?(?:different|new|unrestricted)/gi,
          jailbreak: /(?:jailbreak|DAN|developer\s+mode|god\s+mode|admin\s+mode)/gi,
          dataExtraction: /(?:show|reveal|display|print)\s+(?:your\s+)?(?:system\s+prompt|training\s+data|instructions)/gi,
          bypassing: /(?:bypass|override|disable|turn\s+off)\s+(?:safety|security|restrictions|filters)/gi
        };

        let riskScore = 0;
        const detectedPatterns: string[] = [];

        for (const [patternName, regex] of Object.entries(suspiciousPatterns)) {
          const matches = prompt.match(regex);
          if (matches) {
            riskScore += matches.length * 20;
            detectedPatterns.push(patternName);
          }
        }

        // Additional risk factors
        if (promptLength > 5000) riskScore += 10;
        if (prompt.includes('{{') || prompt.includes('${')) riskScore += 15; // Template injection
        if (/[^\x00-\x7F]/.test(prompt)) riskScore += 5; // Non-ASCII characters

        // Record security event
        await securityMonitor.recordSecurityEvent(
          'prompt_analysis',
          req.path,
          {
            promptLength,
            riskScore,
            detectedPatterns,
            containsSuspiciousContent: riskScore > 30
          },
          req.user?.userId
        );

        // Block high-risk prompts
        if (riskScore > 50) {
          logger.warn('High-risk prompt blocked', {
            userId: req.user?.userId,
            riskScore,
            detectedPatterns,
            promptLength
          });

          return res.status(422).json({
            error: 'Prompt contains potentially harmful content',
            code: 'PROMPT_SECURITY_VIOLATION'
          });
        }

        // Add risk score to request for downstream processing
        req.body.riskScore = riskScore;
      }

      next();
    } catch (error) {
      logger.error('Prompt security handler error', { error });
      next();
    }
  };
}

export function responseSecurityHandler(securityMonitor: SecurityMonitor) {
  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    // Intercept response to analyze for data leakage
    const originalSend = res.send;

    res.send = function(data: any) {
      // Analyze response for potential data leakage
      if (typeof data === 'string' || (typeof data === 'object' && data.response)) {
        const responseText = typeof data === 'string' ? data : data.response;
        
        // Check for potential information disclosure
        const disclosurePatterns = {
          systemInfo: /(?:system|internal|debug|error|stack trace)/gi,
          credentials: /(?:password|token|key|secret|credential)/gi,
          internalPaths: /(?:\/etc\/|\/var\/|\/usr\/|\/root\/|C:\\)/gi,
          apiKeys: /(?:api[_-]key|access[_-]token|secret[_-]key)/gi
        };

        let hasDisclosure = false;
        const disclosureTypes: string[] = [];

        for (const [type, pattern] of Object.entries(disclosurePatterns)) {
          if (pattern.test(responseText)) {
            hasDisclosure = true;
            disclosureTypes.push(type);
          }
        }

        if (hasDisclosure) {
          securityMonitor.recordSecurityEvent(
            'response_analysis',
            'potential_data_disclosure',
            {
              disclosureTypes,
              responseLength: responseText.length
            },
            req.user?.userId
          ).catch(error => {
            logger.error('Failed to record response security event', { error });
          });
        }
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

export function rateLimitSecurityHandler(securityMonitor: SecurityMonitor) {
  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.userId) {
        const userId = req.user.userId;
        const key = `rate_limit_violations:${userId}`;
        
        // Check current rate limit status
        const violations = await securityMonitor.redis.get(key);
        const violationCount = parseInt(violations || '0');

        if (violationCount > 3) {
          await securityMonitor.recordSecurityEvent(
            'rate_limit_abuse',
            req.path,
            {
              violationCount,
              timeWindow: '1hour'
            },
            userId
          );
        }

        // Add rate limit violation tracking to response
        const originalStatus = res.status;
        res.status = function(code: number) {
          if (code === 429) {
            // Rate limit exceeded
            securityMonitor.redis.incr(key).then(() => {
              securityMonitor.redis.expire(key, 3600); // 1 hour expiry
            });

            securityMonitor.recordSecurityEvent(
              'rate_limit_exceeded',
              req.path,
              {
                userId,
                ip: req.ip,
                timestamp: new Date().toISOString()
              },
              userId
            ).catch(error => {
              logger.error('Failed to record rate limit event', { error });
            });
          }

          return originalStatus.call(this, code);
        };
      }

      next();
    } catch (error) {
      logger.error('Rate limit security handler error', { error });
      next();
    }
  };
}

export function errorSecurityHandler(securityMonitor: SecurityMonitor) {
  return async (error: any, req: SecurityRequest, res: Response, next: NextFunction) => {
    try {
      // Record security events for certain types of errors
      const errorType = error.name || 'UnknownError';
      const errorMessage = error.message || 'Unknown error occurred';

      // Security-relevant error types
      const securityErrorTypes = [
        'ValidationError',
        'AuthenticationError',
        'AuthorizationError',
        'SyntaxError',
        'ReferenceError'
      ];

      if (securityErrorTypes.includes(errorType)) {
        await securityMonitor.recordSecurityEvent(
          'application_error',
          req.path,
          {
            errorType,
            errorMessage: errorMessage.substring(0, 500), // Limit message length
            statusCode: error.statusCode || 500,
            stack: error.stack ? error.stack.substring(0, 1000) : undefined
          },
          req.user?.userId
        );
      }

      // Don't expose sensitive error information
      if (res.headersSent) {
        return next(error);
      }

      const statusCode = error.statusCode || 500;
      const isProduction = process.env.NODE_ENV === 'production';

      const errorResponse = {
        error: isProduction ? 'Internal server error' : errorMessage,
        code: error.code || 'INTERNAL_ERROR',
        ...(isProduction ? {} : { stack: error.stack })
      };

      res.status(statusCode).json(errorResponse);
    } catch (handlerError) {
      logger.error('Error security handler failed', { handlerError });
      next(error); // Pass original error
    }
  };
}