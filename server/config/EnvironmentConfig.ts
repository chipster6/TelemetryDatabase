import { ENVIRONMENT, DATABASE, VECTOR_DB, BIOMETRIC, MONITORING, NETWORK } from '../constants/ApplicationConstants';

/**
 * Environment-specific configuration manager
 * Provides clear separation between development, testing, staging, and production settings
 */

export interface EnvironmentSpecificConfig {
  // Core settings
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  isStaging: boolean;

  // Database configuration
  database: {
    url: string;
    poolSize: number;
    connectionTimeout: number;
    queryTimeout: number;
    retryAttempts: number;
    enableQueryLogging: boolean;
    enableSlowQueryLogging: boolean;
    slowQueryThreshold: number;
    sslMode: 'require' | 'prefer' | 'allow' | 'disable';
  };

  // Redis configuration
  redis: {
    url: string;
    maxRetries: number;
    retryDelay: number;
    enableCluster: boolean;
    connectionTimeout: number;
    commandTimeout: number;
    enableOfflineQueue: boolean;
  };

  // Weaviate configuration
  weaviate: {
    url: string;
    apiKey: string;
    timeout: number;
    retries: number;
    batchSize: number;
    enableLogging: boolean;
    className: string;
  };

  // Security configuration
  security: {
    sessionSecret: string;
    allowedOrigins: string[];
    bcryptRounds: number;
    enforceHttps: boolean;
    enableCSRF: boolean;
    enableRateLimit: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
    enableSecurityHeaders: boolean;
  };

  // Monitoring and logging
  monitoring: {
    enableMetrics: boolean;
    enableHealthChecks: boolean;
    enableRequestLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    enablePerformanceTracking: boolean;
    enableMemoryMonitoring: boolean;
    enableErrorTracking: boolean;
    healthCheckInterval: number;
  };

  // Application settings
  application: {
    port: number;
    host: string;
    enableCors: boolean;
    enableCompression: boolean;
    requestTimeout: number;
    maxRequestSize: string;
    enableSwagger: boolean;
    enableGraphQL: boolean;
  };

  // Feature flags
  features: {
    enableBiometricData: boolean;
    enableVectorStorage: boolean;
    enableWebAuthn: boolean;
    enableAnalytics: boolean;
    enableBackup: boolean;
    enableCloudExport: boolean;
    enableGDPRCompliance: boolean;
  };
}

export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: EnvironmentSpecificConfig;
  private environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT;
    this.config = this.loadEnvironmentConfig();
    this.validateConfiguration();
  }

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private loadEnvironmentConfig(): EnvironmentSpecificConfig {
    const isDevelopment = this.environment === ENVIRONMENT.DEVELOPMENT;
    const isProduction = this.environment === ENVIRONMENT.PRODUCTION;
    const isTest = this.environment === ENVIRONMENT.TEST;
    const isStaging = this.environment === ENVIRONMENT.STAGING;

    return {
      // Core settings
      nodeEnv: this.environment,
      isDevelopment,
      isProduction,
      isTest,
      isStaging,

      // Database configuration - environment specific
      database: {
        url: process.env.DATABASE_URL || this.getDefaultDatabaseUrl(),
        poolSize: parseInt(process.env.DB_POOL_SIZE || this.getDefaultPoolSize(), 10),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || DATABASE.CONNECTION_TIMEOUT.toString(), 10),
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || DATABASE.QUERY_TIMEOUT.toString(), 10),
        retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || DATABASE.RETRY_ATTEMPTS.toString(), 10),
        enableQueryLogging: this.getBooleanEnv('DB_ENABLE_QUERY_LOGGING', isDevelopment),
        enableSlowQueryLogging: this.getBooleanEnv('DB_ENABLE_SLOW_QUERY_LOGGING', true),
        slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
        sslMode: (process.env.DB_SSL_MODE as any) || (isProduction ? 'require' : 'prefer')
      },

      // Redis configuration - environment specific
      redis: {
        url: process.env.REDIS_URL || this.getDefaultRedisUrl(),
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || (isProduction ? '5' : '3'), 10),
        retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
        enableCluster: this.getBooleanEnv('REDIS_ENABLE_CLUSTER', isProduction),
        connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '10000', 10),
        commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
        enableOfflineQueue: this.getBooleanEnv('REDIS_ENABLE_OFFLINE_QUEUE', !isProduction)
      },

      // Weaviate configuration
      weaviate: {
        url: process.env.WEAVIATE_URL || this.getDefaultWeaviateUrl(),
        apiKey: process.env.WEAVIATE_API_KEY || '',
        timeout: parseInt(process.env.WEAVIATE_TIMEOUT || VECTOR_DB.REQUEST_TIMEOUT.toString(), 10),
        retries: parseInt(process.env.WEAVIATE_RETRIES || '3', 10),
        batchSize: parseInt(process.env.WEAVIATE_BATCH_SIZE || VECTOR_DB.BATCH_SIZE.toString(), 10),
        enableLogging: this.getBooleanEnv('WEAVIATE_ENABLE_LOGGING', isDevelopment),
        className: process.env.WEAVIATE_CLASS_NAME || 'TelemetryData'
      },

      // Security configuration - much stricter in production
      security: {
        sessionSecret: process.env.SESSION_SECRET || this.getDefaultSessionSecret(),
        allowedOrigins: this.parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || (isProduction ? '14' : '10'), 10),
        enforceHttps: this.getBooleanEnv('ENFORCE_HTTPS', isProduction),
        enableCSRF: this.getBooleanEnv('ENABLE_CSRF', isProduction),
        enableRateLimit: this.getBooleanEnv('ENABLE_RATE_LIMIT', true),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || (isProduction ? '3' : '5'), 10),
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || (isProduction ? '3600000' : '900000'), 10), // 1h prod, 15m dev
        enableSecurityHeaders: this.getBooleanEnv('ENABLE_SECURITY_HEADERS', isProduction)
      },

      // Monitoring configuration - more verbose in development
      monitoring: {
        enableMetrics: this.getBooleanEnv('ENABLE_METRICS', true),
        enableHealthChecks: this.getBooleanEnv('ENABLE_HEALTH_CHECKS', true),
        enableRequestLogging: this.getBooleanEnv('ENABLE_REQUEST_LOGGING', true),
        logLevel: (process.env.LOG_LEVEL as any) || this.getDefaultLogLevel(),
        enablePerformanceTracking: this.getBooleanEnv('ENABLE_PERFORMANCE_TRACKING', isProduction),
        enableMemoryMonitoring: this.getBooleanEnv('ENABLE_MEMORY_MONITORING', true),
        enableErrorTracking: this.getBooleanEnv('ENABLE_ERROR_TRACKING', isProduction),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || MONITORING.HEALTH_CHECK_INTERVAL.toString(), 10)
      },

      // Application settings
      application: {
        port: parseInt(process.env.PORT || NETWORK.DEFAULT_PORT.toString(), 10),
        host: process.env.HOST || (isProduction ? '0.0.0.0' : 'localhost'),
        enableCors: this.getBooleanEnv('ENABLE_CORS', true),
        enableCompression: this.getBooleanEnv('ENABLE_COMPRESSION', isProduction),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || NETWORK.SOCKET_TIMEOUT.toString(), 10),
        maxRequestSize: process.env.MAX_REQUEST_SIZE || (isProduction ? '10mb' : '50mb'),
        enableSwagger: this.getBooleanEnv('ENABLE_SWAGGER', !isProduction),
        enableGraphQL: this.getBooleanEnv('ENABLE_GRAPHQL', isDevelopment)
      },

      // Feature flags - can be different per environment
      features: {
        enableBiometricData: this.getBooleanEnv('FEATURE_BIOMETRIC_DATA', true),
        enableVectorStorage: this.getBooleanEnv('FEATURE_VECTOR_STORAGE', true),
        enableWebAuthn: this.getBooleanEnv('FEATURE_WEBAUTHN', true),
        enableAnalytics: this.getBooleanEnv('FEATURE_ANALYTICS', isProduction),
        enableBackup: this.getBooleanEnv('FEATURE_BACKUP', isProduction),
        enableCloudExport: this.getBooleanEnv('FEATURE_CLOUD_EXPORT', isProduction),
        enableGDPRCompliance: this.getBooleanEnv('FEATURE_GDPR_COMPLIANCE', isProduction)
      }
    };
  }

  /**
   * Get configuration value with type safety
   */
  get<K extends keyof EnvironmentSpecificConfig>(key: K): EnvironmentSpecificConfig[K] {
    return this.config[key];
  }

  /**
   * Get nested configuration value
   */
  getPath<T>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        throw new Error(`Configuration path not found: ${path}`);
      }
    }

    return value as T;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof EnvironmentSpecificConfig['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Get full configuration object
   */
  getAll(): EnvironmentSpecificConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration based on environment
   */
  private validateConfiguration(): void {
    const errors: string[] = [];
    const { config } = this;

    // Common validations
    if (!config.database.url) {
      errors.push('DATABASE_URL is required');
    }

    if (!config.security.sessionSecret) {
      errors.push('SESSION_SECRET is required');
    }

    // Production-specific validations
    if (config.isProduction) {
      if (config.security.sessionSecret === 'dev-secret' || config.security.sessionSecret.length < 32) {
        errors.push('SESSION_SECRET must be at least 32 characters in production');
      }

      if (config.security.allowedOrigins.length === 0) {
        errors.push('CORS_ALLOWED_ORIGINS must be configured in production');
      }

      if (config.security.allowedOrigins.some(origin => origin.includes('localhost'))) {
        errors.push('localhost origins not allowed in production');
      }

      if (!config.database.url.includes('sslmode=require') && config.database.sslMode !== 'require') {
        errors.push('Database SSL must be required in production');
      }

      if (config.security.bcryptRounds < 12) {
        errors.push('BCrypt rounds must be at least 12 in production');
      }

      if (!config.weaviate.apiKey) {
        errors.push('WEAVIATE_API_KEY is required in production');
      }
    }

    // Development-specific validations
    if (config.isDevelopment) {
      if (config.security.enforceHttps) {
        console.warn('⚠️  HTTPS enforcement enabled in development mode');
      }
    }

    // Test-specific validations
    if (config.isTest) {
      if (!config.database.url.includes('test')) {
        console.warn('⚠️  Database URL does not appear to be a test database');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Helper methods for default values based on environment
   */
  private getDefaultDatabaseUrl(): string {
    if (this.environment === ENVIRONMENT.TEST) {
      return 'postgresql://localhost:5432/telemetry_test';
    }
    if (this.environment === ENVIRONMENT.DEVELOPMENT) {
      return 'postgresql://localhost:5432/telemetry_dev';
    }
    return ''; // Must be provided for production/staging
  }

  private getDefaultRedisUrl(): string {
    if (this.environment === ENVIRONMENT.TEST) {
      return 'redis://localhost:6379/1';
    }
    return 'redis://localhost:6379/0';
  }

  private getDefaultWeaviateUrl(): string {
    return 'http://localhost:8080';
  }

  private getDefaultSessionSecret(): string {
    if (this.environment === ENVIRONMENT.PRODUCTION) {
      return ''; // Must be provided
    }
    return 'dev-secret-change-in-production';
  }

  private getDefaultPoolSize(): string {
    switch (this.environment) {
      case ENVIRONMENT.PRODUCTION:
        return '20';
      case ENVIRONMENT.STAGING:
        return '10';
      case ENVIRONMENT.TEST:
        return '2';
      default:
        return '5';
    }
  }

  private getDefaultLogLevel(): string {
    switch (this.environment) {
      case ENVIRONMENT.PRODUCTION:
        return 'warn';
      case ENVIRONMENT.STAGING:
        return 'info';
      case ENVIRONMENT.TEST:
        return 'error';
      default:
        return 'debug';
    }
  }

  private parseOrigins(originsStr?: string): string[] {
    if (!originsStr) {
      // Default origins based on environment
      switch (this.environment) {
        case ENVIRONMENT.PRODUCTION:
          return []; // Must be explicitly configured
        case ENVIRONMENT.STAGING:
          return ['https://staging.telemetrydb.com'];
        case ENVIRONMENT.TEST:
          return ['http://localhost:3000'];
        default:
          return ['http://localhost:3000', 'http://localhost:5173'];
      }
    }

    return originsStr.split(',').map(origin => origin.trim()).filter(Boolean);
  }

  private getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Log configuration summary
   */
  logConfigurationSummary(): void {
    console.log(`⚙️  Environment Configuration (${this.environment.toUpperCase()})`);
    console.log(`   Database: ${this.config.database.url ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Redis: ${this.config.redis.url ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Weaviate: ${this.config.weaviate.url ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Security: ${this.config.security.sessionSecret ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Port: ${this.config.application.port}`);
    console.log(`   CORS Origins: ${this.config.security.allowedOrigins.length}`);
    console.log(`   Features Enabled: ${Object.values(this.config.features).filter(Boolean).length}/${Object.keys(this.config.features).length}`);
    
    if (this.config.isDevelopment) {
      console.log('   🔧 Development mode features:');
      console.log(`     - Query Logging: ${this.config.database.enableQueryLogging ? '✅' : '❌'}`);
      console.log(`     - Swagger: ${this.config.application.enableSwagger ? '✅' : '❌'}`);
      console.log(`     - GraphQL: ${this.config.application.enableGraphQL ? '✅' : '❌'}`);
    }

    if (this.config.isProduction) {
      console.log('   🔒 Production mode security:');
      console.log(`     - HTTPS Enforced: ${this.config.security.enforceHttps ? '✅' : '❌'}`);
      console.log(`     - CSRF Protection: ${this.config.security.enableCSRF ? '✅' : '❌'}`);
      console.log(`     - Security Headers: ${this.config.security.enableSecurityHeaders ? '✅' : '❌'}`);
      console.log(`     - BCrypt Rounds: ${this.config.security.bcryptRounds}`);
    }
  }

  /**
   * Generate environment-specific .env template
   */
  generateEnvTemplate(): string {
    const lines = [
      '# Environment Configuration',
      `# Environment: ${this.environment}`,
      '',
      '# Core Settings',
      `NODE_ENV=${this.environment}`,
      `PORT=${this.config.application.port}`,
      `HOST=${this.config.application.host}`,
      '',
      '# Database Configuration',
      `DATABASE_URL=${this.config.database.url || 'postgresql://user:password@localhost:5432/telemetry_db'}`,
      `DB_POOL_SIZE=${this.config.database.poolSize}`,
      `DB_SSL_MODE=${this.config.database.sslMode}`,
      '',
      '# Redis Configuration',
      `REDIS_URL=${this.config.redis.url}`,
      `REDIS_MAX_RETRIES=${this.config.redis.maxRetries}`,
      '',
      '# Weaviate Configuration',
      `WEAVIATE_URL=${this.config.weaviate.url}`,
      `WEAVIATE_API_KEY=${this.config.weaviate.apiKey || 'your-api-key-here'}`,
      '',
      '# Security Settings',
      `SESSION_SECRET=${this.config.security.sessionSecret || 'generate-a-secure-secret-here'}`,
      `CORS_ALLOWED_ORIGINS=${this.config.security.allowedOrigins.join(',')}`,
      `BCRYPT_ROUNDS=${this.config.security.bcryptRounds}`,
      `ENFORCE_HTTPS=${this.config.security.enforceHttps}`,
      `ENABLE_CSRF=${this.config.security.enableCSRF}`,
      '',
      '# Feature Flags',
      `FEATURE_BIOMETRIC_DATA=${this.config.features.enableBiometricData}`,
      `FEATURE_VECTOR_STORAGE=${this.config.features.enableVectorStorage}`,
      `FEATURE_WEBAUTHN=${this.config.features.enableWebAuthn}`,
      `FEATURE_ANALYTICS=${this.config.features.enableAnalytics}`,
      `FEATURE_BACKUP=${this.config.features.enableBackup}`,
      '',
      '# Monitoring Settings',
      `LOG_LEVEL=${this.config.monitoring.logLevel}`,
      `ENABLE_METRICS=${this.config.monitoring.enableMetrics}`,
      `ENABLE_PERFORMANCE_TRACKING=${this.config.monitoring.enablePerformanceTracking}`,
      ''
    ];

    return lines.join('\n');
  }
}

// Export singleton instance
export const environmentConfig = EnvironmentConfig.getInstance();