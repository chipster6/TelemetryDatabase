import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { SecurityMonitor } from '../services/SecurityMonitor';

export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR', 
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT_ERROR',
  PROMPT_SECURITY = 'PROMPT_SECURITY_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  NETWORK = 'NETWORK_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR'
}

export interface SecureError extends Error {
  type: ErrorType;
  statusCode: number;
  code: string;
  userMessage: string;
  internalMessage?: string;
  metadata?: Record<string, any>;
  sensitive?: boolean;
  requestId?: string;
  userId?: string;
}

export class ErrorFactory {
  static createSecureError(
    type: ErrorType,
    userMessage: string,
    internalMessage?: string,
    statusCode: number = 500,
    metadata?: Record<string, any>
  ): SecureError {
    const error = new Error(internalMessage || userMessage) as SecureError;
    error.type = type;
    error.statusCode = statusCode;
    error.code = type;
    error.userMessage = userMessage;
    error.internalMessage = internalMessage;
    error.metadata = metadata || {};
    error.sensitive = internalMessage !== userMessage;
    
    return error;
  }

  // Validation Errors (400)
  static validationError(message: string, field?: string): SecureError {
    return this.createSecureError(
      ErrorType.VALIDATION,
      `Invalid input: ${message}`,
      `Validation failed: ${message}`,
      400,
      { field }
    );
  }

  // Authentication Errors (401)
  static authenticationError(message: string = 'Authentication required'): SecureError {
    return this.createSecureError(
      ErrorType.AUTHENTICATION,
      'Authentication required',
      `Authentication failed: ${message}`,
      401
    );
  }

  // Authorization Errors (403)
  static authorizationError(message: string = 'Insufficient permissions'): SecureError {
    return this.createSecureError(
      ErrorType.AUTHORIZATION,
      'Access denied',
      `Authorization failed: ${message}`,
      403
    );
  }

  // Rate Limit Errors (429)
  static rateLimitError(retryAfter?: number): SecureError {
    return this.createSecureError(
      ErrorType.RATE_LIMIT,
      'Rate limit exceeded. Please try again later.',
      'Rate limit exceeded',
      429,
      { retryAfter }
    );
  }

  // Resource Limit Errors (422)
  static resourceLimitError(resource: string, limit: number): SecureError {
    return this.createSecureError(
      ErrorType.RESOURCE_LIMIT,
      `Resource limit exceeded for ${resource}`,
      `Resource limit exceeded: ${resource} limit is ${limit}`,
      422,
      { resource, limit }
    );
  }

  // Prompt Security Errors (422)
  static promptSecurityError(reason: string): SecureError {
    return this.createSecureError(
      ErrorType.PROMPT_SECURITY,
      'Prompt contains potentially harmful content',
      `Prompt security violation: ${reason}`,
      422,
      { securityViolation: true }
    );
  }

  // LLM Service Errors (502/503)
  static llmError(message: string, temporary: boolean = false): SecureError {
    return this.createSecureError(
      ErrorType.LLM_ERROR,
      temporary ? 'LLM service temporarily unavailable' : 'LLM service error',
      `LLM error: ${message}`,
      temporary ? 503 : 502
    );
  }

  // External Service Errors (502/503)
  static externalServiceError(service: string, temporary: boolean = false): SecureError {
    return this.createSecureError(
      ErrorType.EXTERNAL_SERVICE,
      temporary ? 'External service temporarily unavailable' : 'External service error',
      `External service error: ${service}`,
      temporary ? 503 : 502,
      { service }
    );
  }

  // Database Errors (500/503)
  static databaseError(message: string, temporary: boolean = false): SecureError {
    return this.createSecureError(
      ErrorType.DATABASE,
      temporary ? 'Database temporarily unavailable' : 'Database error occurred',
      `Database error: ${message}`,
      temporary ? 503 : 500
    );
  }

  // Network Errors (502/504)
  static networkError(message: string, timeout: boolean = false): SecureError {
    return this.createSecureError(
      ErrorType.NETWORK,
      timeout ? 'Request timeout' : 'Network error occurred',
      `Network error: ${message}`,
      timeout ? 504 : 502
    );
  }

  // Not Found Errors (404)
  static notFoundError(resource: string): SecureError {
    return this.createSecureError(
      ErrorType.NOT_FOUND,
      `${resource} not found`,
      `Resource not found: ${resource}`,
      404,
      { resource }
    );
  }

  // Conflict Errors (409)
  static conflictError(message: string): SecureError {
    return this.createSecureError(
      ErrorType.CONFLICT,
      `Conflict: ${message}`,
      `Conflict error: ${message}`,
      409
    );
  }

  // Timeout Errors (504)
  static timeoutError(operation: string, timeout: number): SecureError {
    return this.createSecureError(
      ErrorType.TIMEOUT,
      'Request timeout',
      `Operation timeout: ${operation} (${timeout}ms)`,
      504,
      { operation, timeout }
    );
  }

  // Internal Errors (500)
  static internalError(message: string, metadata?: Record<string, any>): SecureError {
    return this.createSecureError(
      ErrorType.INTERNAL,
      'Internal server error',
      `Internal error: ${message}`,
      500,
      metadata
    );
  }
}

interface ErrorHandlerOptions {
  securityMonitor?: SecurityMonitor;
  includeStack?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
}

export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const { securityMonitor, includeStack = false, logLevel = 'error' } = options;

  return async (error: any, req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID for tracking
    const requestId = req.headers['x-request-id'] as string || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract user information if available
    const userId = (req as any).user?.userId;

    // Ensure error is a SecureError
    let secureError: SecureError;
    if (error instanceof Error && 'type' in error) {
      secureError = error as SecureError;
    } else {
      // Convert unknown errors to secure format
      secureError = ErrorFactory.internalError(
        error.message || 'Unknown error occurred',
        { originalError: error.name || 'UnknownError' }
      );
    }

    // Add request context
    secureError.requestId = requestId;
    secureError.userId = userId;

    // Enhanced logging with security context
    const logContext = {
      requestId,
      userId,
      errorType: secureError.type,
      errorCode: secureError.code,
      statusCode: secureError.statusCode,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      sensitive: secureError.sensitive,
      metadata: secureError.metadata,
      ...(includeStack && { stack: secureError.stack })
    };

    // Log with appropriate level
    switch (logLevel) {
      case 'warn':
        logger.warn('Request error occurred', logContext);
        break;
      case 'info':
        logger.info('Request error occurred', logContext);
        break;
      default:
        logger.error('Request error occurred', logContext);
    }

    // Record security event if security monitor is available
    if (securityMonitor) {
      try {
        await securityMonitor.recordSecurityEvent(
          'application_error',
          `${req.method} ${req.path}`,
          {
            errorType: secureError.type,
            statusCode: secureError.statusCode,
            sensitive: secureError.sensitive,
            metadata: secureError.metadata
          },
          userId
        );
      } catch (monitorError) {
        logger.error('Failed to record security event', { monitorError });
      }
    }

    // Prevent header modification if already sent
    if (res.headersSent) {
      return next(secureError);
    }

    // Security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'X-Request-ID': requestId
    });

    // Determine response based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Base response structure
    const errorResponse: any = {
      error: secureError.userMessage,
      code: secureError.code,
      requestId,
      timestamp: new Date().toISOString()
    };

    // Add metadata for specific error types (non-sensitive only)
    if (secureError.metadata && !secureError.sensitive) {
      errorResponse.details = secureError.metadata;
    }

    // Development-only information
    if (isDevelopment && !secureError.sensitive) {
      errorResponse.internal = {
        message: secureError.internalMessage,
        type: secureError.type,
        ...(includeStack && { stack: secureError.stack })
      };
    }

    // Special handling for rate limit errors
    if (secureError.type === ErrorType.RATE_LIMIT) {
      if (secureError.metadata?.retryAfter) {
        res.set('Retry-After', secureError.metadata.retryAfter.toString());
      }
    }

    // Special handling for security errors
    if ([ErrorType.PROMPT_SECURITY, ErrorType.AUTHENTICATION, ErrorType.AUTHORIZATION].includes(secureError.type)) {
      // Additional security headers
      res.set('X-Security-Warning', 'Security policy violation detected');
    }

    // Send error response
    res.status(secureError.statusCode).json(errorResponse);
  };
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Promise error wrapper with timeout
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(ErrorFactory.timeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

// Database error wrapper
export function handleDatabaseError(error: any): SecureError {
  if (error.code === 'ECONNREFUSED') {
    return ErrorFactory.databaseError('Connection refused', true);
  }
  
  if (error.code === 'ETIMEDOUT') {
    return ErrorFactory.databaseError('Connection timeout', true);
  }

  if (error.name === 'SequelizeConnectionError') {
    return ErrorFactory.databaseError('Database connection error', true);
  }

  if (error.name === 'SequelizeValidationError') {
    return ErrorFactory.validationError('Database validation failed');
  }

  // Generic database error
  return ErrorFactory.databaseError('Database operation failed');
}

// External service error wrapper
export function handleExternalServiceError(error: any, service: string): SecureError {
  if (error.code === 'ECONNREFUSED') {
    return ErrorFactory.externalServiceError(service, true);
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return ErrorFactory.networkError(`${service} unreachable`, true);
  }

  if (error.response?.status >= 500) {
    return ErrorFactory.externalServiceError(service, true);
  }

  if (error.response?.status >= 400) {
    return ErrorFactory.externalServiceError(service, false);
  }

  return ErrorFactory.networkError(`${service} error`);
}

// Input validation error wrapper
export function validateInput(value: any, field: string, validators: Array<(value: any) => boolean | string>): void {
  for (const validator of validators) {
    const result = validator(value);
    if (result !== true) {
      throw ErrorFactory.validationError(
        typeof result === 'string' ? result : `Invalid ${field}`,
        field
      );
    }
  }
}

// Common validators
export const validators = {
  required: (value: any) => value !== undefined && value !== null && value !== '' || 'Field is required',
  string: (value: any) => typeof value === 'string' || 'Must be a string',
  number: (value: any) => typeof value === 'number' && !isNaN(value) || 'Must be a valid number',
  email: (value: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Must be a valid email',
  uuid: (value: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || 'Must be a valid UUID',
  minLength: (min: number) => (value: any) => value.length >= min || `Must be at least ${min} characters`,
  maxLength: (max: number) => (value: any) => value.length <= max || `Must be no more than ${max} characters`,
  range: (min: number, max: number) => (value: any) => value >= min && value <= max || `Must be between ${min} and ${max}`,
  noSqlInjection: (value: any) => !/[{}$]/.test(value) || 'Contains invalid characters',
  noXSS: (value: any) => !/<script|javascript:|on\w+=/i.test(value) || 'Contains potentially dangerous content'
};