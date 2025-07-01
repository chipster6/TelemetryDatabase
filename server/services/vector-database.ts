import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { postQuantumEncryption, EncryptedData } from './encryption.js';
import { VectorDocument } from '../../shared/schema.js';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

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
  private client?: WeaviateClient;
  private className = 'PromptDocument';
  private isInitialized = false;
  private documents = new Map<string, VectorDocument>();
  private searchIndex = new Map<string, VectorDocument[]>();
  private shards = new Map<string, ShardInfo>();
  private currentShard = 'shard_' + Date.now();

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    const weaviateUrl = process.env.WEAVIATE_URL;
    const weaviateApiKey = process.env.WEAVIATE_API_KEY;

    if (!weaviateUrl || !weaviateApiKey) {
      console.log('Weaviate credentials not found. Using in-memory fallback mode.');
      this.initializeFallbackMode();
      return;
    }

    try {
      // Parse Weaviate URL - handle both full URLs and bare hostnames
      let scheme: 'http' | 'https' = 'https';
      let host: string;

      if (weaviateUrl.startsWith('http://') || weaviateUrl.startsWith('https://')) {
        const url = new URL(weaviateUrl);
        scheme = url.protocol.replace(':', '') as 'http' | 'https';
        host = url.host;
      } else {
        // Bare hostname (typical for Weaviate Cloud)
        host = weaviateUrl;
        scheme = 'https'; // Default to HTTPS for cloud instances
      }

      console.log(`Connecting to Weaviate at ${scheme}://${host}`);

      this.client = weaviate.client({
        scheme: scheme,
        host: host,
        apiKey: new ApiKey(weaviateApiKey),
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Test connection
      await this.testConnection();
      await this.initializeSchema();
      this.isInitialized = true;
      console.log('Weaviate client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Weaviate client:', error);
      console.log('Falling back to in-memory vector storage');
      this.initializeFallbackMode();
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.client) throw new Error('Weaviate client not initialized');
    
    try {
      const result = await this.client.misc.metaGetter().do();
      console.log('Weaviate connection test successful, version:', result.version);
    } catch (error) {
      console.error('Weaviate connection test failed:', error);
      throw error;
    }
  }

  private initializeFallbackMode() {
    this.initializeShard(this.currentShard);
    this.isInitialized = true;
    console.log('Vector database initialized in fallback mode');
  }

  private async initializeSchema() {
    if (!this.client) return;
    
    const schemaExists = await this.client.schema
      .classGetter()
      .withClassName(this.className)
      .do()
      .catch(() => null);

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

      await this.client!.schema.classCreator().withClass(classObj).do();
      console.log(`Created Weaviate class: ${this.className}`);
    }
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

      // Store in Weaviate
      await this.client!.data
        .creator()
        .withClassName(this.className)
        .withId(documentId)
        .withProperties(weaviateData)
        .do();

      console.log(`Stored document ${documentId} in Weaviate`);
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
    error?: string;
  }> {
    try {
      if (!this.client) {
        return {
          connected: false,
          mode: 'fallback',
          documentsCount: this.documents.size,
          shardsCount: this.shards.size
        };
      }

      const metaInfo = await this.client.misc.metaGetter().do();
      
      // Get document count from Weaviate
      const aggregate = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('meta { count }')
        .do();

      const documentsCount = aggregate?.data?.Aggregate?.[this.className]?.[0]?.meta?.count || 0;

      return {
        connected: true,
        mode: 'weaviate',
        version: metaInfo.version,
        documentsCount,
        shardsCount: 1, // Weaviate manages sharding automatically
      };
    } catch (error) {
      return {
        connected: false,
        mode: this.client ? 'weaviate' : 'fallback',
        documentsCount: this.documents.size,
        shardsCount: this.shards.size,
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