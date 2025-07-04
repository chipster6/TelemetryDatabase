import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Extend session data interface for CSRF token
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    csrfToken?: string;
  }
}

// Enhanced validation middleware with security controls
export class ValidationError extends Error {
  constructor(public errors: string[], public statusCode: number = 400) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

// Common validation schemas
export const commonSchemas = {
  // User credentials with security requirements
  credentials: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must not exceed 50 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and hyphen')
      .transform(s => s.trim().toLowerCase()),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .refine(
        (password) => {
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasNumber = /\d/.test(password);
          const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
          return [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length >= 3;
        },
        'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters'
      )
  }),

  // ID validation
  id: z.coerce.number()
    .int('ID must be an integer')
    .positive('ID must be positive')
    .max(2147483647, 'ID too large'),

  // Biometric data validation
  biometricData: z.object({
    heartRate: z.number()
      .min(30, 'Heart rate too low')
      .max(220, 'Heart rate too high')
      .optional(),
    hrv: z.number()
      .min(0, 'HRV cannot be negative')
      .max(200, 'HRV too high')
      .optional(),
    stressLevel: z.number()
      .min(0, 'Stress level cannot be negative')
      .max(1, 'Stress level cannot exceed 1')
      .optional(),
    attentionLevel: z.number()
      .min(0, 'Attention level cannot be negative')
      .max(1, 'Attention level cannot exceed 1')
      .optional(),
    cognitiveLoad: z.number()
      .min(0, 'Cognitive load cannot be negative')
      .max(1, 'Cognitive load cannot exceed 1')
      .optional(),
    skinTemperature: z.number()
      .min(20, 'Skin temperature too low')
      .max(50, 'Skin temperature too high')
      .optional(),
    respiratoryRate: z.number()
      .min(5, 'Respiratory rate too low')
      .max(50, 'Respiratory rate too high')
      .optional(),
    oxygenSaturation: z.number()
      .min(70, 'Oxygen saturation too low')
      .max(100, 'Oxygen saturation cannot exceed 100%')
      .optional(),
    sessionId: z.coerce.number().int().positive().optional(),
    environmentalData: z.record(z.any()).optional()
  }),

  // Prompt template validation
  promptTemplate: z.object({
    name: z.string()
      .min(1, 'Template name is required')
      .max(100, 'Template name too long')
      .trim(),
    systemPrompt: z.string()
      .min(10, 'System prompt must be at least 10 characters')
      .max(10000, 'System prompt too long')
      .refine(
        (prompt) => !/<script|javascript:|data:|vbscript:/i.test(prompt),
        'System prompt contains potentially dangerous content'
      ),
    category: z.string()
      .min(1, 'Category is required')
      .max(50, 'Category too long')
      .regex(/^[a-zA-Z0-9\s-]+$/, 'Invalid category format')
      .trim()
  }),

  // Prompt session validation
  promptSession: z.object({
    userPrompt: z.string()
      .min(1, 'User prompt is required')
      .max(5000, 'User prompt too long')
      .refine(
        (prompt) => !/<script|javascript:|data:|vbscript:/i.test(prompt),
        'User prompt contains potentially dangerous content'
      ),
    templateId: z.coerce.number().int().positive().optional(),
    biometricContext: z.record(z.any()).optional()
  }),

  // Device connection validation
  deviceConnection: z.object({
    deviceType: z.enum([
      'heart_rate_monitor',
      'smart_ring',
      'smartwatch',
      'environmental',
      'eeg',
      'other'
    ]),
    deviceName: z.string()
      .min(1, 'Device name is required')
      .max(100, 'Device name too long')
      .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid device name format')
      .trim(),
    connectionStatus: z.enum(['connected', 'disconnected', 'error', 'simulated'])
  }),

  // Pagination validation
  pagination: z.object({
    limit: z.coerce.number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .default(20),
    offset: z.coerce.number()
      .int('Offset must be an integer')
      .min(0, 'Offset cannot be negative')
      .default(0)
  })
};

// Request sanitization
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters (ReDoS safe regex patterns)
    return input
      .replace(/<script[\s\S]*?<\/script>/gi, '') // Fixed ReDoS vulnerability
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Comprehensive prototype pollution protection
      if (key === '__proto__' || 
          key === 'constructor' || 
          key === 'prototype' ||
          key.includes('__proto__') ||
          key.includes('constructor') ||
          key.includes('prototype')) {
        console.warn(`Blocked potentially dangerous key: ${key}`);
        continue;
      }
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Rate limiting for validation failures
const validationFailures = new Map<string, { count: number; lastAttempt: number }>();

function trackValidationFailure(ip: string): boolean {
  const now = Date.now();
  const failures = validationFailures.get(ip) || { count: 0, lastAttempt: 0 };
  
  // Reset count if last attempt was more than 1 hour ago
  if (now - failures.lastAttempt > 60 * 60 * 1000) {
    failures.count = 0;
  }
  
  failures.count++;
  failures.lastAttempt = now;
  validationFailures.set(ip, failures);
  
  // Block if more than 20 validation failures per hour
  return failures.count > 20;
}

// Main validation middleware factory
export function validateRequest(schema: z.ZodSchema, location: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Security: Track validation failures
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Get data from specified location
      let data: any;
      switch (location) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
      }
      
      // Sanitize input to prevent XSS and injection attacks
      const sanitizedData = sanitizeInput(data);
      
      // Validate with schema
      const result = schema.safeParse(sanitizedData);
      
      if (!result.success) {
        // Track validation failure for rate limiting
        const isBlocked = trackValidationFailure(clientIP);
        if (isBlocked) {
          console.warn(`Validation failure rate limit exceeded for IP: ${clientIP}`);
          return res.status(429).json({ 
            error: 'Too many validation failures. Please try again later.' 
          });
        }
        
        const errors = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        
        console.warn(`Validation failed for ${req.method} ${req.path} from ${clientIP}:`, errors);
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }
      
      // Replace original data with validated and sanitized data
      switch (location) {
        case 'body':
          req.body = result.data;
          break;
        case 'query':
          req.query = result.data;
          break;
        case 'params':
          req.params = result.data;
          break;
      }
      
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({ error: 'Internal validation error' });
    }
  };
}

// Specific validation middlewares
export const validateCredentials = validateRequest(commonSchemas.credentials);
export const validateBiometricData = validateRequest(commonSchemas.biometricData);
export const validatePromptTemplate = validateRequest(commonSchemas.promptTemplate);
export const validatePromptSession = validateRequest(commonSchemas.promptSession);
export const validateDeviceConnection = validateRequest(commonSchemas.deviceConnection);
export const validateId = (paramName: string = 'id') => 
  validateRequest(z.object({ [paramName]: commonSchemas.id }), 'params');
export const validatePagination = validateRequest(commonSchemas.pagination, 'query');

// CSRF protection middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // SECURITY FIX: Only skip CSRF for safe methods and non-state-changing GET requests
  if (req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Check for state-changing GET requests that need CSRF protection
  const stateChangingGetPaths = ['/api/logout', '/api/delete', '/api/clear'];
  const isStateChangingGet = req.method === 'GET' && 
    stateChangingGetPaths.some(path => req.path.includes(path));
  
  // Skip CSRF only for non-state-changing GET requests
  if (req.method === 'GET' && !isStateChangingGet) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    console.warn(`CSRF token mismatch for ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  
  next();
}

// Generate CSRF token
export function generateCsrfToken(req: Request): string {
  const token = require('crypto').randomBytes(32).toString('hex');
  if (req.session) {
    req.session.csrfToken = token;
  }
  return token;
}