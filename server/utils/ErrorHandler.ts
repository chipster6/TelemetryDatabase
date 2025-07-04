import { Request, Response, NextFunction } from 'express';
import { Logger } from './Logger';
import { ERROR_CODES, HTTP_STATUS } from '../constants/ApplicationConstants';

/**
 * Custom error classes for structured error handling
 * Provides consistent error responses and logging
 */

// Base application error
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;
  
  readonly timestamp: string;
  readonly correlationId?: string;

  constructor(
    message: string,
    public readonly details?: object,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.correlationId = correlationId;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get error response object for API
   */
  getErrorResponse(): object {
    return {
      error: {
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(process.env.NODE_ENV === 'development' && { details: this.details })
      }
    };
  }

  /**
   * Get error metadata for logging
   */
  getLogMetadata(): object {
    return {
      errorCode: this.errorCode,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      details: this.details,
      correlationId: this.correlationId,
      stack: this.stack
    };
  }
}

// Validation errors (400)
export class ValidationError extends AppError {
  readonly statusCode = HTTP_STATUS.BAD_REQUEST;
  readonly errorCode = ERROR_CODES.VALIDATION_ERROR;
  readonly isOperational = true;

  constructor(message: string, validationDetails?: object, correlationId?: string) {
    super(message, validationDetails, correlationId);
  }
}

// Authentication errors (401)
export class AuthenticationError extends AppError {
  readonly statusCode = HTTP_STATUS.UNAUTHORIZED;
  readonly errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', details?: object, correlationId?: string) {
    super(message, details, correlationId);
  }
}

// Authorization errors (403)
export class AuthorizationError extends AppError {
  readonly statusCode = HTTP_STATUS.FORBIDDEN;
  readonly errorCode = ERROR_CODES.AUTHORIZATION_ERROR;
  readonly isOperational = true;

  constructor(message: string = 'Insufficient permissions', details?: object, correlationId?: string) {
    super(message, details, correlationId);
  }
}

// Resource not found errors (404)
export class NotFoundError extends AppError {
  readonly statusCode = HTTP_STATUS.NOT_FOUND;
  readonly errorCode = ERROR_CODES.RESOURCE_NOT_FOUND;
  readonly isOperational = true;

  constructor(resource: string, id?: string | number, correlationId?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, { resource, id }, correlationId);
  }
}

// Rate limiting errors (429)
export class RateLimitError extends AppError {
  readonly statusCode = HTTP_STATUS.TOO_MANY_REQUESTS;
  readonly errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED;
  readonly isOperational = true;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, correlationId?: string) {
    super(message, { retryAfter }, correlationId);
  }
}

// Database errors (500)
export class DatabaseError extends AppError {
  readonly statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  readonly errorCode = ERROR_CODES.DATABASE_ERROR;
  readonly isOperational = true;

  constructor(message: string, originalError?: Error, correlationId?: string) {
    super(message, { originalError: originalError?.message }, correlationId);
  }
}

// External service errors (502/503)
export class ExternalServiceError extends AppError {
  readonly statusCode: number;
  readonly errorCode = ERROR_CODES.EXTERNAL_SERVICE_ERROR;
  readonly isOperational = true;

  constructor(
    service: string, 
    message: string, 
    isServiceUnavailable: boolean = false,
    correlationId?: string
  ) {
    super(`${service}: ${message}`, { service }, correlationId);
    this.statusCode = isServiceUnavailable ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.BAD_GATEWAY;
  }
}

// Internal application errors (500)
export class InternalError extends AppError {
  readonly statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  readonly errorCode = ERROR_CODES.INTERNAL_ERROR;
  readonly isOperational = false; // These are programming errors

  constructor(message: string, originalError?: Error, correlationId?: string) {
    super(message, { originalError: originalError?.message }, correlationId);
  }
}

// Conflict errors (409)
export class ConflictError extends AppError {
  readonly statusCode = HTTP_STATUS.CONFLICT;
  readonly errorCode = ERROR_CODES.VALIDATION_ERROR;
  readonly isOperational = true;

  constructor(message: string, conflictDetails?: object, correlationId?: string) {
    super(message, conflictDetails, correlationId);
  }
}

/**
 * Error Handler Middleware and Utilities
 */
export class ErrorHandler {
  private static logger = Logger.getInstance();

  /**
   * Express error handling middleware
   */
  static middleware() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-request-id'] as string || 'unknown';
      
      // Handle known application errors
      if (err instanceof AppError) {
        this.handleAppError(err, req, res);
        return;
      }

      // Handle validation errors from express-validator
      if (err.name === 'ValidationError') {
        const validationError = new ValidationError(err.message, err, correlationId);
        this.handleAppError(validationError, req, res);
        return;
      }

      // Handle mongoose/database errors
      if (err.name === 'MongoError' || err.name === 'CastError') {
        const dbError = new DatabaseError('Database operation failed', err, correlationId);
        this.handleAppError(dbError, req, res);
        return;
      }

      // Handle JWT errors
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        const authError = new AuthenticationError('Invalid or expired token', err, correlationId);
        this.handleAppError(authError, req, res);
        return;
      }

      // Handle unknown errors
      const internalError = new InternalError(
        'An unexpected error occurred',
        err,
        correlationId
      );
      this.handleAppError(internalError, req, res);
    };
  }

  /**
   * Handle application errors
   */
  private static handleAppError(error: AppError, req: Request, res: Response): void {
    const logMetadata = {
      ...error.getLogMetadata(),
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.session?.userId
    };

    // Log based on error type
    if (error.isOperational) {
      if (error.statusCode >= 500) {
        this.logger.error(`Operational Error: ${error.message}`, error, logMetadata);
      } else {
        this.logger.warn(`Client Error: ${error.message}`, logMetadata);
      }
    } else {
      this.logger.error(`Programming Error: ${error.message}`, error, logMetadata);
    }

    // Send response
    res.status(error.statusCode).json(error.getErrorResponse());
  }

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Database operation wrapper with error handling
   */
  static async handleDatabaseOperation<T>(
    operation: () => Promise<T>,
    errorMessage: string = 'Database operation failed',
    correlationId?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new DatabaseError(errorMessage, error as Error, correlationId);
    }
  }

  /**
   * External service call wrapper with error handling
   */
  static async handleExternalService<T>(
    serviceName: string,
    operation: () => Promise<T>,
    correlationId?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const err = error as any;
      const isUnavailable = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
      throw new ExternalServiceError(
        serviceName,
        err.message || 'Service call failed',
        isUnavailable,
        correlationId
      );
    }
  }

  /**
   * Validation wrapper
   */
  static validateInput(condition: boolean, message: string, details?: object, correlationId?: string): void {
    if (!condition) {
      throw new ValidationError(message, details, correlationId);
    }
  }

  /**
   * Authorization check wrapper
   */
  static requireAuth(userId?: number, message?: string, correlationId?: string): void {
    if (!userId) {
      throw new AuthenticationError(message, undefined, correlationId);
    }
  }

  /**
   * Role-based authorization check
   */
  static requireRole(
    userRole: string | undefined,
    requiredRoles: string[],
    correlationId?: string
  ): void {
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new AuthorizationError(
        'Insufficient permissions for this operation',
        { userRole, requiredRoles },
        correlationId
      );
    }
  }

  /**
   * Resource existence check
   */
  static requireResource<T>(
    resource: T | null | undefined,
    resourceName: string,
    id?: string | number,
    correlationId?: string
  ): T {
    if (!resource) {
      throw new NotFoundError(resourceName, id, correlationId);
    }
    return resource;
  }

  /**
   * Handle process errors (uncaught exceptions, unhandled rejections)
   */
  static handleProcessErrors(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception', error, {
        type: 'uncaught_exception',
        pid: process.pid
      });
      
      // Graceful shutdown
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled Rejection', reason, {
        type: 'unhandled_rejection',
        promise: promise.toString(),
        pid: process.pid
      });
      
      // Don't exit immediately for unhandled rejections
      // Log and continue, but consider implementing proper error boundaries
    });

    // Handle warnings
    process.on('warning', (warning: any) => {
      this.logger.warn('Process Warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }

  /**
   * Create error from unknown type
   */
  static createError(error: unknown, defaultMessage: string = 'An error occurred', correlationId?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new InternalError(error.message || defaultMessage, error, correlationId);
    }
    
    if (typeof error === 'string') {
      return new InternalError(error, undefined, correlationId);
    }
    
    return new InternalError(defaultMessage, undefined, correlationId);
  }

  /**
   * Safe error response for production
   */
  static getSafeErrorMessage(error: AppError): string {
    if (process.env.NODE_ENV === 'production' && !error.isOperational) {
      return 'An internal error occurred. Please try again later.';
    }
    return error.message;
  }
}

// Export convenience functions for common error scenarios
export const throwValidationError = (message: string, details?: object, correlationId?: string) => {
  throw new ValidationError(message, details, correlationId);
};

export const throwNotFound = (resource: string, id?: string | number, correlationId?: string) => {
  throw new NotFoundError(resource, id, correlationId);
};

export const throwUnauthorized = (message?: string, correlationId?: string) => {
  throw new AuthenticationError(message, undefined, correlationId);
};

export const throwForbidden = (message?: string, details?: object, correlationId?: string) => {
  throw new AuthorizationError(message, details, correlationId);
};

export const throwConflict = (message: string, details?: object, correlationId?: string) => {
  throw new ConflictError(message, details, correlationId);
};

export const throwDatabaseError = (message: string, originalError?: Error, correlationId?: string) => {
  throw new DatabaseError(message, originalError, correlationId);
};