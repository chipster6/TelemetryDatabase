import { vectorDatabase } from '../vector-database';
import { weaviateClient } from '../weaviate-client';
import type { WeaviateClient } from 'weaviate-client';

export interface ClientHealth {
  status: 'healthy' | 'error' | 'unknown';
  lastCheck: number;
  version?: string;
  error?: string;
}

export class WeaviateClientManager {
  private client?: WeaviateClient;
  private className = 'PromptDocument';
  private initialized = false;
  private healthStatus: ClientHealth = {
    status: 'unknown',
    lastCheck: 0
  };
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private healthMonitorInterval?: NodeJS.Timeout;

  constructor() {
    this.client = undefined;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize the weaviate client service
      await weaviateClient.initialize();
      
      if (!weaviateClient.isReady()) {
        throw new Error('Weaviate client not available - check WEAVIATE_URL and WEAVIATE_API_KEY');
      }

      // Get the client instance
      this.client = weaviateClient.getClient();
      
      // Test connection
      const isHealthy = await this.checkHealth();
      
      if (!isHealthy) {
        throw new Error('Weaviate health check failed');
      }

      this.initialized = true;
      console.log('✓ WeaviateClientManager initialized successfully');
      
      // Start periodic health checks
      this.startHealthMonitoring();
      
    } catch (error) {
      console.error('Failed to initialize WeaviateClientManager:', error);
      this.healthStatus = {
        status: 'error',
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.client = undefined;
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    
    // Skip if recently checked and healthy
    if (now - this.healthStatus.lastCheck < this.HEALTH_CHECK_INTERVAL && this.healthStatus.status === 'healthy') {
      return true;
    }

    if (!this.client) {
      this.healthStatus = {
        status: 'error',
        lastCheck: now,
        error: 'Client not initialized'
      };
      return false;
    }

    try {
      // Use the new client's isReady method
      const isReady = await this.client.isReady();
      
      if (isReady) {
        this.healthStatus = {
          status: 'healthy',
          lastCheck: now,
          version: 'v4' // New client version
        };
        return true;
      } else {
        throw new Error('Client not ready');
      }
      
    } catch (error) {
      console.error('Weaviate health check failed:', error);
      this.healthStatus = {
        status: 'error',
        lastCheck: now,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
      return false;
    }
  }

  private startHealthMonitoring(): void {
    this.healthMonitorInterval = setInterval(async () => {
      await this.checkHealth();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  getClient(): WeaviateClient {
    if (!this.client || !this.initialized) {
      throw new Error('Weaviate client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getHealthStatus(): ClientHealth {
    return { ...this.healthStatus };
  }

  getClassName(): string {
    return this.className;
  }

  setClassName(className: string): void {
    this.className = className;
  }

  async testConnection(): Promise<{ success: boolean; details: any }> {
    try {
      if (!this.client) {
        return {
          success: false,
          details: { error: 'Client not initialized' }
        };
      }

      const isReady = await this.client.isReady();
      
      return {
        success: isReady,
        details: {
          ready: isReady,
          className: this.className,
          healthStatus: this.healthStatus,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        details: {
          error: error instanceof Error ? error.message : 'Connection test failed',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  destroy(): void {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = undefined;
    }
    
    this.initialized = false;
    this.client = undefined;
    this.healthStatus = {
      status: 'unknown',
      lastCheck: 0
    };
  }
}