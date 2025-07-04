/**
 * Application-wide constants to eliminate magic numbers and strings
 * Centralized configuration values for maintainability and consistency
 */

// Rate Limiting Configuration
export const RATE_LIMITING = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  API_MAX_REQUESTS: 50,
  CUSTOM_WINDOW_MS: 60 * 1000, // 1 minute
  HIGH_FREQUENCY_THRESHOLD: 50, // requests per minute
} as const;

// Session Configuration
export const SESSION = {
  MAX_AGE: 10 * 60 * 1000, // 10 minutes for biometric data sensitivity
  TIMEOUT_MINUTES: 10,
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes
  CONCURRENT_SESSIONS_DEFAULT: 3,
  CSRF_TOKEN_LENGTH: 32,
} as const;

// Request/Response Configuration
export const REQUEST = {
  MAX_BODY_SIZE: '10mb',
  MAX_LOG_LENGTH: 80,
  ENHANCED_LOG_LENGTH: 200,
  SLOW_REQUEST_THRESHOLD: 1000, // milliseconds
  CORRELATION_ID_LENGTH: 14,
} as const;

// Security Configuration
export const SECURITY = {
  HSTS_MAX_AGE: 31536000, // 1 year
  BCRYPT_SALT_ROUNDS: 12,
  JWT_EXPIRY: '1h',
  PASSWORD_MIN_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
} as const;

// Database Configuration
export const DATABASE = {
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  QUERY_TIMEOUT: 15000, // 15 seconds
  POOL_MIN: 2,
  POOL_MAX: 10,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // milliseconds
} as const;

// Weaviate/Vector Database Configuration
export const VECTOR_DB = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  SEARCH_CONFIDENCE_THRESHOLD: 0.7,
  BATCH_SIZE: 100,
  CONNECTION_TIMEOUT: 30000,
  REQUEST_TIMEOUT: 60000,
} as const;

// Backup and Storage Configuration
export const BACKUP = {
  DEFAULT_RETENTION_DAYS: 30,
  MAX_BACKUP_SIZE: '1gb',
  COMPRESSION_LEVEL: 6,
  BATCH_SIZE: 1000,
  PARALLEL_WORKERS: 4,
  ARCHIVE_THRESHOLD_DAYS: 90,
} as const;

// Biometric Data Configuration
export const BIOMETRIC = {
  PATTERN_EXPIRY_DAYS: 90,
  MAX_PATTERNS_PER_USER: 5,
  SIMILARITY_THRESHOLD: 0.95,
  ENCRYPTION_KEY_ROTATION_DAYS: 30,
  DATA_RETENTION_DAYS: 365,
} as const;

// Monitoring and Performance
export const MONITORING = {
  METRICS_COLLECTION_INTERVAL: 60000, // 1 minute
  LOG_ROTATION_SIZE: '10mb',
  LOG_RETENTION_DAYS: 30,
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  MEMORY_THRESHOLD_MB: 512,
  CPU_THRESHOLD_PERCENT: 80,
} as const;

// Network and Connectivity
export const NETWORK = {
  DEFAULT_PORT: 5000,
  CONNECT_TIMEOUT: 5000,
  SOCKET_TIMEOUT: 30000,
  KEEP_ALIVE_TIMEOUT: 65000,
  HEADERS_TIMEOUT: 66000,
} as const;

// File and Upload Configuration
export const FILE = {
  MAX_UPLOAD_SIZE: '50mb',
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.pdf', '.txt', '.csv'],
  UPLOAD_DIRECTORY: 'uploads',
  TEMP_DIRECTORY: 'temp',
  CLEANUP_AGE_HOURS: 24,
} as const;

// API Response Configuration
export const API = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_SORT_ORDER: 'desc',
  CACHE_TTL: 5 * 60, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
} as const;

// Error Codes and Messages
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTH_ERROR',
  AUTHORIZATION_ERROR: 'AUTHZ_ERROR',
  RESOURCE_NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT',
  DATABASE_ERROR: 'DB_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXT_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// HTTP Status Codes (commonly used)
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Regex Patterns for Validation
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-()]+$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  IPV4: /^(\d{1,3}\.){3}\d{1,3}$/,
  IPV6: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
} as const;

// Environment Configuration
export const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
  STAGING: 'staging',
} as const;

// Log Levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug',
  VERBOSE: 'verbose',
} as const;

// Time Constants (in milliseconds)
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

// Service Names for Logging and Monitoring
export const SERVICES = {
  AUTHENTICATION: 'authentication',
  BIOMETRIC_SECURITY: 'biometric-security',
  WEAVIATE_STORAGE: 'weaviate-storage',
  USER_MANAGEMENT: 'user-management',
  TELEMETRY: 'telemetry',
  BACKUP: 'backup',
  MIGRATION: 'migration',
  LIFECYCLE: 'lifecycle',
} as const;