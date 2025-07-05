import weaviate, { WeaviateClient } from 'weaviate-client';
import { ConfigurationManager } from '../config/ConfigurationManager';

/**
 * Enhanced Weaviate Connection Manager with Connection Pooling
 * Provides optimized connection management for better performance
 */
export interface WeaviateConnectionConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  connectionRetryDelay: number;
  healthCheckIntervalMs: number;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  failedConnections: number;
  reconnectAttempts: number;
}

export interface ClientWrapper {
  client: WeaviateClient;
  id: string;
  isActive: boolean;
  lastUsed: number;
  createdAt: number;
  useCount: number;
}

export class WeaviateConnectionManager {
  private static instance: WeaviateConnectionManager;
  private pool: ClientWrapper[] = [];
  private config: WeaviateConnectionConfig;
  private isInitialized = false;
  private weaviateURL: string = '';
  private weaviateApiKey: string = '';
  private pendingRequests: Array<{
    resolve: (client: ClientWrapper) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private stats: ConnectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    pendingRequests: 0,
    failedConnections: 0,
    reconnectAttempts: 0
  };
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      minConnections: 2,
      maxConnections: 8,
      acquireTimeoutMs: 10000,
      idleTimeoutMs: 300000, // 5 minutes
      connectionRetryDelay: 2000,
      healthCheckIntervalMs: 30000
    };
  }

  static getInstance(): WeaviateConnectionManager {
    if (!WeaviateConnectionManager.instance) {
      WeaviateConnectionManager.instance = new WeaviateConnectionManager();
    }
    return WeaviateConnectionManager.instance;
  }

  async initialize(customConfig?: Partial<WeaviateConnectionConfig>): Promise<void> {
    if (this.isInitialized) return;

    // Merge custom config with defaults
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    const config = ConfigurationManager.getInstance();
    this.weaviateURL = config.get<string>('weaviate.url') || '';
    this.weaviateApiKey = config.get<string>('weaviate.apiKey') || '';

    if (!this.weaviateURL || !this.weaviateApiKey) {
      console.warn('Weaviate credentials not configured. Connection pool initialization skipped.');
      return;
    }

    try {
      console.log('🚀 Initializing Weaviate Connection Pool...');
      console.log(`   Min connections: ${this.config.minConnections}`);
      console.log(`   Max connections: ${this.config.maxConnections}`);
      console.log(`   Idle timeout: ${this.config.idleTimeoutMs}ms`);

      // Create minimum number of connections
      await this.createMinimumConnections();

      // Start maintenance tasks
      this.startHealthChecking();
      this.startCleanupTask();

      this.isInitialized = true;
      console.log(`✅ Weaviate Connection Pool initialized with ${this.pool.length} connections`);

    } catch (error) {
      console.error('❌ Failed to initialize Weaviate Connection Pool:', error);
      console.log('⚠️  Continuing without Weaviate - operations will be limited');
      throw error;
    }
  }

  private async createMinimumConnections(): Promise<void> {
    const connectionPromises = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      connectionPromises.push(this.createConnection());
    }

    try {
      const connections = await Promise.allSettled(connectionPromises);
      const successful = connections.filter(result => result.status === 'fulfilled').length;
      console.log(`Created ${successful}/${this.config.minConnections} minimum connections`);

      if (successful === 0) {
        throw new Error('Failed to create any connections to Weaviate');
      }
    } catch (error) {
      console.error('Failed to create minimum connections:', error);
      throw error;
    }
  }

  private async createConnection(): Promise<ClientWrapper> {
    try {
      const client = await weaviate.connectToWeaviateCloud(this.weaviateURL, {
        authCredentials: new weaviate.ApiKey(this.weaviateApiKey),
        connectionParams: {
          retries: 3,
          timeout: 10000
        }
      });

      // Verify connection
      const isReady = await client.isReady();
      if (!isReady) {
        throw new Error('Weaviate client failed readiness check');
      }

      const wrapper: ClientWrapper = {
        client,
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isActive: false,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        useCount: 0
      };

      this.pool.push(wrapper);
      this.updateStats();

      console.log(`📊 Created Weaviate connection ${wrapper.id}`);
      return wrapper;

    } catch (error) {
      this.stats.failedConnections++;
      console.error('Failed to create Weaviate connection:', error);
      throw error;
    }
  }

  async acquireConnection(): Promise<ClientWrapper> {
    if (!this.isInitialized) {
      throw new Error('WeaviateConnectionManager not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      // Try to get an idle connection immediately
      const idleConnection = this.pool.find(conn => !conn.isActive);
      if (idleConnection) {
        idleConnection.isActive = true;
        idleConnection.lastUsed = Date.now();
        idleConnection.useCount++;
        this.updateStats();
        resolve(idleConnection);
        return;
      }

      // If we can create more connections, do so
      if (this.pool.length < this.config.maxConnections) {
        this.createConnection()
          .then(connection => {
            connection.isActive = true;
            connection.useCount++;
            this.updateStats();
            resolve(connection);
          })
          .catch(reject);
        return;
      }

      // Queue the request
      const request = {
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.pendingRequests.push(request);
      this.stats.pendingRequests = this.pendingRequests.length;

      // Set timeout for request
      setTimeout(() => {
        const index = this.pendingRequests.indexOf(request);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
          this.stats.pendingRequests = this.pendingRequests.length;
          reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeoutMs}ms`));
        }
      }, this.config.acquireTimeoutMs);
    });
  }

  releaseConnection(wrapper: ClientWrapper): void {
    if (!wrapper.isActive) {
      console.warn(`Attempted to release inactive connection ${wrapper.id}`);
      return;
    }

    wrapper.isActive = false;
    wrapper.lastUsed = Date.now();
    this.updateStats();

    // Process any pending requests
    this.processPendingRequests();
  }

  private processPendingRequests(): void {
    while (this.pendingRequests.length > 0) {
      const idleConnection = this.pool.find(conn => !conn.isActive);
      if (!idleConnection) break;

      const request = this.pendingRequests.shift();
      if (request) {
        idleConnection.isActive = true;
        idleConnection.lastUsed = Date.now();
        idleConnection.useCount++;
        this.updateStats();
        request.resolve(idleConnection);
      }
    }
    this.stats.pendingRequests = this.pendingRequests.length;
  }

  private updateStats(): void {
    this.stats.totalConnections = this.pool.length;
    this.stats.activeConnections = this.pool.filter(conn => conn.isActive).length;
    this.stats.idleConnections = this.pool.filter(conn => !conn.isActive).length;
  }

  /**
   * Execute operation with automatic connection management
   */
  async executeWithConnection<T>(
    operation: (client: WeaviateClient) => Promise<T>,
    operationName?: string
  ): Promise<T> {
    let connection: ClientWrapper | null = null;

    try {
      connection = await this.acquireConnection();
      const result = await operation(connection.client);
      return result;
    } catch (error) {
      console.error(`Weaviate operation '${operationName || 'unknown'}' failed:`, error);
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = this.pool.map(async (wrapper) => {
      if (wrapper.isActive) return; // Skip active connections

      try {
        const isReady = await wrapper.client.isReady();
        if (!isReady) {
          console.warn(`Connection ${wrapper.id} failed health check`);
          await this.removeConnection(wrapper);
        }
      } catch (error) {
        console.error(`Health check failed for connection ${wrapper.id}:`, error);
        await this.removeConnection(wrapper);
      }
    });

    await Promise.allSettled(healthCheckPromises);

    // Ensure minimum connections
    if (this.pool.length < this.config.minConnections) {
      const needed = this.config.minConnections - this.pool.length;
      console.log(`Recreating ${needed} connections to maintain minimum pool size`);
      
      for (let i = 0; i < needed; i++) {
        try {
          await this.createConnection();
        } catch (error) {
          console.error('Failed to recreate connection during health check:', error);
          this.stats.reconnectAttempts++;
        }
      }
    }
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run every minute
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove = this.pool.filter(conn => 
      !conn.isActive && 
      (now - conn.lastUsed) > this.config.idleTimeoutMs &&
      this.pool.length > this.config.minConnections
    );

    connectionsToRemove.forEach(conn => {
      this.removeConnection(conn);
      console.log(`🧹 Cleaned up idle connection ${conn.id} (idle for ${(now - conn.lastUsed) / 1000}s)`);
    });
  }

  private async removeConnection(wrapper: ClientWrapper): Promise<void> {
    try {
      await wrapper.client.close();
    } catch (error) {
      console.error(`Error closing connection ${wrapper.id}:`, error);
    }

    const index = this.pool.indexOf(wrapper);
    if (index !== -1) {
      this.pool.splice(index, 1);
      this.updateStats();
    }
  }

  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }

  getPoolInfo(): {
    connections: Array<{
      id: string;
      isActive: boolean;
      lastUsed: string;
      useCount: number;
      ageMinutes: number;
    }>;
    config: WeaviateConnectionConfig;
  } {
    const now = Date.now();
    return {
      connections: this.pool.map(conn => ({
        id: conn.id,
        isActive: conn.isActive,
        lastUsed: new Date(conn.lastUsed).toISOString(),
        useCount: conn.useCount,
        ageMinutes: Math.round((now - conn.createdAt) / (1000 * 60))
      })),
      config: this.config
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    poolStats: ConnectionPoolStats;
    details: string;
  }> {
    if (!this.isInitialized) {
      return {
        healthy: false,
        poolStats: this.stats,
        details: 'Connection manager not initialized'
      };
    }

    const idleConnections = this.pool.filter(conn => !conn.isActive);
    const healthy = idleConnections.length > 0 && this.stats.failedConnections < this.config.maxConnections;

    return {
      healthy,
      poolStats: this.getStats(),
      details: healthy 
        ? `Pool healthy: ${idleConnections.length} idle connections available`
        : `Pool unhealthy: ${this.stats.failedConnections} failed connections, ${idleConnections.length} idle`
    };
  }

  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down Weaviate Connection Manager...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Reject pending requests
    this.pendingRequests.forEach(request => {
      request.reject(new Error('Connection manager shutting down'));
    });
    this.pendingRequests = [];

    // Close all connections
    const closePromises = this.pool.map(async (wrapper) => {
      try {
        await wrapper.client.close();
        console.log(`Closed connection ${wrapper.id}`);
      } catch (error) {
        console.error(`Error closing connection ${wrapper.id}:`, error);
      }
    });

    await Promise.allSettled(closePromises);

    this.pool = [];
    this.isInitialized = false;
    this.updateStats();

    console.log('✅ Weaviate Connection Manager shutdown complete');
  }
}

// Export singleton instance
export const weaviateConnectionManager = WeaviateConnectionManager.getInstance();