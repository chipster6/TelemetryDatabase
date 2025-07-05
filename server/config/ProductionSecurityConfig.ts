import { ConfigurationManager } from './ConfigurationManager';
import { SECURITY, SESSION, ENVIRONMENT, HTTP_STATUS } from '../constants/ApplicationConstants';

/**
 * Production Security Configuration Manager
 * Provides hardened security settings for production environments
 */
export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface SecurityConfigOverrides {
  enforceHttps?: boolean;
  strictCorsOrigins?: boolean;
  requireCsrfProtection?: boolean;
  enableSecurityHeaders?: boolean;
  maxSessionAge?: number;
  bcryptRounds?: number;
  allowedOrigins?: string[];
  trustedProxies?: string[];
  ipWhitelist?: string[];
}

export class ProductionSecurityConfig {
  private static instance: ProductionSecurityConfig;
  private config: ConfigurationManager;
  private environment: string;
  private overrides: SecurityConfigOverrides = {};

  private constructor() {
    this.config = ConfigurationManager.getInstance();
    this.environment = process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT;
  }

  static getInstance(): ProductionSecurityConfig {
    if (!ProductionSecurityConfig.instance) {
      ProductionSecurityConfig.instance = new ProductionSecurityConfig();
    }
    return ProductionSecurityConfig.instance;
  }

  /**
   * Apply security configuration overrides
   */
  applyOverrides(overrides: SecurityConfigOverrides): void {
    this.overrides = { ...this.overrides, ...overrides };
    console.log('🔒 Security configuration overrides applied:', Object.keys(overrides));
  }

  /**
   * Get hardened CORS configuration for production
   */
  getCorsConfig(): {
    allowedOrigins: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
    strictMode: boolean;
  } {
    const baseOrigins = this.config.get<string[]>('security.allowedOrigins') || [];
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS 
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
      : [];
    
    let allowedOrigins = [...baseOrigins, ...envOrigins];

    // Apply override if provided
    if (this.overrides.allowedOrigins) {
      allowedOrigins = this.overrides.allowedOrigins;
    }

    // Production hardening
    if (this.isProduction()) {
      // Remove any localhost/dev origins in production
      allowedOrigins = allowedOrigins.filter(origin => 
        !origin.includes('localhost') && 
        !origin.includes('127.0.0.1') && 
        !origin.includes('0.0.0.0') &&
        origin.startsWith('https://') // Enforce HTTPS in production
      );

      // Validate all origins use HTTPS
      const invalidOrigins = allowedOrigins.filter(origin => !origin.startsWith('https://'));
      if (invalidOrigins.length > 0) {
        console.warn('⚠️  Non-HTTPS origins detected in production:', invalidOrigins);
      }
    }

    return {
      allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization', 
        'x-csrf-token',
        'x-request-id',
        'x-correlation-id',
        'x-api-key' // For authenticated API access
      ],
      exposedHeaders: ['x-request-id', 'x-correlation-id'],
      maxAge: this.isProduction() ? 86400 : 3600, // 24h in prod, 1h in dev
      strictMode: this.isProduction()
    };
  }

  /**
   * Get hardened session configuration
   */
  getSessionConfig(): {
    secret: string;
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
    path: string;
    rolling: boolean;
    resave: boolean;
    saveUninitialized: boolean;
  } {
    const sessionSecret = this.config.get<string>('security.sessionSecret');
    
    // Validate session secret strength in production
    if (this.isProduction() && (!sessionSecret || sessionSecret === 'dev-secret' || sessionSecret.length < 32)) {
      throw new Error('SECURITY CRITICAL: Session secret is weak or default in production environment');
    }

    return {
      secret: sessionSecret,
      maxAge: this.overrides.maxSessionAge || SESSION.MAX_AGE,
      secure: this.overrides.enforceHttps !== false && this.isProduction(), // Always secure in production
      httpOnly: true, // Prevent XSS attacks
      sameSite: 'strict', // Strict CSRF protection
      domain: this.getSessionDomain(),
      path: '/',
      rolling: true, // Extend session on activity
      resave: false, // Don't save unchanged sessions
      saveUninitialized: false // Don't create sessions for unauthenticated users
    };
  }

  /**
   * Get Content Security Policy configuration
   */
  getCSPConfig(): {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    frameSrc: string[];
    workerSrc: string[];
    manifestSrc: string[];
    baseUri: string[];
    formAction: string[];
  } {
    const isDevelopment = this.environment === ENVIRONMENT.DEVELOPMENT;
    const corsConfig = this.getCorsConfig();

    return {
      defaultSrc: ["'self'"],
      scriptSrc: isDevelopment 
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Dev mode for Vite
        : ["'self'", "'strict-dynamic'"], // Production: strict CSP
      styleSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'"] // Dev mode for hot reload
        : ["'self'"], // Production: no inline styles
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: isDevelopment
        ? ["'self'", "ws:", "wss:", ...corsConfig.allowedOrigins] // WebSocket for dev
        : ["'self'", ...corsConfig.allowedOrigins],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"], // Prevent plugin execution
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"], // Prevent framing attacks
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    };
  }

  /**
   * Get security headers configuration
   */
  getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      // HSTS - Force HTTPS
      'Strict-Transport-Security': `max-age=${SECURITY.HSTS_MAX_AGE}; includeSubDomains; preload`,
      
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // XSS Protection (legacy browsers)
      'X-XSS-Protection': '1; mode=block',
      
      // Referrer Policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Feature Policy / Permissions Policy
      'Permissions-Policy': [
        'geolocation=()', 
        'microphone=()', 
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'speaker=()',
        'ambient-light-sensor=()',
        'accelerometer=()',
        'battery=()'
      ].join(', '),
      
      // Remove server fingerprinting
      'Server': 'TelemetryDB',
      
      // Cache control for sensitive data
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Production-only headers
    if (this.isProduction()) {
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Resource-Policy'] = 'same-origin';
    }

    return headers;
  }

  /**
   * Get rate limiting configuration based on environment
   */
  getRateLimitConfig(): {
    windowMs: number;
    maxRequests: number;
    apiMaxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    standardHeaders: boolean;
    legacyHeaders: boolean;
    trustProxy: boolean;
  } {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: this.isProduction() ? 50 : 100, // More restrictive in production
      apiMaxRequests: this.isProduction() ? 25 : 50,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      standardHeaders: true,
      legacyHeaders: false,
      trustProxy: this.isProduction() // Trust proxy headers in production
    };
  }

  /**
   * Validate current security configuration
   */
  validateSecurityConfig(): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Environment checks
    if (this.isProduction()) {
      // Critical production checks
      const sessionSecret = this.config.get<string>('security.sessionSecret');
      if (!sessionSecret || sessionSecret === 'dev-secret' || sessionSecret.length < 32) {
        errors.push('Session secret is weak or default in production');
      }

      // CORS validation
      const corsConfig = this.getCorsConfig();
      if (corsConfig.allowedOrigins.length === 0) {
        warnings.push('No CORS origins configured - may cause frontend connection issues');
      }

      const httpOrigins = corsConfig.allowedOrigins.filter(origin => origin.startsWith('http://'));
      if (httpOrigins.length > 0) {
        errors.push(`Non-HTTPS origins detected in production: ${httpOrigins.join(', ')}`);
      }

      // Database URL validation
      const dbUrl = process.env.DATABASE_URL || '';
      if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
        warnings.push('Database URL format should start with postgresql:// or postgres://');
      }

      // SSL validation
      if (!process.env.DATABASE_URL?.includes('sslmode=require')) {
        warnings.push('Database connection should enforce SSL in production');
      }

      // Environment variable checks
      const requiredEnvVars = [
        'DATABASE_URL',
        'SESSION_SECRET',
        'WEAVIATE_URL',
        'WEAVIATE_API_KEY'
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          errors.push(`Required environment variable missing: ${envVar}`);
        }
      }

      // BCrypt rounds check
      const bcryptRounds = this.config.get<number>('security.bcryptRounds');
      if (bcryptRounds < 12) {
        warnings.push(`BCrypt rounds (${bcryptRounds}) should be at least 12 for production`);
      }

    } else {
      // Development recommendations
      recommendations.push('Consider testing with production-like security settings');
      recommendations.push('Ensure all environment variables are documented');
    }

    // General security recommendations
    if (!process.env.REDIS_URL) {
      recommendations.push('Consider configuring Redis for session storage and caching');
    }

    if (!process.env.CORS_ALLOWED_ORIGINS) {
      recommendations.push('Set explicit CORS_ALLOWED_ORIGINS environment variable');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Get trusted proxy configuration
   */
  getTrustedProxies(): string[] | boolean {
    if (!this.isProduction()) {
      return false; // Don't trust proxies in development
    }

    // Default trusted proxies for common cloud providers
    const defaultProxies = [
      'loopback', // 127.0.0.1/8, ::1/128
      'linklocal', // 169.254.0.0/16, fe80::/10
      'uniquelocal', // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7
    ];

    // Override with custom trusted proxies if provided
    if (this.overrides.trustedProxies) {
      return this.overrides.trustedProxies;
    }

    // Check for environment variable
    if (process.env.TRUSTED_PROXIES) {
      return process.env.TRUSTED_PROXIES.split(',').map(ip => ip.trim());
    }

    return defaultProxies;
  }

  /**
   * Get IP whitelist for admin endpoints
   */
  getIPWhitelist(): string[] {
    if (this.overrides.ipWhitelist) {
      return this.overrides.ipWhitelist;
    }

    if (process.env.ADMIN_IP_WHITELIST) {
      return process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim());
    }

    // Development default - allow localhost
    if (!this.isProduction()) {
      return ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    }

    return []; // No whitelist by default in production
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): {
    environment: string;
    timestamp: string;
    validation: SecurityValidationResult;
    configuration: {
      cors: any;
      session: any;
      csp: any;
      headers: any;
      rateLimit: any;
      trustedProxies: any;
      ipWhitelist: any;
    };
  } {
    return {
      environment: this.environment,
      timestamp: new Date().toISOString(),
      validation: this.validateSecurityConfig(),
      configuration: {
        cors: this.getCorsConfig(),
        session: {
          ...this.getSessionConfig(),
          secret: '[REDACTED]' // Don't expose secret in report
        },
        csp: this.getCSPConfig(),
        headers: this.getSecurityHeaders(),
        rateLimit: this.getRateLimitConfig(),
        trustedProxies: this.getTrustedProxies(),
        ipWhitelist: this.getIPWhitelist().length > 0 ? `[${this.getIPWhitelist().length} IPs configured]` : 'None'
      }
    };
  }

  // ==================== Private Helper Methods ====================

  private isProduction(): boolean {
    return this.environment === ENVIRONMENT.PRODUCTION;
  }

  private getSessionDomain(): string | undefined {
    if (!this.isProduction()) {
      return undefined; // No domain restriction in development
    }

    // Extract domain from allowed origins for session domain restriction
    const corsConfig = this.getCorsConfig();
    if (corsConfig.allowedOrigins.length > 0) {
      try {
        const url = new URL(corsConfig.allowedOrigins[0]);
        return url.hostname;
      } catch (error) {
        console.warn('⚠️  Could not extract domain from CORS origins:', error);
      }
    }

    return undefined;
  }

  /**
   * Log security configuration summary
   */
  logSecuritySummary(): void {
    const report = this.generateSecurityReport();
    const { validation } = report;

    console.log(`🔒 Security Configuration Summary (${this.environment.toUpperCase()})`);
    console.log(`   Timestamp: ${report.timestamp}`);
    console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`);
    
    if (validation.errors.length > 0) {
      console.log('   🚨 ERRORS:');
      validation.errors.forEach(error => console.log(`     - ${error}`));
    }

    if (validation.warnings.length > 0) {
      console.log('   ⚠️  WARNINGS:');
      validation.warnings.forEach(warning => console.log(`     - ${warning}`));
    }

    if (validation.recommendations.length > 0) {
      console.log('   💡 RECOMMENDATIONS:');
      validation.recommendations.forEach(rec => console.log(`     - ${rec}`));
    }

    console.log('   📊 Configuration:');
    console.log(`     - CORS Origins: ${report.configuration.cors.allowedOrigins.length}`);
    console.log(`     - Session Max Age: ${report.configuration.session.maxAge / 1000}s`);
    console.log(`     - Rate Limit: ${report.configuration.rateLimit.maxRequests} req/window`);
    console.log(`     - Trusted Proxies: ${typeof report.configuration.trustedProxies === 'boolean' ? report.configuration.trustedProxies : report.configuration.trustedProxies.length}`);
  }
}

export const productionSecurityConfig = ProductionSecurityConfig.getInstance();