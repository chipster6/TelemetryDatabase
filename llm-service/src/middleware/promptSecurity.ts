import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ErrorFactory, ErrorType } from '../utils/errorHandler';
import crypto from 'crypto';

export interface PromptSecurityConfig {
  maxPromptLength?: number;
  maxTokens?: number;
  blockedPatterns?: RegExp[];
  allowedDomains?: string[];
  enableHoneypot?: boolean;
  logViolations?: boolean;
}

export interface SecurityViolation {
  type: string;
  description: string;
  pattern?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class PromptSecurityMiddleware {
  private config: Required<PromptSecurityConfig>;
  private defaultBlockedPatterns: RegExp[];

  constructor(config: PromptSecurityConfig = {}) {
    this.config = {
      maxPromptLength: 10000,
      maxTokens: 4096,
      blockedPatterns: [],
      allowedDomains: [],
      enableHoneypot: true,
      logViolations: true,
      ...config
    };

    this.defaultBlockedPatterns = [
      // Prompt injection patterns
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /forget\s+(everything|all|previous)/i,
      /new\s+task\s*:/i,
      /system\s*:\s*/i,
      /\[SYSTEM\]/i,
      /\<\|.*\|\>/,
      /assistant\s+(is\s+)?now/i,
      /roleplay\s+as/i,
      /pretend\s+(to\s+be|you\s+are)/i,
      
      // Code execution attempts
      /exec\s*\(/i,
      /eval\s*\(/i,
      /system\s*\(/i,
      /import\s+os/i,
      /subprocess/i,
      /shell\s*=/i,
      
      // File system access
      /open\s*\(/i,
      /read\s*\(/i,
      /write\s*\(/i,
      /\.\.\/+/,
      /\/etc\/passwd/i,
      /\/proc\//i,
      
      // Network requests
      /urllib/i,
      /requests\./i,
      /fetch\s*\(/i,
      /axios/i,
      /curl\s+/i,
      /wget\s+/i,
      
      // Sensitive data extraction
      /api\s*[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /credential/i,
      
      // SQL injection patterns
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i,
      
      // XSS patterns
      /<script.*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /expression\s*\(/i,
      
      // Template injection
      /\{\{.*\}\}/,
      /\$\{.*\}/,
      /%\{.*\}/,
      
      // Social engineering
      /urgent.*respond/i,
      /verify.*account/i,
      /suspended.*account/i,
      /click.*link/i,
      
      // Attempted model manipulation
      /temperature\s*[=:]\s*[0-9]/i,
      /max_tokens\s*[=:]/i,
      /top_p\s*[=:]/i,
      /frequency_penalty/i,
      
      // Base64/encoding patterns that might hide malicious content
      /[A-Za-z0-9+\/]{100,}={0,2}/,
      
      // Potential data exfiltration
      /exfiltrate/i,
      /extract.*data/i,
      /dump.*database/i,
      /backup.*file/i
    ];
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const violations = this.validateRequest(req);
        
        if (violations.length > 0) {
          this.handleViolations(req, res, violations);
          return;
        }

        // Add security headers
        this.addSecurityHeaders(res);
        
        // Sanitize the prompt
        if (req.body?.prompt) {
          req.body.prompt = this.sanitizePrompt(req.body.prompt);
        }

        next();
      } catch (error) {
        logger.error('Prompt security middleware error:', error);
        res.status(500).json({
          success: false,
          error: 'Security validation failed'
        });
      }
    };
  }

  private validateRequest(req: Request): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    const prompt = req.body?.prompt || '';

    // Check prompt length
    if (prompt.length > this.config.maxPromptLength) {
      violations.push({
        type: 'length_exceeded',
        description: `Prompt length (${prompt.length}) exceeds maximum allowed (${this.config.maxPromptLength})`,
        severity: 'medium'
      });
    }

    // Check for blocked patterns
    const allPatterns = [...this.defaultBlockedPatterns, ...this.config.blockedPatterns];
    
    for (const pattern of allPatterns) {
      if (pattern.test(prompt)) {
        violations.push({
          type: 'blocked_pattern',
          description: 'Prompt contains potentially malicious pattern',
          pattern: pattern.source,
          severity: this.getPatternSeverity(pattern)
        });
      }
    }

    // Check for suspicious character patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(prompt);
    violations.push(...suspiciousPatterns);

    // Check for honeypot patterns if enabled
    if (this.config.enableHoneypot) {
      const honeypotViolations = this.checkHoneypotPatterns(prompt);
      violations.push(...honeypotViolations);
    }

    // Check for encoding attempts
    const encodingViolations = this.checkEncodingAttempts(prompt);
    violations.push(...encodingViolations);

    return violations;
  }

  private detectSuspiciousPatterns(prompt: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Check for excessive special characters
    const specialCharRatio = (prompt.match(/[^a-zA-Z0-9\s]/g) || []).length / prompt.length;
    if (specialCharRatio > 0.3) {
      violations.push({
        type: 'suspicious_characters',
        description: 'Prompt contains unusually high ratio of special characters',
        severity: 'medium'
      });
    }

    // Check for repeated patterns that might indicate automated attacks
    const repeatedPatterns = prompt.match(/(.{10,})\1{3,}/g);
    if (repeatedPatterns) {
      violations.push({
        type: 'repeated_patterns',
        description: 'Prompt contains suspicious repeated patterns',
        severity: 'low'
      });
    }

    // Check for extremely long words (possible buffer overflow attempts)
    const longWords = prompt.split(/\s+/).filter(word => word.length > 100);
    if (longWords.length > 0) {
      violations.push({
        type: 'long_words',
        description: 'Prompt contains unusually long words',
        severity: 'medium'
      });
    }

    // Check for Unicode control characters
    if (/[\u0000-\u001F\u007F-\u009F]/.test(prompt)) {
      violations.push({
        type: 'control_characters',
        description: 'Prompt contains control characters',
        severity: 'medium'
      });
    }

    return violations;
  }

  private checkHoneypotPatterns(prompt: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    // Honeypot patterns that legitimate users wouldn't use
    const honeypotPatterns = [
      /\bDAN\b.*mode/i, // "Do Anything Now" jailbreak
      /grandma.*recipe/i, // Common jailbreak technique
      /opposite.*day/i,
      /evil.*mode/i,
      /debug.*mode/i,
      /admin.*access/i,
      /root.*privilege/i,
      /bypass.*filter/i,
      /override.*safety/i,
      /disable.*protection/i
    ];

    for (const pattern of honeypotPatterns) {
      if (pattern.test(prompt)) {
        violations.push({
          type: 'honeypot_triggered',
          description: 'Prompt triggered honeypot detection',
          pattern: pattern.source,
          severity: 'critical'
        });
      }
    }

    return violations;
  }

  private checkEncodingAttempts(prompt: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Check for potential Base64 encoded payloads
    const base64Matches = prompt.match(/[A-Za-z0-9+\/]{20,}={0,2}/g);
    if (base64Matches) {
      for (const match of base64Matches) {
        try {
          const decoded = Buffer.from(match, 'base64').toString('utf-8');
          // Check if decoded content contains suspicious patterns
          if (this.defaultBlockedPatterns.some(pattern => pattern.test(decoded))) {
            violations.push({
              type: 'encoded_payload',
              description: 'Base64 encoded content contains suspicious patterns',
              severity: 'high'
            });
          }
        } catch (error) {
          // Invalid Base64, might be coincidental
        }
      }
    }

    // Check for URL encoding
    if (/%[0-9A-Fa-f]{2}/.test(prompt)) {
      try {
        const decoded = decodeURIComponent(prompt);
        if (this.defaultBlockedPatterns.some(pattern => pattern.test(decoded))) {
          violations.push({
            type: 'url_encoded_payload',
            description: 'URL encoded content contains suspicious patterns',
            severity: 'high'
          });
        }
      } catch (error) {
        // Invalid URL encoding
      }
    }

    return violations;
  }

  private getPatternSeverity(pattern: RegExp): 'low' | 'medium' | 'high' | 'critical' {
    const source = pattern.source.toLowerCase();
    
    if (source.includes('ignore') || source.includes('forget') || source.includes('system')) {
      return 'critical';
    }
    if (source.includes('exec') || source.includes('eval') || source.includes('script')) {
      return 'high';
    }
    if (source.includes('password') || source.includes('secret') || source.includes('token')) {
      return 'high';
    }
    
    return 'medium';
  }

  private handleViolations(req: Request, res: Response, violations: SecurityViolation[]): void {
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');

    if (this.config.logViolations) {
      logger.warn('Prompt security violations detected', {
        userId: req.body?.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        violations: violations.map(v => ({
          type: v.type,
          severity: v.severity,
          description: v.description
        })),
        promptHash: req.body?.prompt ? crypto.createHash('sha256').update(req.body.prompt).digest('hex') : null
      });
    }

    // Determine response based on severity
    if (criticalViolations.length > 0) {
      res.status(403).json({
        success: false,
        error: 'Request blocked due to security policy violation',
        code: 'SECURITY_VIOLATION',
        violations: criticalViolations.map(v => ({
          type: v.type,
          severity: v.severity
        }))
      });
    } else if (highViolations.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Request contains potentially harmful content',
        code: 'CONTENT_VIOLATION',
        violations: highViolations.map(v => ({
          type: v.type,
          severity: v.severity
        }))
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Request does not meet security requirements',
        code: 'SECURITY_CHECK_FAILED',
        violations: violations.map(v => ({
          type: v.type,
          severity: v.severity
        }))
      });
    }
  }

  private sanitizePrompt(prompt: string): string {
    // Remove potential XSS vectors
    let sanitized = prompt
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/expression\s*\(/gi, '');

    // Remove potential template injection vectors
    sanitized = sanitized
      .replace(/\{\{.*?\}\}/g, '')
      .replace(/\$\{.*?\}/g, '')
      .replace(/%\{.*?\}/g, '');

    // Remove control characters
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  private addSecurityHeaders(res: Response): void {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';"
    });
  }

  // Method to add custom patterns at runtime
  addBlockedPattern(pattern: RegExp): void {
    this.config.blockedPatterns.push(pattern);
  }

  // Method to check a prompt without blocking
  validatePrompt(prompt: string): SecurityViolation[] {
    const mockReq = { body: { prompt } } as Request;
    return this.validateRequest(mockReq);
  }
}

// Factory function for easy setup
export function createPromptSecurity(config?: PromptSecurityConfig): PromptSecurityMiddleware {
  return new PromptSecurityMiddleware(config);
}