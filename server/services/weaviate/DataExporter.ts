import type { WeaviateClient } from 'weaviate-client';
import { ConversationData, Memory, BiometricPattern } from '../weaviate.service';

export interface ExportOptions {
  format: 'json' | 'csv' | 'parquet' | 'jsonl';
  compression?: 'none' | 'gzip' | 'brotli';
  includeMetadata: boolean;
  chunkSize?: number;
  maxRecords?: number;
  timeRange?: {
    start: string;
    end: string;
  };
  userFilter?: number[];
  fields?: string[];
}

export interface ExportResult {
  success: boolean;
  recordCount: number;
  fileSize: number;
  exportPath?: string;
  chunks?: string[];
  error?: string;
  metadata: {
    exportedAt: string;
    format: string;
    compression: string;
    timeRange?: { start: string; end: string };
    totalRecords: number;
  };
}

export interface ExportProgress {
  processed: number;
  total: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  estimatedTimeRemaining: number;
}

export class DataExporter {
  private exportCallbacks: Array<(progress: ExportProgress) => void> = [];

  constructor(private client: WeaviateClient) {}

  /**
   * Export conversation data with biometric context
   */
  async exportConversations(options: ExportOptions): Promise<ExportResult> {
    try {
      const startTime = Date.now();
      
      // Fetch conversations with filters
      const conversations = await this.fetchConversations(options);
      
      if (conversations.length === 0) {
        return {
          success: true,
          recordCount: 0,
          fileSize: 0,
          metadata: {
            exportedAt: new Date().toISOString(),
            format: options.format,
            compression: options.compression || 'none',
            totalRecords: 0
          }
        };
      }

      // Process and format data
      const processedData = this.processConversationData(conversations, options);
      
      // Export based on format
      const result = await this.exportData(processedData, options, 'conversations');
      
      console.log(`✓ Exported ${result.recordCount} conversations in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('Failed to export conversations:', error);
      return {
        success: false,
        recordCount: 0,
        fileSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          exportedAt: new Date().toISOString(),
          format: options.format,
          compression: options.compression || 'none',
          totalRecords: 0
        }
      };
    }
  }

  /**
   * Export memory data
   */
  async exportMemories(options: ExportOptions): Promise<ExportResult> {
    try {
      const startTime = Date.now();
      
      const memories = await this.fetchMemories(options);
      
      if (memories.length === 0) {
        return {
          success: true,
          recordCount: 0,
          fileSize: 0,
          metadata: {
            exportedAt: new Date().toISOString(),
            format: options.format,
            compression: options.compression || 'none',
            totalRecords: 0
          }
        };
      }

      const processedData = this.processMemoryData(memories, options);
      const result = await this.exportData(processedData, options, 'memories');
      
      console.log(`✓ Exported ${result.recordCount} memories in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('Failed to export memories:', error);
      return {
        success: false,
        recordCount: 0,
        fileSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          exportedAt: new Date().toISOString(),
          format: options.format,
          compression: options.compression || 'none',
          totalRecords: 0
        }
      };
    }
  }

  /**
   * Export biometric patterns
   */
  async exportBiometricPatterns(options: ExportOptions): Promise<ExportResult> {
    try {
      const patterns = await this.fetchBiometricPatterns(options);
      
      const processedData = this.processPatternData(patterns, options);
      const result = await this.exportData(processedData, options, 'patterns');
      
      console.log(`✓ Exported ${result.recordCount} biometric patterns`);
      return result;

    } catch (error) {
      console.error('Failed to export biometric patterns:', error);
      return {
        success: false,
        recordCount: 0,
        fileSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          exportedAt: new Date().toISOString(),
          format: options.format,
          compression: options.compression || 'none',
          totalRecords: 0
        }
      };
    }
  }

  /**
   * Export all data types in a comprehensive backup
   */
  async exportComprehensiveBackup(options: ExportOptions): Promise<{
    conversations: ExportResult;
    memories: ExportResult;
    patterns: ExportResult;
    overall: {
      success: boolean;
      totalRecords: number;
      totalSize: number;
      exportedAt: string;
    };
  }> {
    const [conversations, memories, patterns] = await Promise.all([
      this.exportConversations(options),
      this.exportMemories(options),
      this.exportBiometricPatterns(options)
    ]);

    return {
      conversations,
      memories,
      patterns,
      overall: {
        success: conversations.success && memories.success && patterns.success,
        totalRecords: conversations.recordCount + memories.recordCount + patterns.recordCount,
        totalSize: conversations.fileSize + memories.fileSize + patterns.fileSize,
        exportedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Stream large datasets in chunks
   */
  async streamExport(
    dataType: 'conversations' | 'memories' | 'patterns',
    options: ExportOptions,
    onChunk: (chunk: any[], progress: ExportProgress) => void
  ): Promise<ExportResult> {
    try {
      const chunkSize = options.chunkSize || 1000;
      let offset = 0;
      let totalProcessed = 0;
      const chunks: string[] = [];
      
      // Get total count for progress tracking
      const totalRecords = await this.getRecordCount(dataType, options);
      const totalChunks = Math.ceil(totalRecords / chunkSize);
      
      while (offset < totalRecords) {
        const chunk = await this.fetchChunk(dataType, options, offset, chunkSize);
        
        if (chunk.length === 0) break;
        
        const processed = this.processChunkData(chunk, dataType, options);
        const chunkPath = await this.exportChunk(processed, options, totalProcessed);
        
        if (chunkPath) {
          chunks.push(chunkPath);
        }
        
        totalProcessed += chunk.length;
        
        const progress: ExportProgress = {
          processed: totalProcessed,
          total: totalRecords,
          percentage: (totalProcessed / totalRecords) * 100,
          currentChunk: Math.floor(offset / chunkSize) + 1,
          totalChunks,
          estimatedTimeRemaining: this.estimateTimeRemaining(totalProcessed, totalRecords)
        };
        
        onChunk(processed, progress);
        this.notifyProgress(progress);
        
        offset += chunkSize;
      }

      return {
        success: true,
        recordCount: totalProcessed,
        fileSize: this.calculateTotalSize(chunks),
        chunks,
        metadata: {
          exportedAt: new Date().toISOString(),
          format: options.format,
          compression: options.compression || 'none',
          totalRecords: totalProcessed
        }
      };

    } catch (error) {
      console.error('Failed to stream export:', error);
      return {
        success: false,
        recordCount: 0,
        fileSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          exportedAt: new Date().toISOString(),
          format: options.format,
          compression: options.compression || 'none',
          totalRecords: 0
        }
      };
    }
  }

  private async fetchConversations(options: ExportOptions): Promise<any[]> {
    let query = this.client.graphql
      .get()
      .withClassName('Conversation')
      .withFields([
        'conversationId',
        'userId',
        'userMessage',
        'aiResponse',
        'conversationContext',
        'effectivenessScore',
        'heartRate',
        'stressLevel',
        'attentionLevel',
        'cognitiveLoad',
        'flowState',
        'timestamp',
        '_additional { id }'
      ]);

    // Apply filters
    if (options.timeRange || options.userFilter) {
      const whereConditions: any[] = [];
      
      if (options.timeRange) {
        whereConditions.push({
          path: ['timestamp'],
          operator: 'GreaterThanEqual',
          valueText: options.timeRange.start
        });
        whereConditions.push({
          path: ['timestamp'],
          operator: 'LessThanEqual',
          valueText: options.timeRange.end
        });
      }
      
      if (options.userFilter && options.userFilter.length > 0) {
        whereConditions.push({
          path: ['userId'],
          operator: 'ContainsAny',
          valueInt: options.userFilter
        });
      }
      
      if (whereConditions.length > 0) {
        query = query.withWhere({
          operator: 'And',
          operands: whereConditions
        });
      }
    }

    if (options.maxRecords) {
      query = query.withLimit(options.maxRecords);
    }

    const result = await query.do();
    return result.data?.Get?.Conversation || [];
  }

  private async fetchMemories(options: ExportOptions): Promise<any[]> {
    let query = this.client.graphql
      .get()
      .withClassName('Memory')
      .withFields([
        'memoryId',
        'userId',
        'content',
        'memoryType',
        'importance',
        'confidenceLevel',
        'emotionalValence',
        'createdAt',
        '_additional { id }'
      ]);

    // Apply similar filters as conversations
    if (options.userFilter && options.userFilter.length > 0) {
      query = query.withWhere({
        path: ['userId'],
        operator: 'ContainsAny',
        valueInt: options.userFilter
      });
    }

    if (options.maxRecords) {
      query = query.withLimit(options.maxRecords);
    }

    const result = await query.do();
    return result.data?.Get?.Memory || [];
  }

  private async fetchBiometricPatterns(options: ExportOptions): Promise<any[]> {
    let query = this.client.graphql
      .get()
      .withClassName('BiometricPattern')
      .withFields([
        'patternId',
        'patternName',
        'description',
        'heartRateMin',
        'heartRateMax',
        'stressLevelMin',
        'stressLevelMax',
        'optimalStrategies',
        'successRate',
        'lastUpdated',
        '_additional { id }'
      ]);

    if (options.maxRecords) {
      query = query.withLimit(options.maxRecords);
    }

    const result = await query.do();
    return result.data?.Get?.BiometricPattern || [];
  }

  private processConversationData(conversations: any[], options: ExportOptions): any[] {
    return conversations.map(conv => {
      const processed: any = {};
      
      if (options.fields && options.fields.length > 0) {
        // Only include specified fields
        options.fields.forEach(field => {
          if (field in conv) {
            processed[field] = conv[field];
          }
        });
      } else {
        // Include all fields
        Object.assign(processed, conv);
      }

      if (options.includeMetadata) {
        processed._metadata = {
          exportedAt: new Date().toISOString(),
          dataType: 'conversation'
        };
      }

      return processed;
    });
  }

  private processMemoryData(memories: any[], options: ExportOptions): any[] {
    return memories.map(memory => {
      const processed: any = {};
      
      if (options.fields && options.fields.length > 0) {
        options.fields.forEach(field => {
          if (field in memory) {
            processed[field] = memory[field];
          }
        });
      } else {
        Object.assign(processed, memory);
      }

      if (options.includeMetadata) {
        processed._metadata = {
          exportedAt: new Date().toISOString(),
          dataType: 'memory'
        };
      }

      return processed;
    });
  }

  private processPatternData(patterns: any[], options: ExportOptions): any[] {
    return patterns.map(pattern => {
      const processed: any = {};
      
      if (options.fields && options.fields.length > 0) {
        options.fields.forEach(field => {
          if (field in pattern) {
            processed[field] = pattern[field];
          }
        });
      } else {
        Object.assign(processed, pattern);
      }

      if (options.includeMetadata) {
        processed._metadata = {
          exportedAt: new Date().toISOString(),
          dataType: 'biometric_pattern'
        };
      }

      return processed;
    });
  }

  private async exportData(data: any[], options: ExportOptions, dataType: string): Promise<ExportResult> {
    let exportedData: string;
    let fileSize: number;

    switch (options.format) {
      case 'json':
        exportedData = JSON.stringify(data, null, 2);
        break;
      case 'jsonl':
        exportedData = data.map(item => JSON.stringify(item)).join('\n');
        break;
      case 'csv':
        exportedData = this.convertToCSV(data);
        break;
      case 'parquet':
        // Would require a parquet library
        throw new Error('Parquet format not yet implemented');
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    fileSize = Buffer.byteLength(exportedData, 'utf8');

    // Apply compression if specified
    if (options.compression && options.compression !== 'none') {
      const compressed = await this.compressData(exportedData, options.compression);
      exportedData = compressed;
      fileSize = Buffer.byteLength(compressed, 'utf8');
    }

    return {
      success: true,
      recordCount: data.length,
      fileSize,
      metadata: {
        exportedAt: new Date().toISOString(),
        format: options.format,
        compression: options.compression || 'none',
        totalRecords: data.length
      }
    };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(',')];

    for (const item of data) {
      const values = headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvLines.push(values.join(','));
    }

    return csvLines.join('\n');
  }

  private async compressData(data: string, algorithm: string): Promise<string> {
    // Simplified compression - would use actual compression libraries
    switch (algorithm) {
      case 'gzip':
        // Would use zlib.gzip
        return data; // Placeholder
      case 'brotli':
        // Would use zlib.brotliCompress
        return data; // Placeholder
      default:
        return data;
    }
  }

  private async getRecordCount(dataType: string, options: ExportOptions): Promise<number> {
    let className: string;
    switch (dataType) {
      case 'conversations':
        className = 'Conversation';
        break;
      case 'memories':
        className = 'Memory';
        break;
      case 'patterns':
        className = 'BiometricPattern';
        break;
      default:
        return 0;
    }

    const result = await this.client.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();

    return result.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;
  }

  private async fetchChunk(
    dataType: string,
    options: ExportOptions,
    offset: number,
    limit: number
  ): Promise<any[]> {
    // Simplified chunk fetching - would need proper pagination
    switch (dataType) {
      case 'conversations':
        return this.fetchConversations({ ...options, maxRecords: limit });
      case 'memories':
        return this.fetchMemories({ ...options, maxRecords: limit });
      case 'patterns':
        return this.fetchBiometricPatterns({ ...options, maxRecords: limit });
      default:
        return [];
    }
  }

  private processChunkData(chunk: any[], dataType: string, options: ExportOptions): any[] {
    switch (dataType) {
      case 'conversations':
        return this.processConversationData(chunk, options);
      case 'memories':
        return this.processMemoryData(chunk, options);
      case 'patterns':
        return this.processPatternData(chunk, options);
      default:
        return chunk;
    }
  }

  private async exportChunk(data: any[], options: ExportOptions, chunkIndex: number): Promise<string | null> {
    // Would save chunk to file and return path
    const chunkPath = `/tmp/export_chunk_${chunkIndex}_${Date.now()}.${options.format}`;
    console.log(`Exported chunk ${chunkIndex} with ${data.length} records to ${chunkPath}`);
    return chunkPath;
  }

  private estimateTimeRemaining(processed: number, total: number): number {
    if (processed === 0) return 0;
    const rate = processed / (Date.now() / 1000); // records per second
    const remaining = total - processed;
    return remaining / rate;
  }

  private calculateTotalSize(chunks: string[]): number {
    // Would calculate actual file sizes
    return chunks.length * 1024; // Placeholder
  }

  // Progress notification system
  onProgress(callback: (progress: ExportProgress) => void): void {
    this.exportCallbacks.push(callback);
  }

  private notifyProgress(progress: ExportProgress): void {
    this.exportCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in export progress callback:', error);
      }
    });
  }

  /**
   * Get export statistics
   */
  async getExportStatistics(): Promise<{
    totalConversations: number;
    totalMemories: number;
    totalPatterns: number;
    oldestRecord: string;
    newestRecord: string;
  }> {
    const [convCount, memCount, patternCount] = await Promise.all([
      this.getRecordCount('conversations', { format: 'json', includeMetadata: false }),
      this.getRecordCount('memories', { format: 'json', includeMetadata: false }),
      this.getRecordCount('patterns', { format: 'json', includeMetadata: false })
    ]);

    return {
      totalConversations: convCount,
      totalMemories: memCount,
      totalPatterns: patternCount,
      oldestRecord: '2024-01-01T00:00:00Z', // Would query actual oldest
      newestRecord: new Date().toISOString()
    };
  }
}