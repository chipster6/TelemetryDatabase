import winston from 'winston';
import path from 'path';
import { LOG_LEVELS, MONITORING, SERVICES } from '../constants/ApplicationConstants';

/**
 * Structured logging service using Winston
 * Replaces console.log with proper structured logging
 * Supports multiple transports and log levels
 */
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private serviceName: string;

  private constructor(serviceName: string = 'telemetry-database') {
    this.serviceName = serviceName;
    this.logger = this.createLogger();
  }

  /**
   * Get singleton instance of Logger
   */
  static getInstance(serviceName?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(serviceName);
    }
    return Logger.instance;
  }

  /**
   * Create Winston logger with multiple transports
   */
  private createLogger(): winston.Logger {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Custom format for structured logging
    const customFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          service: service || this.serviceName,
          message,
          ...meta
        };
        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}] [${service || this.serviceName}] ${message} ${metaStr}`;
      })
    );

    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
        format: process.env.NODE_ENV === 'production' ? customFormat : consoleFormat
      })
    ];

    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        // All logs
        new winston.transports.File({
          filename: path.join(logDir, 'application.log'),
          level: LOG_LEVELS.INFO,
          format: customFormat,
          maxsize: this.parseSize(MONITORING.LOG_ROTATION_SIZE),
          maxFiles: MONITORING.LOG_RETENTION_DAYS,
          tailable: true
        }),
        // Error logs only
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: LOG_LEVELS.ERROR,
          format: customFormat,
          maxsize: this.parseSize(MONITORING.LOG_ROTATION_SIZE),
          maxFiles: MONITORING.LOG_RETENTION_DAYS,
          tailable: true
        }),
        // Security logs
        new winston.transports.File({
          filename: path.join(logDir, 'security.log'),
          level: LOG_LEVELS.WARN,
          format: customFormat,
          maxsize: this.parseSize(MONITORING.LOG_ROTATION_SIZE),
          maxFiles: MONITORING.LOG_RETENTION_DAYS,
          tailable: true
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || LOG_LEVELS.INFO,
      format: customFormat,
      defaultMeta: { 
        service: this.serviceName,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        pid: process.pid
      },
      transports,
      exitOnError: false
    });
  }

  /**
   * Log info level message
   */
  info(message: string, meta?: object): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning level message
   */
  warn(message: string, meta?: object): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | object, meta?: object): void {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : { error };

    this.logger.error(message, { ...errorMeta, ...meta });
  }

  /**
   * Log debug level message
   */
  debug(message: string, meta?: object): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log verbose level message
   */
  verbose(message: string, meta?: object): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Log HTTP request
   */
  httpRequest(req: any, res: any, duration: number, meta?: object): void {
    const requestLog = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      userId: req.session?.userId,
      correlationId: req.correlationId,
      ...meta
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP Request Error', requestLog);
    } else {
      this.info('HTTP Request', requestLog);
    }
  }

  /**
   * Log database operation
   */
  dbOperation(operation: string, table: string, duration: number, meta?: object): void {
    this.info('Database Operation', {
      operation,
      table,
      duration: `${duration}ms`,
      ...meta
    });
  }

  /**
   * Log security event
   */
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta?: object): void {
    const securityLog = {
      event,
      severity: severity.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...meta
    };

    if (severity === 'critical' || severity === 'high') {
      this.error(`Security Event: ${event}`, securityLog);
    } else {
      this.warn(`Security Event: ${event}`, securityLog);
    }
  }

  /**
   * Log performance metric
   */
  performance(metric: string, value: number, unit: string = 'ms', meta?: object): void {
    this.info('Performance Metric', {
      metric,
      value,
      unit,
      ...meta
    });
  }

  /**
   * Log audit trail
   */
  audit(action: string, userId: number | string, resource: string, meta?: object): void {
    this.info('Audit Log', {
      action,
      userId,
      resource,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log business event
   */
  business(event: string, meta?: object): void {
    this.info('Business Event', {
      event,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log application startup
   */
  startup(message: string, meta?: object): void {
    this.info(`🚀 ${message}`, {
      event: 'application_startup',
      ...meta
    });
  }

  /**
   * Log application shutdown
   */
  shutdown(message: string, meta?: object): void {
    this.info(`🛑 ${message}`, {
      event: 'application_shutdown',
      ...meta
    });
  }

  /**
   * Create child logger with additional context
   */
  child(meta: object): winston.Logger {
    return this.logger.child(meta);
  }

  /**
   * Create service-specific logger
   */
  static createServiceLogger(serviceName: string): Logger {
    return new Logger(serviceName);
  }

  /**
   * Create request-scoped logger with correlation ID
   */
  createRequestLogger(correlationId: string, userId?: number): winston.Logger {
    return this.logger.child({
      correlationId,
      userId,
      requestScope: true
    });
  }

  /**
   * Log structured query performance
   */
  queryPerformance(query: string, duration: number, rowCount?: number, meta?: object): void {
    const perfData = {
      query: query.length > 100 ? query.substring(0, 100) + '...' : query,
      duration: `${duration}ms`,
      rowCount,
      ...meta
    };

    if (duration > 1000) {
      this.warn('Slow Query Detected', perfData);
    } else {
      this.debug('Query Executed', perfData);
    }
  }

  /**
   * Log memory usage
   */
  memoryUsage(): void {
    const usage = process.memoryUsage();
    this.info('Memory Usage', {
      heapUsed: this.formatBytes(usage.heapUsed),
      heapTotal: this.formatBytes(usage.heapTotal),
      external: this.formatBytes(usage.external),
      rss: this.formatBytes(usage.rss)
    });
  }

  /**
   * Create correlation context for distributed tracing
   */
  withCorrelation(correlationId: string): winston.Logger {
    return this.logger.child({ correlationId });
  }

  // ==================== Helper Methods ====================

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };
    
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }
    
    const [, value, unit = 'b'] = match;
    return Math.floor(parseFloat(value) * units[unit]);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

// Export service-specific loggers
export const AuthLogger = Logger.createServiceLogger(SERVICES.AUTHENTICATION);
export const BiometricLogger = Logger.createServiceLogger(SERVICES.BIOMETRIC_SECURITY);
export const StorageLogger = Logger.createServiceLogger(SERVICES.WEAVIATE_STORAGE);
export const UserLogger = Logger.createServiceLogger(SERVICES.USER_MANAGEMENT);
export const TelemetryLogger = Logger.createServiceLogger(SERVICES.TELEMETRY);
export const BackupLogger = Logger.createServiceLogger(SERVICES.BACKUP);
export const MigrationLogger = Logger.createServiceLogger(SERVICES.MIGRATION);
export const LifecycleLogger = Logger.createServiceLogger(SERVICES.LIFECYCLE);

// Export default logger instance
export const logger = Logger.getInstance();

// Export convenience functions for backward compatibility
export const log = (message: string, meta?: object) => logger.info(message, meta);
export const logError = (message: string, error?: Error | object) => logger.error(message, error);
export const logWarn = (message: string, meta?: object) => logger.warn(message, meta);
export const logDebug = (message: string, meta?: object) => logger.debug(message, meta);