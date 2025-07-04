import type { WeaviateClient } from 'weaviate-client';
import { ConversationData, Memory, BiometricSnapshot } from '../weaviate.service';

export interface CompressionOptions {
  compressionLevel: 'low' | 'medium' | 'high';
  preserveFields: string[];
  compressionAlgorithm: 'statistical' | 'semantic' | 'hybrid';
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  preservedFields: string[];
  algorithm: string;
}

export interface DataSummary {
  totalItems: number;
  averageImportance: number;
  keyTopics: string[];
  timeSpan: {
    start: string;
    end: string;
  };
  biometricSummary: {
    avgCognitiveLoad: number;
    avgStressLevel: number;
    avgFlowState: number;
  };
}

export class CompressionService {
  constructor(private client: WeaviateClient) {}

  /**
   * Compress conversation data by removing redundant fields
   */
  async compressConversations(
    conversations: ConversationData[],
    options: CompressionOptions = {
      compressionLevel: 'medium',
      preserveFields: ['conversationId', 'userMessage', 'aiResponse', 'effectivenessScore'],
      compressionAlgorithm: 'hybrid'
    }
  ): Promise<{ compressed: any[]; result: CompressionResult }> {
    const originalSize = this.calculateDataSize(conversations);
    let compressed: any[] = [];

    switch (options.compressionAlgorithm) {
      case 'statistical':
        compressed = this.statisticalCompression(conversations, options);
        break;
      case 'semantic':
        compressed = await this.semanticCompression(conversations, options);
        break;
      case 'hybrid':
        compressed = await this.hybridCompression(conversations, options);
        break;
    }

    const compressedSize = this.calculateDataSize(compressed);

    return {
      compressed,
      result: {
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        preservedFields: options.preserveFields,
        algorithm: options.compressionAlgorithm
      }
    };
  }

  /**
   * Compress memory data using intelligent summarization
   */
  async compressMemories(
    memories: Memory[],
    options: CompressionOptions = {
      compressionLevel: 'medium',
      preserveFields: ['memoryId', 'content', 'importance', 'memoryType'],
      compressionAlgorithm: 'semantic'
    }
  ): Promise<{ compressed: any[]; result: CompressionResult }> {
    const originalSize = this.calculateDataSize(memories);
    
    // Group memories by importance and type
    const groupedMemories = this.groupMemoriesByImportance(memories);
    
    let compressed: any[] = [];
    
    // High importance: preserve fully
    compressed.push(...groupedMemories.high);
    
    // Medium importance: apply light compression
    const mediumCompressed = await this.lightCompression(groupedMemories.medium);
    compressed.push(...mediumCompressed);
    
    // Low importance: heavy compression or summarization
    const lowCompressed = await this.heavyCompression(groupedMemories.low);
    compressed.push(...lowCompressed);

    const compressedSize = this.calculateDataSize(compressed);

    return {
      compressed,
      result: {
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        preservedFields: options.preserveFields,
        algorithm: 'importance-based'
      }
    };
  }

  /**
   * Create data summaries from large datasets
   */
  async createDataSummary(data: ConversationData[] | Memory[]): Promise<DataSummary> {
    if (data.length === 0) {
      return {
        totalItems: 0,
        averageImportance: 0,
        keyTopics: [],
        timeSpan: { start: '', end: '' },
        biometricSummary: {
          avgCognitiveLoad: 0,
          avgStressLevel: 0,
          avgFlowState: 0
        }
      };
    }

    const isConversations = 'conversationId' in data[0];
    
    if (isConversations) {
      return this.createConversationSummary(data as ConversationData[]);
    } else {
      return this.createMemorySummary(data as Memory[]);
    }
  }

  /**
   * Compress biometric data by removing statistical outliers
   */
  compressBiometricData(biometrics: BiometricSnapshot[]): {
    compressed: BiometricSnapshot[];
    outliers: BiometricSnapshot[];
    stats: any;
  } {
    const compressed: BiometricSnapshot[] = [];
    const outliers: BiometricSnapshot[] = [];
    
    // Calculate statistical thresholds
    const thresholds = this.calculateBiometricThresholds(biometrics);
    
    for (const biometric of biometrics) {
      if (this.isBiometricOutlier(biometric, thresholds)) {
        outliers.push(biometric);
      } else {
        compressed.push(biometric);
      }
    }

    return {
      compressed,
      outliers,
      stats: {
        originalCount: biometrics.length,
        compressedCount: compressed.length,
        outlierCount: outliers.length,
        compressionRatio: compressed.length / biometrics.length
      }
    };
  }

  private statisticalCompression(conversations: ConversationData[], options: CompressionOptions): any[] {
    return conversations.map(conv => {
      const compressed: any = {};
      
      // Always preserve specified fields
      options.preserveFields.forEach(field => {
        if (field in conv) {
          compressed[field] = (conv as any)[field];
        }
      });

      // Based on compression level, add additional fields
      if (options.compressionLevel === 'low') {
        // Preserve most fields
        compressed.timestamp = conv.timestamp;
        compressed.userId = conv.userId;
        compressed.biometricSnapshot = {
          cognitiveLoad: conv.biometricState.cognitiveLoad,
          stressLevel: conv.biometricState.stressLevel,
          flowState: conv.biometricState.flowState
        };
      } else if (options.compressionLevel === 'medium') {
        // Preserve essential biometrics
        compressed.timestamp = conv.timestamp;
        compressed.cognitiveLoad = conv.biometricState.cognitiveLoad;
        compressed.effectivenessScore = conv.effectivenessScore;
      }
      // High compression: only preserve fields in preserveFields

      return compressed;
    });
  }

  private async semanticCompression(conversations: ConversationData[], options: CompressionOptions): Promise<any[]> {
    // Group similar conversations and create semantic summaries
    const semanticGroups = await this.groupBySemantically(conversations);
    const compressed: any[] = [];

    for (const group of semanticGroups) {
      if (group.length === 1) {
        // Single conversation: apply light compression
        compressed.push(this.lightCompressionSingle(group[0], options));
      } else {
        // Multiple conversations: create semantic summary
        const summary = this.createSemanticSummary(group);
        compressed.push(summary);
      }
    }

    return compressed;
  }

  private async hybridCompression(conversations: ConversationData[], options: CompressionOptions): Promise<any[]> {
    // Combine statistical and semantic approaches
    const statCompressed = this.statisticalCompression(conversations, options);
    const semanticGroups = await this.groupBySemantically(statCompressed);
    
    return semanticGroups.map(group => {
      if (group.length > 3) {
        return this.createSemanticSummary(group);
      }
      return group;
    }).flat();
  }

  private groupMemoriesByImportance(memories: Memory[]): {
    high: Memory[];
    medium: Memory[];
    low: Memory[];
  } {
    return {
      high: memories.filter(m => m.importance >= 0.8),
      medium: memories.filter(m => m.importance >= 0.5 && m.importance < 0.8),
      low: memories.filter(m => m.importance < 0.5)
    };
  }

  private async lightCompression(memories: Memory[]): Promise<any[]> {
    return memories.map(memory => ({
      memoryId: memory.memoryId,
      content: memory.content.length > 500 ? memory.content.substring(0, 500) + '...' : memory.content,
      memoryType: memory.memoryType,
      importance: memory.importance,
      createdAt: memory.createdAt
    }));
  }

  private async heavyCompression(memories: Memory[]): Promise<any[]> {
    // Group by type and create summaries
    const grouped = memories.reduce((acc, memory) => {
      if (!acc[memory.memoryType]) {
        acc[memory.memoryType] = [];
      }
      acc[memory.memoryType].push(memory);
      return acc;
    }, {} as Record<string, Memory[]>);

    return Object.entries(grouped).map(([type, mems]) => ({
      memoryType: type,
      count: mems.length,
      avgImportance: mems.reduce((sum, m) => sum + m.importance, 0) / mems.length,
      topics: [...new Set(mems.flatMap(m => m.relatedTopics))].slice(0, 5),
      timeSpan: {
        start: mems.reduce((earliest, m) => m.createdAt < earliest ? m.createdAt : earliest, mems[0].createdAt),
        end: mems.reduce((latest, m) => m.createdAt > latest ? m.createdAt : latest, mems[0].createdAt)
      }
    }));
  }

  private createConversationSummary(conversations: ConversationData[]): DataSummary {
    const totalItems = conversations.length;
    const avgEffectiveness = conversations.reduce((sum, c) => sum + c.effectivenessScore, 0) / totalItems;
    
    const biometricSummary = {
      avgCognitiveLoad: conversations.reduce((sum, c) => sum + c.biometricState.cognitiveLoad, 0) / totalItems,
      avgStressLevel: conversations.reduce((sum, c) => sum + c.biometricState.stressLevel, 0) / totalItems,
      avgFlowState: conversations.reduce((sum, c) => sum + c.biometricState.flowState, 0) / totalItems
    };

    const timestamps = conversations.map(c => c.timestamp).sort();
    
    return {
      totalItems,
      averageImportance: avgEffectiveness,
      keyTopics: this.extractKeyTopics(conversations.map(c => c.userMessage + ' ' + c.aiResponse)),
      timeSpan: {
        start: timestamps[0],
        end: timestamps[timestamps.length - 1]
      },
      biometricSummary
    };
  }

  private createMemorySummary(memories: Memory[]): DataSummary {
    const totalItems = memories.length;
    const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / totalItems;
    
    const timestamps = memories.map(m => m.createdAt).sort();
    
    return {
      totalItems,
      averageImportance: avgImportance,
      keyTopics: this.extractKeyTopics(memories.map(m => m.content)),
      timeSpan: {
        start: timestamps[0],
        end: timestamps[timestamps.length - 1]
      },
      biometricSummary: {
        avgCognitiveLoad: 0,
        avgStressLevel: 0,
        avgFlowState: 0
      }
    };
  }

  private calculateBiometricThresholds(biometrics: BiometricSnapshot[]): any {
    const metrics = ['heartRate', 'stressLevel', 'cognitiveLoad', 'flowState', 'attentionLevel'];
    const thresholds: any = {};

    for (const metric of metrics) {
      const values = biometrics.map(b => (b as any)[metric]).filter(v => v != null).sort((a, b) => a - b);
      if (values.length > 0) {
        const q1 = values[Math.floor(values.length * 0.25)];
        const q3 = values[Math.floor(values.length * 0.75)];
        const iqr = q3 - q1;
        
        thresholds[metric] = {
          lower: q1 - 1.5 * iqr,
          upper: q3 + 1.5 * iqr
        };
      }
    }

    return thresholds;
  }

  private isBiometricOutlier(biometric: BiometricSnapshot, thresholds: any): boolean {
    const metrics = ['heartRate', 'stressLevel', 'cognitiveLoad', 'flowState', 'attentionLevel'];
    
    for (const metric of metrics) {
      const value = (biometric as any)[metric];
      const threshold = thresholds[metric];
      
      if (threshold && (value < threshold.lower || value > threshold.upper)) {
        return true;
      }
    }
    
    return false;
  }

  private async groupBySemantically(conversations: any[]): Promise<any[][]> {
    // Simplified semantic grouping - in real implementation, would use embeddings
    const groups: any[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < conversations.length; i++) {
      if (used.has(i)) continue;
      
      const group = [conversations[i]];
      used.add(i);
      
      // Find similar conversations (simplified similarity check)
      for (let j = i + 1; j < conversations.length; j++) {
        if (used.has(j)) continue;
        
        if (this.areSimilar(conversations[i], conversations[j])) {
          group.push(conversations[j]);
          used.add(j);
        }
      }
      
      groups.push(group);
    }

    return groups;
  }

  private areSimilar(conv1: any, conv2: any): boolean {
    // Simplified similarity check
    if (!conv1.userMessage || !conv2.userMessage) return false;
    
    const words1 = conv1.userMessage.toLowerCase().split(/\s+/);
    const words2 = conv2.userMessage.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const totalWords = Math.max(words1.length, words2.length);
    
    return (commonWords / totalWords) > 0.3;
  }

  private createSemanticSummary(group: any[]): any {
    return {
      type: 'semantic_summary',
      count: group.length,
      avgEffectiveness: group.reduce((sum, c) => sum + (c.effectivenessScore || 0), 0) / group.length,
      commonTopics: this.extractKeyTopics(group.map(c => c.userMessage || '').join(' ')),
      timeSpan: {
        start: group.reduce((earliest, c) => c.timestamp < earliest ? c.timestamp : earliest, group[0].timestamp),
        end: group.reduce((latest, c) => c.timestamp > latest ? c.timestamp : latest, group[0].timestamp)
      }
    };
  }

  private lightCompressionSingle(conversation: any, options: CompressionOptions): any {
    const compressed: any = {};
    
    options.preserveFields.forEach(field => {
      if (field in conversation) {
        compressed[field] = conversation[field];
      }
    });

    return compressed;
  }

  private extractKeyTopics(texts: string[]): string[] {
    const allText = texts.join(' ').toLowerCase();
    const words = allText.split(/\s+/).filter(word => word.length > 3);
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private calculateDataSize(data: any[]): number {
    // Rough estimation of data size in bytes
    return JSON.stringify(data).length * 2; // UTF-16 encoding
  }
}