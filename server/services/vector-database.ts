import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { postQuantumEncryption, EncryptedData } from './encryption.js';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    timestamp: number;
    userId?: number;
    sessionId?: number;
    biometricContext?: any;
    contentType: 'prompt' | 'response' | 'biometric' | 'correlation';
  };
  vector?: number[];
  encrypted?: boolean;
}

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
  private client!: WeaviateClient;
  private shards: Map<string, ShardInfo> = new Map();
  private compressionThreshold = 10000; // Documents per shard before compression
  private currentShard = 'shard_' + Date.now();

  constructor() {
    this.initializeClient();
    this.initializeSchema();
    this.initializeShard(this.currentShard);
  }

  private initializeClient() {
    // Initialize embedded Weaviate client
    this.client = weaviate.client({
      scheme: 'http',
      host: 'localhost:8080', // Embedded instance
      apiKey: new ApiKey(process.env.WEAVIATE_API_KEY || 'embedded-key'),
    });
  }

  private async initializeSchema() {
    try {
      // Create BiometricData class
      const biometricClass = {
        class: 'BiometricData',
        description: 'Encrypted biometric data with semantic search capabilities',
        vectorizer: 'text2vec-openai',
        moduleConfig: {
          'text2vec-openai': {
            model: 'ada',
            modelVersion: '002',
            type: 'text'
          }
        },
        properties: [
          {
            name: 'content',
            dataType: ['text'],
            description: 'Serialized biometric data content'
          },
          {
            name: 'metadata',
            dataType: ['object'],
            description: 'Document metadata including timestamps and context'
          },
          {
            name: 'encrypted',
            dataType: ['boolean'],
            description: 'Whether the content is encrypted'
          },
          {
            name: 'contentType',
            dataType: ['string'],
            description: 'Type of content: prompt, response, biometric, correlation'
          },
          {
            name: 'userId',
            dataType: ['int'],
            description: 'Associated user ID'
          },
          {
            name: 'sessionId',
            dataType: ['int'],
            description: 'Associated session ID'
          },
          {
            name: 'timestamp',
            dataType: ['date'],
            description: 'Document creation timestamp'
          }
        ]
      };

      await this.client.schema.classCreator().withClass(biometricClass).do();

      // Create PromptData class
      const promptClass = {
        class: 'PromptData',
        description: 'AI prompts and responses with biometric context',
        vectorizer: 'text2vec-openai',
        moduleConfig: {
          'text2vec-openai': {
            model: 'ada',
            modelVersion: '002',
            type: 'text'
          }
        },
        properties: [
          {
            name: 'content',
            dataType: ['text'],
            description: 'Prompt or response content'
          },
          {
            name: 'metadata',
            dataType: ['object'],
            description: 'Context metadata'
          },
          {
            name: 'biometricContext',
            dataType: ['object'],
            description: 'Associated biometric measurements'
          },
          {
            name: 'contentType',
            dataType: ['string'],
            description: 'prompt or response'
          },
          {
            name: 'cognitiveComplexity',
            dataType: ['number'],
            description: 'Calculated cognitive complexity score'
          }
        ]
      };

      await this.client.schema.classCreator().withClass(promptClass).do();

    } catch (error) {
      console.log('Schema already exists or creation failed:', error.message);
    }
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
      // Encrypt sensitive content
      let processedContent = document.content;
      let isEncrypted = false;

      if (document.metadata.contentType === 'biometric' || 
          document.metadata.contentType === 'correlation') {
        const encrypted = await postQuantumEncryption.encrypt(document.content);
        processedContent = JSON.stringify(encrypted);
        isEncrypted = true;
      }

      // Determine target class
      const className = document.metadata.contentType === 'prompt' || 
                       document.metadata.contentType === 'response' 
                       ? 'PromptData' : 'BiometricData';

      // Create vector document
      const vectorDoc = {
        id: document.id || uuidv4(),
        class: className,
        properties: {
          content: processedContent,
          metadata: document.metadata,
          encrypted: isEncrypted,
          contentType: document.metadata.contentType,
          userId: document.metadata.userId,
          sessionId: document.metadata.sessionId,
          timestamp: new Date(document.metadata.timestamp).toISOString(),
          ...(document.metadata.contentType === 'prompt' || document.metadata.contentType === 'response' 
            ? {
                biometricContext: document.metadata.biometricContext,
                cognitiveComplexity: document.metadata.cognitiveComplexity || 0
              } 
            : {})
        },
        vector: document.vector
      };

      // Store in current shard
      await this.client.data.creator()
        .withClassName(className)
        .withId(vectorDoc.id)
        .withProperties(vectorDoc.properties)
        .withVector(vectorDoc.vector)
        .do();

      // Update shard info
      const shard = this.shards.get(this.currentShard);
      if (shard) {
        shard.totalDocuments++;
        shard.lastUpdated = Date.now();

        // Check if shard needs rotation
        if (shard.totalDocuments >= this.compressionThreshold) {
          await this.rotateShard();
        }
      }

      return vectorDoc.id;

    } catch (error) {
      console.error('Error storing document:', error);
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
      const { limit = 10, filter, contentTypes, userId, includeBiometric = true } = options;

      // Build where filter
      let whereFilter: any = {};
      
      if (contentTypes && contentTypes.length > 0) {
        whereFilter = {
          path: ['contentType'],
          operator: 'Equal',
          valueString: contentTypes[0] // Simplified for single type
        };
      }

      if (userId) {
        whereFilter = {
          operator: 'And',
          operands: [
            whereFilter,
            {
              path: ['userId'],
              operator: 'Equal',
              valueInt: userId
            }
          ]
        };
      }

      // Search both classes if needed
      const classes = ['PromptData'];
      if (includeBiometric) {
        classes.push('BiometricData');
      }

      const results: SearchResult[] = [];

      for (const className of classes) {
        try {
          const response = await this.client.graphql.get()
            .withClassName(className)
            .withFields('content metadata encrypted contentType userId sessionId timestamp _additional { id score vector }')
            .withNearText({ concepts: [query] })
            .withLimit(limit)
            .withWhere(whereFilter)
            .do();

          if (response.data?.Get?.[className]) {
            for (const item of response.data.Get[className]) {
              let content = item.content;

              // Decrypt if necessary
              if (item.encrypted) {
                try {
                  const encryptedData = JSON.parse(item.content);
                  content = await postQuantumEncryption.decrypt(encryptedData);
                } catch (error) {
                  console.error('Decryption failed:', error);
                  continue; // Skip corrupted items
                }
              }

              results.push({
                id: item._additional.id,
                content,
                metadata: item.metadata,
                score: item._additional.score || 0,
                vector: item._additional.vector
              });
            }
          }
        } catch (error) {
          console.error(`Search error for class ${className}:`, error);
        }
      }

      // Sort by relevance score
      return results.sort((a, b) => b.score - a.score).slice(0, limit);

    } catch (error) {
      console.error('Semantic search error:', error);
      throw error;
    }
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
  private async exportShardData(shardId: string): Promise<any[]> {
    // This is a simplified implementation
    // In practice, you'd query by shard-specific metadata
    return [];
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