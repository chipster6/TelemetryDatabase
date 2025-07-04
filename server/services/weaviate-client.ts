import weaviate, { WeaviateClient } from 'weaviate-client';
import { ConfigurationManager } from '../config/ConfigurationManager';

export class WeaviateClientService {
  private static instance: WeaviateClientService;
  private client: WeaviateClient | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): WeaviateClientService {
    if (!WeaviateClientService.instance) {
      WeaviateClientService.instance = new WeaviateClientService();
    }
    return WeaviateClientService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const config = ConfigurationManager.getInstance();
    const weaviateURL = config.get<string>('weaviate.url');
    const weaviateApiKey = config.get<string>('weaviate.apiKey');

    if (!weaviateURL || !weaviateApiKey) {
      console.warn('Weaviate credentials not configured. Client initialization skipped.');
      return;
    }

    try {
      // Connect to Weaviate Cloud using the new client
      this.client = await weaviate.connectToWeaviateCloud(weaviateURL, {
        authCredentials: new weaviate.ApiKey(weaviateApiKey),
      });

      // Verify connection
      const isReady = await this.client.isReady();
      console.log("Weaviate client ready:", isReady);

      if (!isReady) {
        throw new Error('Weaviate client failed readiness check');
      }

      this.isInitialized = true;
      console.log('Weaviate client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Weaviate client:', error);
      throw error;
    }
  }

  getClient(): WeaviateClient {
    if (!this.client) {
      throw new Error('Weaviate client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const weaviateClient = WeaviateClientService.getInstance();