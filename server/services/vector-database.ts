import { postQuantumEncryption, EncryptedData } from './encryption.js';
import { VectorDocument } from '../../shared/schema.js';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { weaviateConnectionManager } from './WeaviateConnectionManager';
import type { WeaviateClient } from 'weaviate-client';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);



export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  score: number;
  vector?: number[];
}

export interface ShardInfo {
  id: string;
  nodeCount: number;
  status: 'active' | 'compressing' | 'archived';
  totalDocuments: number;
  lastUpdated: number;
}

export class WeaviateVectorDatabase {
  private className: string;
  private isInitialized = false;
  private documents = new Map<string, VectorDocument>();
  private searchIndex = new Map<string, VectorDocument[]>();
  private shards = new Map<string, ShardInfo>();
  private currentShard = 'shard_' + Date.now();

  constructor() {
    const config = ConfigurationManager.getInstance();
    this.className = config.get<string>('weaviate.className');
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      // Connection manager should already be initialized from server startup
      if (!weaviateConnectionManager) {
        throw new Error('Weaviate Connection Manager not available');
      }

      // Test connection using the connection manager
      await weaviateConnectionManager.executeWithConnection(
        async (client) => {
          const isReady = await client.isReady();
          if (!isReady) {
            throw new Error('Weaviate client not ready');
          }
          // Connection managed by connection manager - no client storage needed
          return true;
        },
        'initialize-vector-database'
      );

      await this.initializeSchema();
      this.isInitialized = true;
      console.log('✅ Weaviate vector database initialized with connection pooling');
    } catch (error) {
      console.error('Failed to initialize Weaviate vector database:', error);
      console.log('⚠️  Falling back to in-memory vector storage');
      this.initializeFallbackMode();
    }
  }


  private initializeFallbackMode() {
    this.initializeShard(this.currentShard);
    this.isInitialized = true;
    console.log('Vector database initialized in fallback mode');
  }

  private async initializeSchema() {
    return await weaviateConnectionManager.executeWithConnection(
      async (client) => {
        const collections = await client.collections.listAll();
        const schemaExists = collections[this.className];

        if (!schemaExists) {
          const classObj = {
            class: this.className,
            description: 'Prompt engineering documents with biometric context',
            vectorizer: 'none',
            properties: [
              {
                name: 'content',
                dataType: ['text'],
                description: 'The content of the document'
              },
              {
                name: 'contentType',
                dataType: ['text'],
                description: 'Type of content (prompt, response, biometric, etc.)'
              },
              {
                name: 'userId',
                dataType: ['int'],
                description: 'User ID associated with the document'
              },
              {
                name: 'sessionId',
                dataType: ['int'],
                description: 'Session ID associated with the document'
              },
              {
                name: 'timestamp',
                dataType: ['number'],
                description: 'Timestamp when document was created'
              },
              {
                name: 'cognitiveComplexity',
                dataType: ['number'],
                description: 'Cognitive complexity score of the content'
              },
              {
                name: 'biometricContext',
                dataType: ['text'],
                description: 'JSON string of biometric context data'
              }
            ]
          };

          await client.collections.create({
            name: classObj.class,
            description: classObj.description,
            properties: classObj.properties,
            vectorizers: classObj.vectorizer ? { default: classObj.vectorizer } : undefined
          });
          console.log(`📊 Created Weaviate schema: ${this.className}`);
        }
        return true;
      },
      'initialize-schema'
    );
  }

  /**
   * Build search index for semantic search
   */
  private buildSearchIndex(document: VectorDocument): void {
    const content = document.content.toLowerCase();
    const words = content.split(/\W+/).filter(word => word.length > 2);
    
    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, []);
      }
      this.searchIndex.get(word)!.push(document);
    });
  }

  private initializeShard(shardId: string) {
    this.shards.set(shardId, {
      id: shardId,
      nodeCount: 1,
      status: 'active',
      totalDocuments: 0,
      lastUpdated: Date.now()
    });
  }

  /**
   * Store encrypted document in vector database
   */
  async storeDocument(document: VectorDocument): Promise<string> {
    try {
      if (!this.isInitialized) {
        console.warn('Weaviate not initialized, skipping document storage');
        return document.id || uuidv4();
      }

      // Encrypt sensitive content
      let processedContent = document.content;
      let isEncrypted = false;

      if (document.metadata.contentType === 'biometric' || 
          document.metadata.contentType === 'correlation') {
        const encrypted = await postQuantumEncryption.encrypt(document.content);
        processedContent = JSON.stringify(encrypted);
        isEncrypted = true;
      }

      const documentId = document.id || uuidv4();

      // Prepare data for Weaviate
      const weaviateData = {
        content: processedContent,
        contentType: document.metadata.contentType,
        userId: document.metadata.userId || null,
        sessionId: document.metadata.sessionId || null,
        timestamp: document.metadata.timestamp || Date.now(),
        cognitiveComplexity: document.metadata.cognitiveComplexity || 0,
        biometricContext: document.metadata.biometricContext ? 
          JSON.stringify(document.metadata.biometricContext) : null
      };

      // Store in Weaviate using connection manager
      await weaviateConnectionManager.executeWithConnection(
        async (client) => {
          await client.data
            .creator()
            .withClassName(this.className)
            .withId(documentId)
            .withProperties(weaviateData)
            .do();
          return true;
        },
        'store-document'
      );

      console.log(`📊 Stored document ${documentId} in Weaviate via connection pool`);
      return documentId;

    } catch (error) {
      console.error('Error storing document in Weaviate:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Semantic search across encrypted documents
   */
  async semanticSearch(query: string, options: {
    limit?: number;
    filter?: any;
    contentTypes?: string[];
    userId?: number;
    includeBiometric?: boolean;
  } = {}): Promise<SearchResult[]> {
    try {
      const { limit = 10, contentTypes, userId } = options;

      // Parse query into search terms
      const searchTerms = query.toLowerCase().split(/\W+/).filter(term => term.length > 2);
      const candidateIds = new Set<string>();

      // Find documents matching search terms
      searchTerms.forEach(term => {
        const matchingDocs = this.searchIndex.get(term);
        if (matchingDocs) {
          matchingDocs.forEach(doc => candidateIds.add(doc.id));
        }
      });

      const results: SearchResult[] = [];

      // Score and filter candidates
      for (const docId of Array.from(candidateIds)) {
        const document = this.documents.get(docId);
        if (!document) continue;

        // Apply filters
        if (contentTypes && !contentTypes.includes(document.metadata.contentType)) continue;
        if (userId && document.metadata.userId !== userId) continue;

        // Calculate relevance score
        const score = this.calculateRelevanceScore(document.content, searchTerms);
        
        // Decrypt content if necessary
        let content = document.content;
        if (document.encrypted) {
          try {
            const encryptedData = JSON.parse(document.content);
            content = await postQuantumEncryption.decrypt(encryptedData);
          } catch (error) {
            console.error('Decryption failed:', error);
            continue;
          }
        }

        results.push({
          id: document.id,
          content,
          metadata: document.metadata,
          score,
          vector: document.vector
        });
      }

      // Sort by relevance score and limit results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Semantic search error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(content: string, searchTerms: string[]): number {
    const contentLower = content.toLowerCase();
    let score = 0;

    searchTerms.forEach(term => {
      const termCount = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += termCount * (1 / content.length) * 1000; // Normalize by content length
    });

    return score;
  }

  /**
   * Compress and archive old shard data
   */
  private async compressShard(shardId: string): Promise<void> {
    const shard = this.shards.get(shardId);
    if (!shard || shard.status !== 'active') return;

    try {
      shard.status = 'compressing';

      // Export all documents from shard
      const documents = await this.exportShardData(shardId);
      
      // Compress the data
      const compressed = await gzip(Buffer.from(JSON.stringify(documents), 'utf8'));
      
      // Store compressed data (could be to file system or cloud)
      const compressedPath = `./data/compressed_shards/${shardId}.gz`;
      await this.storeCompressedShard(compressedPath, compressed);

      // Mark shard as archived
      shard.status = 'archived';
      
      console.log(`Shard ${shardId} compressed: ${documents.length} documents`);

    } catch (error) {
      console.error(`Compression failed for shard ${shardId}:`, error);
      shard.status = 'active'; // Revert on failure
    }
  }

  /**
   * Rotate to new shard when threshold is reached
   */
  private async rotateShard(): Promise<void> {
    const oldShard = this.currentShard;
    this.currentShard = 'shard_' + Date.now();
    
    // Initialize new shard
    this.initializeShard(this.currentShard);
    
    // Start compression of old shard
    setTimeout(() => this.compressShard(oldShard), 1000);
    
    console.log(`Rotated from shard ${oldShard} to ${this.currentShard}`);
  }

  /**
   * Export data from specific shard
   */
  private async exportShardData(shardId: string): Promise<VectorDocument[]> {
    const shardDocs: VectorDocument[] = [];
    
    for (const document of Array.from(this.documents.values())) {
      // For simplicity, include all documents (in production, would filter by shard metadata)
      shardDocs.push(document);
    }
    
    return shardDocs;
  }

  /**
   * Store compressed shard data
   */
  private async storeCompressedShard(path: string, data: Buffer): Promise<void> {
    // Implementation would store to file system or cloud storage
    console.log(`Storing compressed shard at ${path}, size: ${data.length} bytes`);
  }

  /**
   * Daily compression job
   */
  async performDailyCompression(): Promise<void> {
    console.log('Starting daily compression...');
    
    const activeShards = Array.from(this.shards.values())
      .filter(shard => shard.status === 'active' && shard.id !== this.currentShard);

    for (const shard of activeShards) {
      await this.compressShard(shard.id);
    }

    console.log(`Daily compression completed: ${activeShards.length} shards processed`);
  }

  /**
   * Export encrypted data for cloud backup
   */
  async exportForCloudBackup(): Promise<EncryptedData> {
    try {
      // Export all non-archived data
      const exportData = {
        shards: Array.from(this.shards.entries()),
        timestamp: Date.now(),
        version: '1.0'
      };

      // Encrypt for cloud transfer
      return await postQuantumEncryption.encrypt(exportData);

    } catch (error) {
      console.error('Export for cloud backup failed:', error);
      throw error;
    }
  }

  /**
   * Get Weaviate connection status and health information
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    mode: 'weaviate' | 'fallback';
    version?: string;
    documentsCount: number;
    shardsCount: number;
    poolStats?: any;
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        return {
          connected: false,
          mode: 'fallback',
          documentsCount: this.documents.size,
          shardsCount: this.shards.size
        };
      }

      // Get connection pool health status
      const poolHealth = await weaviateConnectionManager.healthCheck();
      
      if (!poolHealth.healthy) {
        return {
          connected: false,
          mode: 'fallback',
          documentsCount: this.documents.size,
          shardsCount: this.shards.size,
          poolStats: poolHealth.poolStats,
          error: poolHealth.details
        };
      }

      // Get Weaviate info using connection manager
      const result = await weaviateConnectionManager.executeWithConnection(
        async (client) => {
          const metaInfo = await client.misc.metaGetter().do();
          
          // Get document count from Weaviate
          const collection = client.collections.get(this.className);
          const aggregate = await collection.aggregate.overAll();
          const documentsCount = aggregate.totalCount || 0;

          return {
            version: metaInfo.version,
            documentsCount
          };
        },
        'get-connection-status'
      );

      return {
        connected: true,
        mode: 'weaviate',
        version: result?.version,
        documentsCount: result?.documentsCount || 0,
        shardsCount: 1, // Weaviate manages sharding automatically
        poolStats: poolHealth.poolStats
      };
    } catch (error) {
      const poolStats = await weaviateConnectionManager.healthCheck();
      return {
        connected: false,
        mode: 'fallback',
        documentsCount: this.documents.size,
        shardsCount: this.shards.size,
        poolStats: poolStats.poolStats,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalShards: number;
    activeShards: number;
    totalDocuments: number;
    currentShardDocuments: number;
  } {
    const shardArray = Array.from(this.shards.values());
    
    return {
      totalShards: shardArray.length,
      activeShards: shardArray.filter(s => s.status === 'active').length,
      totalDocuments: shardArray.reduce((sum, s) => sum + s.totalDocuments, 0),
      currentShardDocuments: this.shards.get(this.currentShard)?.totalDocuments || 0
    };
  }
}

export const vectorDatabase = new WeaviateVectorDatabase();