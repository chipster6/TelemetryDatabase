import { EventEmitter } from 'events';
import { vectorDatabase } from '../vector-database.js';
import type { WeaviateConversation, WeaviateBiometricPattern, WeaviateMemoryNode } from '../weaviate-primary-storage';

export interface StorageMetrics {
  conversationsStored: number;
  memoryNodesStored: number;
  patternsStored: number;
  retrievalOperations: number;
  failedOperations: number;
  averageStorageTime: number;
  averageRetrievalTime: number;
}

export interface VectorDocument {
  id: string;
  className: string;
  properties: Record<string, any>;
  vector?: number[];
}

/**
 * Primary storage manager for Weaviate operations
 * Handles core storage and retrieval operations for conversations, memories, and patterns
 */
export class StorageManager extends EventEmitter {
  private weaviateClient: any;
  private metrics: StorageMetrics;
  private storageTimes: number[] = [];
  private retrievalTimes: number[] = [];

  constructor() {
    super();
    
    this.weaviateClient = vectorDatabase.getClient();
    
    this.metrics = {
      conversationsStored: 0,
      memoryNodesStored: 0,
      patternsStored: 0,
      retrievalOperations: 0,
      failedOperations: 0,
      averageStorageTime: 0,
      averageRetrievalTime: 0
    };
  }

  /**
   * Store a vector document in Weaviate
   */
  async store(document: VectorDocument): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.weaviateClient) {
        throw new Error('Weaviate client not available');
      }

      const result = await this.weaviateClient.data
        .creator()
        .withClassName(document.className)
        .withProperties(document.properties)
        .withVector(document.vector)
        .do();

      const storageTime = Date.now() - startTime;
      this.updateStorageMetrics(document.className, storageTime);

      this.emit('documentStored', {
        id: result.id,
        className: document.className,
        storageTime,
        timestamp: Date.now()
      });

      return result.id;

    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('storageError', { error, document });
      throw new Error(`Storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve a document by ID
   */
  async retrieve(id: string, className?: string): Promise<VectorDocument | null> {
    const startTime = Date.now();
    
    try {
      this.metrics.retrievalOperations++;

      // If className is provided, use it for more efficient retrieval
      if (className) {
        const result = await this.weaviateClient.data
          .getterById()
          .withClassName(className)
          .withId(id)
          .do();

        if (!result) {
          return null;
        }

        const retrievalTime = Date.now() - startTime;
        this.updateRetrievalMetrics(retrievalTime);

        return {
          id: result.id,
          className,
          properties: result.properties,
          vector: result.vector
        };
      }

      // Search across all classes if no className provided
      const classes = ['NexisConversation', 'NexisMemoryNode', 'NexisBiometricPattern', 'NexisKnowledgeGraph'];
      
      for (const cls of classes) {
        try {
          const result = await this.weaviateClient.data
            .getterById()
            .withClassName(cls)
            .withId(id)
            .do();

          if (result) {
            const retrievalTime = Date.now() - startTime;
            this.updateRetrievalMetrics(retrievalTime);

            return {
              id: result.id,
              className: cls,
              properties: result.properties,
              vector: result.vector
            };
          }
        } catch (classError) {
          // Continue searching in other classes
          continue;
        }
      }

      return null;

    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('retrievalError', { error, id, className });
      throw new Error(`Retrieval failed: ${error.message}`);
    }
  }

  /**
   * Store conversation with full biometric context
   */
  async storeConversation(conversation: WeaviateConversation): Promise<string> {
    try {
      const document: VectorDocument = {
        id: conversation.id,
        className: 'NexisConversation',
        properties: {
          userId: conversation.userId,
          timestamp: conversation.timestamp,
          conversationType: conversation.conversationType,
          userInput: conversation.userInput,
          aiResponse: conversation.aiResponse,
          conversationContext: conversation.conversationContext,
          effectiveness: conversation.effectiveness,
          responseStrategy: conversation.responseStrategy,
          
          // Biometric state
          heartRate: conversation.biometricState.heartRate,
          hrv: conversation.biometricState.hrv,
          stressLevel: conversation.biometricState.stressLevel,
          attentionLevel: conversation.biometricState.attentionLevel,
          cognitiveLoad: conversation.biometricState.cognitiveLoad,
          flowState: conversation.biometricState.flowState,
          biometricTimestamp: new Date(conversation.biometricState.timestamp).toISOString(),
          
          // Environmental context
          timeOfDay: conversation.environmentalContext.timeOfDay,
          location: conversation.environmentalContext.location,
          soundLevel: conversation.environmentalContext.soundLevel,
          lightLevel: conversation.environmentalContext.lightLevel,
          temperature: conversation.environmentalContext.temperature,
          
          // Learning markers
          isBreakthrough: conversation.learningMarkers.isBreakthrough,
          difficultyLevel: conversation.learningMarkers.difficultyLevel,
          userSatisfaction: conversation.learningMarkers.userSatisfaction,
          cognitiveBreakthrough: conversation.learningMarkers.cognitiveBreakthrough
        }
      };

      const id = await this.store(document);
      
      this.emit('conversationStored', {
        conversationId: conversation.id,
        storedId: id,
        userId: conversation.userId,
        timestamp: Date.now()
      });

      return id;

    } catch (error) {
      this.emit('conversationStorageError', { error, conversation });
      throw error;
    }
  }

  /**
   * Store memory node in long-term knowledge base
   */
  async storeMemory(memory: WeaviateMemoryNode): Promise<string> {
    try {
      const document: VectorDocument = {
        id: memory.id,
        className: 'NexisMemoryNode',
        properties: {
          userId: memory.userId,
          content: memory.content,
          memoryType: memory.memoryType,
          importance: memory.importance,
          lastAccessed: memory.lastAccessed,
          accessCount: memory.accessCount,
          emotionalValence: memory.emotionalValence,
          relatedTopics: memory.relatedTopics,
          biometricContextHR: memory.biometricContext?.heartRate || 0,
          biometricContextStress: memory.biometricContext?.stressLevel || 0,
          retrievalStrength: memory.retrievalStrength
        }
      };

      const id = await this.store(document);
      
      this.emit('memoryStored', {
        memoryId: memory.id,
        storedId: id,
        userId: memory.userId,
        memoryType: memory.memoryType,
        timestamp: Date.now()
      });

      return id;

    } catch (error) {
      this.emit('memoryStorageError', { error, memory });
      throw error;
    }
  }

  /**
   * Store learned biometric pattern
   */
  async storeBiometricPattern(pattern: WeaviateBiometricPattern): Promise<string> {
    try {
      const document: VectorDocument = {
        id: pattern.id,
        className: 'NexisBiometricPattern',
        properties: {
          patternName: pattern.patternName,
          heartRateMin: pattern.biometricSignature.heartRateRange?.[0] || 0,
          heartRateMax: pattern.biometricSignature.heartRateRange?.[1] || 200,
          stressMin: pattern.biometricSignature.stressRange?.[0] || 0,
          stressMax: pattern.biometricSignature.stressRange?.[1] || 1,
          attentionMin: pattern.biometricSignature.attentionRange?.[0] || 0,
          attentionMax: pattern.biometricSignature.attentionRange?.[1] || 1,
          cognitiveLoadMin: pattern.biometricSignature.cognitiveLoadRange?.[0] || 0,
          cognitiveLoadMax: pattern.biometricSignature.cognitiveLoadRange?.[1] || 1,
          flowStateMin: pattern.biometricSignature.flowStateRange?.[0] || 0,
          flowStateMax: pattern.biometricSignature.flowStateRange?.[1] || 1,
          optimalStrategies: pattern.optimalStrategies,
          triggerConditions: pattern.triggerConditions,
          successRate: pattern.successRate,
          learnedFrom: pattern.learnedFrom,
          lastUpdated: pattern.lastUpdated
        }
      };

      const id = await this.store(document);
      
      this.emit('patternStored', {
        patternId: pattern.id,
        storedId: id,
        patternName: pattern.patternName,
        successRate: pattern.successRate,
        timestamp: Date.now()
      });

      return id;

    } catch (error) {
      this.emit('patternStorageError', { error, pattern });
      throw error;
    }
  }

  /**
   * Perform semantic search across conversations
   */
  async searchConversations(query: string, userId: number, limit: number = 10): Promise<any[]> {
    try {
      const results = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          userInput
          aiResponse
          effectiveness
          responseStrategy
          heartRate
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          timeOfDay
          conversationContext
          isBreakthrough
          userSatisfaction
        `)
        .withNearText({ concepts: [query] })
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        })
        .withLimit(limit)
        .do();

      return results?.data?.Get?.NexisConversation || [];

    } catch (error) {
      this.emit('searchError', { error, query, userId });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search memories by content and user
   */
  async searchMemories(query: string, userId: number, limit: number = 5): Promise<any[]> {
    try {
      const results = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisMemoryNode')
        .withFields(`
          content
          memoryType
          importance
          emotionalValence
          relatedTopics
          retrievalStrength
        `)
        .withNearText({ concepts: [query] })
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        })
        .withLimit(limit)
        .do();

      return results?.data?.Get?.NexisMemoryNode || [];

    } catch (error) {
      this.emit('searchError', { error, query, userId });
      throw new Error(`Memory search failed: ${error.message}`);
    }
  }

  /**
   * Get storage metrics
   */
  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed storage statistics
   */
  async getStorageStats(): Promise<any> {
    try {
      const stats = await Promise.all([
        this.weaviateClient.graphql.aggregate().withClassName('NexisConversation').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisMemoryNode').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisBiometricPattern').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisKnowledgeGraph').withFields('meta { count }').do()
      ]);

      return {
        conversations: stats[0]?.data?.Aggregate?.NexisConversation?.[0]?.meta?.count || 0,
        memories: stats[1]?.data?.Aggregate?.NexisMemoryNode?.[0]?.meta?.count || 0,
        patterns: stats[2]?.data?.Aggregate?.NexisBiometricPattern?.[0]?.meta?.count || 0,
        knowledge: stats[3]?.data?.Aggregate?.NexisKnowledgeGraph?.[0]?.meta?.count || 0,
        metrics: this.metrics,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      this.emit('statsError', { error });
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  /**
   * Reset storage metrics
   */
  resetMetrics(): void {
    this.metrics = {
      conversationsStored: 0,
      memoryNodesStored: 0,
      patternsStored: 0,
      retrievalOperations: 0,
      failedOperations: 0,
      averageStorageTime: 0,
      averageRetrievalTime: 0
    };

    this.storageTimes = [];
    this.retrievalTimes = [];
    
    this.emit('metricsReset', { timestamp: Date.now() });
  }

  // ==================== Private Methods ====================

  /**
   * Update storage metrics
   */
  private updateStorageMetrics(className: string, storageTime: number): void {
    this.storageTimes.push(storageTime);
    
    // Keep only recent times for performance
    if (this.storageTimes.length > 1000) {
      this.storageTimes.shift();
    }
    
    // Update average storage time
    const totalOperations = this.storageTimes.length;
    this.metrics.averageStorageTime = 
      (this.metrics.averageStorageTime * (totalOperations - 1) + storageTime) / totalOperations;
    
    // Update specific counters
    switch (className) {
      case 'NexisConversation':
        this.metrics.conversationsStored++;
        break;
      case 'NexisMemoryNode':
        this.metrics.memoryNodesStored++;
        break;
      case 'NexisBiometricPattern':
        this.metrics.patternsStored++;
        break;
    }
  }

  /**
   * Update retrieval metrics
   */
  private updateRetrievalMetrics(retrievalTime: number): void {
    this.retrievalTimes.push(retrievalTime);
    
    // Keep only recent times for performance
    if (this.retrievalTimes.length > 1000) {
      this.retrievalTimes.shift();
    }
    
    // Update average retrieval time
    const totalOperations = this.retrievalTimes.length;
    this.metrics.averageRetrievalTime = 
      (this.metrics.averageRetrievalTime * (totalOperations - 1) + retrievalTime) / totalOperations;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.storageTimes = [];
    this.retrievalTimes = [];
  }
}