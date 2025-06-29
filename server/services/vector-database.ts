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
  private documents: Map<string, VectorDocument> = new Map();
  private shards: Map<string, ShardInfo> = new Map();
  private compressionThreshold = 10000; // Documents per shard before compression
  private currentShard = 'shard_' + Date.now();
  private searchIndex: Map<string, Set<string>> = new Map(); // Simple inverted index

  constructor() {
    this.initializeShard(this.currentShard);
  }

  /**
   * Build search index for semantic search
   */
  private buildSearchIndex(document: VectorDocument): void {
    const content = document.content.toLowerCase();
    const words = content.split(/\W+/).filter(word => word.length > 2);
    
    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
      }
      this.searchIndex.get(word)!.add(document.id);
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
      // Encrypt sensitive content
      let processedContent = document.content;
      let isEncrypted = false;

      if (document.metadata.contentType === 'biometric' || 
          document.metadata.contentType === 'correlation') {
        const encrypted = await postQuantumEncryption.encrypt(document.content);
        processedContent = JSON.stringify(encrypted);
        isEncrypted = true;
      }

      // Create enhanced document with encryption and metadata
      const enhancedDocument: VectorDocument = {
        ...document,
        id: document.id || uuidv4(),
        content: processedContent,
        encrypted: isEncrypted
      };

      // Store in memory with sharding
      this.documents.set(enhancedDocument.id, enhancedDocument);
      
      // Build search index
      this.buildSearchIndex(enhancedDocument);

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

      return enhancedDocument.id;

    } catch (error) {
      console.error('Error storing document:', error instanceof Error ? error.message : 'Unknown error');
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
        const matchingIds = this.searchIndex.get(term);
        if (matchingIds) {
          Array.from(matchingIds).forEach(id => candidateIds.add(id));
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
    
    for (const [id, document] of this.documents) {
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