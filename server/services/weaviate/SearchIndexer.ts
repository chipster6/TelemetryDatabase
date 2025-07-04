import type { WeaviateClient } from 'weaviate-client';
import { VectorDocument } from '../../../shared/schema';

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  className?: string;
  where?: any;
  includeVector?: boolean;
  alpha?: number; // For hybrid search
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  score: number;
  vector?: number[];
  className?: string;
}

export interface HybridSearchOptions extends SearchOptions {
  alpha: number; // Balance between semantic and keyword search (0-1)
  query: string;
  properties?: string[];
}

export class SearchIndexer {
  private searchIndex = new Map<string, VectorDocument[]>();
  private termIndex = new Map<string, Set<string>>(); // term -> document IDs
  
  constructor(private client: WeaviateClient) {}

  /**
   * Build search index for a document
   */
  buildSearchIndex(document: VectorDocument): void {
    const docId = document.id;
    
    // Add to main index
    if (!this.searchIndex.has(document.metadata?.category || 'default')) {
      this.searchIndex.set(document.metadata?.category || 'default', []);
    }
    this.searchIndex.get(document.metadata?.category || 'default')!.push(document);
    
    // Build term index for keyword search
    this.buildTermIndex(docId, document.content);
  }

  private buildTermIndex(docId: string, content: string): void {
    // Simple tokenization
    const terms = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2);
    
    terms.forEach(term => {
      if (!this.termIndex.has(term)) {
        this.termIndex.set(term, new Set());
      }
      this.termIndex.get(term)!.add(docId);
    });
  }

  /**
   * Perform semantic search using Weaviate
   */
  async semanticSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const {
        limit = 10,
        threshold = 0.7,
        className = 'Conversation',
        where,
        includeVector = false
      } = options;

      let searchQuery = this.client.graphql
        .get()
        .withClassName(className)
        .withNearText({ concepts: [query] })
        .withLimit(limit);

      // Add where filter if provided
      if (where) {
        searchQuery = searchQuery.withWhere(where);
      }

      // Select fields based on class
      if (className === 'Conversation') {
        searchQuery = searchQuery.withFields([
          'conversationId',
          'userMessage',
          'aiResponse',
          'conversationContext',
          'effectivenessScore',
          'timestamp',
          'userId',
          'heartRate',
          'stressLevel',
          'attentionLevel',
          'cognitiveLoad',
          '_additional { certainty id }'
        ]);
      } else if (className === 'Memory') {
        searchQuery = searchQuery.withFields([
          'memoryId',
          'content',
          'memoryType',
          'importance',
          'confidenceLevel',
          'createdAt',
          '_additional { certainty id }'
        ]);
      } else {
        searchQuery = searchQuery.withFields([
          '_additional { certainty id }'
        ]);
      }

      if (includeVector) {
        searchQuery = searchQuery.withFields(['_additional { vector certainty id }']);
      }

      const result = await searchQuery.do();
      
      if (!result.data?.Get?.[className]) {
        return [];
      }

      return result.data.Get[className]
        .filter((item: any) => item._additional.certainty >= threshold)
        .map((item: any) => ({
          id: item._additional.id,
          content: this.extractContent(item, className),
          metadata: this.extractMetadata(item, className),
          score: item._additional.certainty,
          vector: item._additional.vector,
          className
        }));

    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Perform hybrid search (semantic + keyword)
   */
  async hybridSearch(options: HybridSearchOptions): Promise<SearchResult[]> {
    try {
      const semanticResults = await this.semanticSearch(options.query, options);
      const keywordResults = this.keywordSearch(options.query, options);
      
      // Combine and weight results
      const combinedResults = this.combineSearchResults(
        semanticResults,
        keywordResults,
        options.alpha
      );
      
      return combinedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 10);

    } catch (error) {
      console.error('Hybrid search failed:', error);
      return [];
    }
  }

  /**
   * Perform keyword search using local index
   */
  keywordSearch(query: string, options: SearchOptions = {}): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/);
    const matchedDocs = new Map<string, number>(); // docId -> score
    
    terms.forEach(term => {
      const docIds = this.termIndex.get(term);
      if (docIds) {
        docIds.forEach(docId => {
          matchedDocs.set(docId, (matchedDocs.get(docId) || 0) + 1);
        });
      }
    });
    
    // Convert to results format
    const results: SearchResult[] = [];
    matchedDocs.forEach((score, docId) => {
      // Find document in search index
      for (const [category, docs] of this.searchIndex.entries()) {
        const doc = docs.find(d => d.id === docId);
        if (doc) {
          results.push({
            id: docId,
            content: doc.content,
            metadata: doc.metadata || {},
            score: score / terms.length, // Normalize by query length
          });
          break;
        }
      }
    });
    
    return results;
  }

  /**
   * Search conversations with biometric context
   */
  async searchConversations(query: string, limit: number = 10): Promise<any[]> {
    try {
      const results = await this.semanticSearch(query, {
        limit,
        className: 'Conversation',
        threshold: 0.6
      });
      
      return results.map(result => ({
        conversationId: result.metadata.conversationId || result.id,
        userMessage: result.metadata.userMessage || '',
        aiResponse: result.metadata.aiResponse || '',
        heartRate: result.metadata.heartRate || 0,
        hrv: result.metadata.hrv || 0,
        stressLevel: result.metadata.stressLevel || 0,
        attentionLevel: result.metadata.attentionLevel || 0,
        cognitiveLoad: result.metadata.cognitiveLoad || 0,
        effectivenessScore: result.metadata.effectivenessScore || 0,
        timestamp: result.metadata.timestamp || new Date().toISOString(),
        userId: result.metadata.userId || 0,
        score: result.score
      }));
    } catch (error) {
      console.error('Error searching conversations:', error);
      return [];
    }
  }

  /**
   * Search memories by content and context
   */
  async searchMemories(query: string, userId?: number, memoryType?: string): Promise<any[]> {
    try {
      const where: any = {};
      
      if (userId) {
        where.path = ['userId'];
        where.operator = 'Equal';
        where.valueInt = userId;
      }
      
      if (memoryType) {
        const typeFilter = {
          path: ['memoryType'],
          operator: 'Equal',
          valueText: memoryType
        };
        
        if (where.path) {
          where.operator = 'And';
          where.operands = [
            { path: where.path, operator: where.operator, valueInt: where.valueInt },
            typeFilter
          ];
          delete where.path;
          delete where.valueInt;
        } else {
          Object.assign(where, typeFilter);
        }
      }
      
      const results = await this.semanticSearch(query, {
        className: 'Memory',
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: 20
      });
      
      return results.map(result => result.metadata);
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  private combineSearchResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    alpha: number
  ): SearchResult[] {
    const combined = new Map<string, SearchResult>();
    
    // Add semantic results with weight
    semanticResults.forEach(result => {
      combined.set(result.id, {
        ...result,
        score: result.score * alpha
      });
    });
    
    // Add keyword results with weight
    keywordResults.forEach(result => {
      const existing = combined.get(result.id);
      if (existing) {
        existing.score += result.score * (1 - alpha);
      } else {
        combined.set(result.id, {
          ...result,
          score: result.score * (1 - alpha)
        });
      }
    });
    
    return Array.from(combined.values());
  }

  private extractContent(item: any, className: string): string {
    switch (className) {
      case 'Conversation':
        return `${item.userMessage || ''} ${item.aiResponse || ''}`.trim();
      case 'Memory':
        return item.content || '';
      default:
        return JSON.stringify(item);
    }
  }

  private extractMetadata(item: any, className: string): any {
    const metadata = { ...item };
    delete metadata._additional;
    return metadata;
  }

  /**
   * Clear search indices
   */
  clearIndices(): void {
    this.searchIndex.clear();
    this.termIndex.clear();
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    documentCount: number;
    categoryCount: number;
    termCount: number;
    memoryUsage: number;
  } {
    let documentCount = 0;
    this.searchIndex.forEach(docs => {
      documentCount += docs.length;
    });
    
    return {
      documentCount,
      categoryCount: this.searchIndex.size,
      termCount: this.termIndex.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;
    
    // Document index
    this.searchIndex.forEach(docs => {
      docs.forEach(doc => {
        size += JSON.stringify(doc).length * 2; // UTF-16
      });
    });
    
    // Term index
    this.termIndex.forEach((docIds, term) => {
      size += term.length * 2;
      size += docIds.size * 40; // Approximate Set overhead
    });
    
    return size;
  }
}