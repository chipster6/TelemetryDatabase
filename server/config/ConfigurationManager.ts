interface IApplicationConfig {
  database: {
    url: string;
    poolSize: number;
    timeout: number;
  };
  security: {
    sessionSecret: string;
    allowedOrigins: string[];
    bcryptRounds: number;
  };
  weaviate: {
    url: string;
    apiKey: string;
    className: string;
  };
  biometric: {
    sessionTimeout: number;
    maxConcurrentSessions: number;
    dataRetentionDays: number;
  };
  webauthn: {
    rpId: string;
    origin: string;
  };
}

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: IApplicationConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfig(): IApplicationConfig {
    return {
      database: {
        url: process.env.DATABASE_URL || '',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
        timeout: parseInt(process.env.DB_TIMEOUT || '30000', 10)
      },
      security: {
        sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
        allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
      },
      weaviate: {
        url: process.env.WEAVIATE_URL || 'http://localhost:8080',
        apiKey: process.env.WEAVIATE_API_KEY || '',
        className: process.env.WEAVIATE_CLASS_NAME || 'TelemetryData'
      },
      biometric: {
        sessionTimeout: parseInt(process.env.BIOMETRIC_SESSION_TIMEOUT || '3600', 10),
        maxConcurrentSessions: parseInt(process.env.BIOMETRIC_MAX_SESSIONS || '3', 10),
        dataRetentionDays: parseInt(process.env.BIOMETRIC_RETENTION_DAYS || '30', 10)
      },
      webauthn: {
        rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
        origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'
      }
    };
  }

  private validateConfig(): void {
    const required = [
      { path: 'database.url', value: this.config.database.url },
      { path: 'security.sessionSecret', value: this.config.security.sessionSecret },
      { path: 'weaviate.url', value: this.config.weaviate.url }
    ];

    const errors: string[] = [];
    for (const { path, value } of required) {
      if (!value) {
        errors.push(`Missing required configuration: ${path}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  get<T>(path: keyof IApplicationConfig | string): T {
    const keys = typeof path === 'string' ? path.split('.') : [path];
    let value: any = this.config;

    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        throw new Error(`Configuration key not found: ${path}`);
      }
    }

    return value as T;
  }

  getAll(): IApplicationConfig {
    return { ...this.config };
  }
}

export type ApplicationConfig = IApplicationConfig;