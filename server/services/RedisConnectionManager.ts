import { createClient, RedisClientType } from 'redis';

/**
 * Centralized Redis Connection Manager
 * Provides connection pooling and management for all Redis operations
 */
export class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private client: RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private retryDelay = 1000; // 1 second

  private constructor() {}

  static getInstance(): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager();
    }
    return RedisConnectionManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.connect();
    return this.connectionPromise;
  }

  private async connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000, // 10 seconds
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.error(`Redis max retries (${this.maxRetries}) exceeded. Giving up.`);
              return false;
            }
            const delay = Math.min(this.retryDelay * Math.pow(2, retries), 30000);
            console.log(`Redis reconnecting in ${delay}ms (attempt ${retries + 1}/${this.maxRetries})`);
            return delay;
          }
        },
        // Enable connection pooling
        isolationPoolOptions: {
          min: 2,
          max: 10
        }
      });

      this.setupEventHandlers();
      
      await this.client.connect();
      this.isConnected = true;
      this.retryCount = 0;
      
      console.log(`✅ Redis Connection Manager initialized successfully`);
      console.log(`   URL: ${redisUrl}`);
      console.log(`   Connection pooling: 2-10 connections`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Redis Connection Manager:', error);
      console.log('⚠️  Continuing without Redis - falling back to in-memory storage where possible');
      
      this.client = null;
      this.isConnected = false;
      this.connectionPromise = null;
      
      // Don't throw in development - allow graceful degradation
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
      this.isConnected = true;
      this.retryCount = 0;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis client error:', err.message);
      this.isConnected = false;
      
      // Log specific error types for debugging
      if (err.code === 'ECONNREFUSED') {
        console.error('   Redis server refused connection - is Redis running?');
      } else if (err.code === 'ENOTFOUND') {
        console.error('   Redis host not found - check REDIS_URL configuration');
      }
    });

    this.client.on('end', () => {
      console.log('⚪ Redis connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
      this.retryCount++;
    });
  }

  /**
   * Get the shared Redis client instance
   */
  getClient(): RedisClientType | null {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️  Redis client not available - operations will be skipped');
      return null;
    }
    return this.client;
  }

  /**
   * Check if Redis is ready for operations
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get connection status information
   */
  getStatus(): {
    connected: boolean;
    client: boolean;
    retryCount: number;
    maxRetries: number;
  } {
    return {
      connected: this.isConnected,
      client: this.client !== null,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Execute Redis command with error handling and fallback
   */
  async executeCommand<T>(
    operation: (client: RedisClientType) => Promise<T>,
    fallback?: () => T | Promise<T>,
    operationName?: string
  ): Promise<T | null> {
    const client = this.getClient();
    
    if (!client) {
      if (fallback) {
        console.warn(`⚠️  Redis unavailable for ${operationName || 'operation'} - using fallback`);
        return await fallback();
      }
      return null;
    }

    try {
      return await operation(client);
    } catch (error) {
      console.error(`❌ Redis ${operationName || 'operation'} failed:`, error);
      
      if (fallback) {
        console.warn(`⚠️  Using fallback for ${operationName || 'operation'}`);
        return await fallback();
      }
      
      return null;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      console.log('🔌 Shutting down Redis Connection Manager...');
      try {
        await this.client.quit();
        console.log('✅ Redis connection closed gracefully');
      } catch (error) {
        console.error('❌ Error during Redis shutdown:', error);
        // Force disconnect if graceful shutdown fails
        await this.client.disconnect();
      }
      
      this.client = null;
      this.isConnected = false;
      this.connectionPromise = null;
    }
  }

  // Helper methods for common operations with automatic fallback
  async get(key: string): Promise<string | null> {
    return this.executeCommand(
      (client) => client.get(key),
      () => null,
      'GET'
    );
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const result = await this.executeCommand(
      async (client) => {
        if (ttlSeconds) {
          await client.setEx(key, ttlSeconds, value);
        } else {
          await client.set(key, value);
        }
        return true;
      },
      () => false,
      'SET'
    );
    
    return result || false;
  }

  async del(key: string): Promise<boolean> {
    const result = await this.executeCommand(
      async (client) => {
        await client.del(key);
        return true;
      },
      () => false,
      'DEL'
    );
    
    return result || false;
  }

  async incr(key: string): Promise<number | null> {
    return this.executeCommand(
      (client) => client.incr(key),
      () => null,
      'INCR'
    );
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.executeCommand(
      async (client) => {
        await client.expire(key, seconds);
        return true;
      },
      () => false,
      'EXPIRE'
    );
    
    return result || false;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.executeCommand(
      (client) => client.hGet(key, field),
      () => null,
      'HGET'
    );
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    const result = await this.executeCommand(
      async (client) => {
        await client.hSet(key, field, value);
        return true;
      },
      () => false,
      'HSET'
    );
    
    return result || false;
  }

  async lpush(key: string, ...values: string[]): Promise<number | null> {
    return this.executeCommand(
      (client) => client.lPush(key, values),
      () => null,
      'LPUSH'
    );
  }

  async rpop(key: string): Promise<string | null> {
    return this.executeCommand(
      (client) => client.rPop(key),
      () => null,
      'RPOP'
    );
  }
}

// Export singleton instance
export const redisConnectionManager = RedisConnectionManager.getInstance();