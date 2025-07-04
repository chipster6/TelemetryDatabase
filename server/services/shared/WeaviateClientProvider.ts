/**
 * Shared Weaviate Client Provider
 * Consolidates client management across services
 */
import { WeaviateClientManager } from '../weaviate/WeaviateClientManager.js';
import type { WeaviateClient } from 'weaviate-client';

export class WeaviateClientProvider {
  private static instance: WeaviateClientProvider | null = null;
  private clientManager: WeaviateClientManager | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): WeaviateClientProvider {
    if (!WeaviateClientProvider.instance) {
      WeaviateClientProvider.instance = new WeaviateClientProvider();
    }
    return WeaviateClientProvider.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.clientManager = new WeaviateClientManager();
      await this.clientManager.initialize();
      this.isInitialized = true;
      console.log('WeaviateClientProvider initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WeaviateClientProvider:', error);
      throw error;
    }
  }

  getClient(): WeaviateClient | null {
    if (!this.isInitialized || !this.clientManager) {
      console.warn('WeaviateClientProvider not initialized');
      return null;
    }
    return this.clientManager.getClient();
  }

  isReady(): boolean {
    return this.isInitialized && this.clientManager !== null;
  }

  async healthCheck(): Promise<{ connected: boolean; version?: string; error?: string }> {
    if (!this.isReady()) {
      return { connected: false, error: 'Client not initialized' };
    }

    try {
      const client = this.getClient();
      if (!client) {
        return { connected: false, error: 'No client available' };
      }

      const metaInfo = await client.misc.metaGetter().do();
      return { connected: true, version: metaInfo.version };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Singleton instance
export const weaviateClientProvider = WeaviateClientProvider.getInstance();