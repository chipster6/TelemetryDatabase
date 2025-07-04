import type { WeaviateClient } from 'weaviate-client';
import { weaviateClient } from '../weaviate-client';

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
}

export interface IConnectionPool<T> {
  acquire(): Promise<T>;
  release(connection: T): Promise<void>;
  drain(): Promise<void>;
  size(): number;
  getStats(): PoolStats;
}

export interface PoolStats {
  totalConnections: number;
  availableConnections: number;
  inUseConnections: number;
  pendingRequests: number;
}

interface PooledConnection {
  connection: WeaviateClient;
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
}

export class ConnectionPoolManager implements IConnectionPool<WeaviateClient> {
  private pool: PooledConnection[] = [];
  private waitingQueue: Array<{
    resolve: (connection: WeaviateClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private config: ConnectionPoolConfig) {
    this.initializePool();
    this.startCleanupTimer();
  }

  private async initializePool(): Promise<void> {
    // Create minimum number of connections
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        const connection = await this.createConnection();
        this.pool.push({
          connection,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          inUse: false
        });
      } catch (error) {
        console.error('Failed to create initial pool connection:', error);
      }
    }
  }

  private async createConnection(): Promise<WeaviateClient> {
    await weaviateClient.initialize();
    return weaviateClient.getClient();
  }

  async acquire(): Promise<WeaviateClient> {
    // Find available connection
    const available = this.pool.find(pooled => !pooled.inUse);
    
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available.connection;
    }

    // Create new connection if under max limit
    if (this.pool.length < this.config.maxConnections) {
      try {
        const connection = await this.createConnection();
        const pooled: PooledConnection = {
          connection,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          inUse: true
        };
        this.pool.push(pooled);
        return connection;
      } catch (error) {
        throw new Error(`Failed to create new connection: ${error}`);
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMillis);

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }

  async release(connection: WeaviateClient): Promise<void> {
    const pooled = this.pool.find(p => p.connection === connection);
    
    if (!pooled) {
      console.warn('Attempted to release connection not in pool');
      return;
    }

    pooled.inUse = false;
    pooled.lastUsed = Date.now();

    // Serve waiting request if any
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      pooled.inUse = true;
      waiter.resolve(connection);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.reapIntervalMillis);
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const minToKeep = this.config.minConnections;
    
    // Find idle connections that can be cleaned up
    const idleConnections = this.pool.filter(pooled => 
      !pooled.inUse && 
      (now - pooled.lastUsed) > this.config.idleTimeoutMillis
    );

    // Remove excess idle connections
    const toRemove = Math.max(0, this.pool.length - minToKeep);
    const connectionsToRemove = idleConnections.slice(0, toRemove);

    connectionsToRemove.forEach(pooled => {
      const index = this.pool.indexOf(pooled);
      if (index !== -1) {
        this.pool.splice(index, 1);
        // Note: WeaviateClient doesn't have a close method in the new API
        // The connection will be cleaned up by garbage collection
      }
    });
  }

  async drain(): Promise<void> {
    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(waiter => {
      waiter.reject(new Error('Connection pool is draining'));
    });
    this.waitingQueue.length = 0;

    // Clear all connections
    this.pool.length = 0;
  }

  size(): number {
    return this.pool.length;
  }

  getStats(): PoolStats {
    return {
      totalConnections: this.pool.length,
      availableConnections: this.pool.filter(p => !p.inUse).length,
      inUseConnections: this.pool.filter(p => p.inUse).length,
      pendingRequests: this.waitingQueue.length
    };
  }
}