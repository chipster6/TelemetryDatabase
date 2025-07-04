import { EventEmitter } from 'events';
import { vectorDatabase } from '../vector-database.js';

export interface LifecyclePolicy {
  className: string;
  retentionPeriod: number; // milliseconds
  archiveAfter: number; // milliseconds
  deleteAfter: number; // milliseconds
  compressionEnabled: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface LifecycleConfig {
  enableAutoCleanup: boolean;
  cleanupInterval: number; // milliseconds
  batchSize: number;
  maxProcessingTime: number; // milliseconds
  enableArchiving: boolean;
  archiveCompressionRatio: number;
}

export interface LifecycleMetrics {
  recordsArchived: number;
  recordsDeleted: number;
  spaceFreed: number; // bytes
  archiveOperations: number;
  cleanupOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  lastCleanupTime?: number;
  nextScheduledCleanup?: number;
}

export interface ArchiveRecord {
  id: string;
  originalClassName: string;
  archivedAt: number;
  originalData: any;
  compressionRatio?: number;
  metadata: {
    originalSize: number;
    compressedSize: number;
    checksum: string;
  };
}

export interface DataUsageStats {
  className: string;
  totalRecords: number;
  oldestRecord: number;
  newestRecord: number;
  averageAge: number;
  sizeEstimate: number;
  growthRate: number; // records per day
  accessFrequency: number;
}

/**
 * Data lifecycle management service for Weaviate storage
 * Handles data retention, archiving, cleanup, and optimization
 */
export class LifecycleManager extends EventEmitter {
  private weaviateClient: any;
  private config: LifecycleConfig;
  private policies: Map<string, LifecyclePolicy> = new Map();
  private metrics: LifecycleMetrics;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private processingTimes: number[] = [];
  private activeOperations: Set<string> = new Set();

  constructor(config: Partial<LifecycleConfig> = {}) {
    super();
    
    this.weaviateClient = vectorDatabase.getClient();
    
    this.config = {
      enableAutoCleanup: true,
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      batchSize: 1000,
      maxProcessingTime: 30 * 60 * 1000, // 30 minutes
      enableArchiving: true,
      archiveCompressionRatio: 0.7,
      ...config
    };

    this.metrics = {
      recordsArchived: 0,
      recordsDeleted: 0,
      spaceFreed: 0,
      archiveOperations: 0,
      cleanupOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0
    };

    this.initializeDefaultPolicies();

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Add or update a lifecycle policy for a class
   */
  setLifecyclePolicy(policy: LifecyclePolicy): void {
    this.validatePolicy(policy);
    this.policies.set(policy.className, policy);
    
    this.emit('policyUpdated', {
      className: policy.className,
      policy,
      timestamp: Date.now()
    });
  }

  /**
   * Get lifecycle policy for a class
   */
  getLifecyclePolicy(className: string): LifecyclePolicy | null {
    return this.policies.get(className) || null;
  }

  /**
   * Execute lifecycle management for all classes
   */
  async executeLifecycleManagement(): Promise<{
    processed: number;
    archived: number;
    deleted: number;
    errors: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();
    const operationId = `lifecycle_${Date.now()}`;
    
    try {
      if (this.activeOperations.has('lifecycle')) {
        throw new Error('Lifecycle management already in progress');
      }

      this.activeOperations.add('lifecycle');
      
      const result = {
        processed: 0,
        archived: 0,
        deleted: 0,
        errors: [] as string[],
        processingTime: 0
      };

      // Process each class with a lifecycle policy
      for (const [className, policy] of this.policies.entries()) {
        try {
          const classResult = await this.processClassLifecycle(className, policy);
          result.processed += classResult.processed;
          result.archived += classResult.archived;
          result.deleted += classResult.deleted;
          result.errors.push(...classResult.errors);

          // Check if we've exceeded max processing time
          if (Date.now() - startTime > this.config.maxProcessingTime) {
            result.errors.push('Lifecycle management stopped due to time limit');
            break;
          }

        } catch (error) {
          result.errors.push(`Failed to process ${className}: ${error.message}`);
        }
      }

      result.processingTime = Date.now() - startTime;
      this.updateLifecycleMetrics(result);

      this.emit('lifecycleCompleted', {
        result,
        operationId,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('lifecycleError', { error, operationId });
      throw error;
    } finally {
      this.activeOperations.delete('lifecycle');
    }
  }

  /**
   * Archive old records based on lifecycle policy
   */
  async archiveRecords(
    className: string,
    olderThan: number,
    batchSize?: number
  ): Promise<{
    archived: number;
    spaceFreed: number;
    archiveIds: string[];
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.config.enableArchiving) {
        throw new Error('Archiving is disabled');
      }

      const cutoffTimestamp = new Date(Date.now() - olderThan).toISOString();
      const batch = batchSize || this.config.batchSize;

      // Find records to archive
      const records = await this.weaviateClient.graphql
        .get()
        .withClassName(className)
        .withFields('*')
        .withWhere({
          path: ['timestamp'],
          operator: 'LessThan',
          valueDate: cutoffTimestamp
        })
        .withLimit(batch)
        .do();

      const data = records?.data?.Get?.[className] || [];
      
      if (data.length === 0) {
        return { archived: 0, spaceFreed: 0, archiveIds: [] };
      }

      const archiveIds: string[] = [];
      let totalSpaceFreed = 0;

      // Archive each record
      for (const record of data) {
        try {
          const archiveId = await this.archiveRecord(className, record);
          archiveIds.push(archiveId);
          
          // Estimate space freed (simplified calculation)
          const estimatedSize = JSON.stringify(record).length;
          totalSpaceFreed += estimatedSize * (1 - this.config.archiveCompressionRatio);

        } catch (error) {
          console.warn(`Failed to archive record: ${error.message}`);
        }
      }

      // Delete original records from Weaviate
      await this.deleteRecordsBatch(className, data.map(r => r.id));

      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime);

      this.emit('recordsArchived', {
        className,
        archived: archiveIds.length,
        spaceFreed: totalSpaceFreed,
        processingTime,
        timestamp: Date.now()
      });

      return {
        archived: archiveIds.length,
        spaceFreed: totalSpaceFreed,
        archiveIds
      };

    } catch (error) {
      this.emit('archiveError', { error, className, olderThan });
      throw new Error(`Archive operation failed for ${className}: ${error.message}`);
    }
  }

  /**
   * Delete old records permanently
   */
  async deleteOldRecords(
    className: string,
    olderThan: number,
    batchSize?: number
  ): Promise<{
    deleted: number;
    spaceFreed: number;
  }> {
    const startTime = Date.now();
    
    try {
      const cutoffTimestamp = new Date(Date.now() - olderThan).toISOString();
      const batch = batchSize || this.config.batchSize;

      // Find records to delete
      const records = await this.weaviateClient.graphql
        .get()
        .withClassName(className)
        .withFields('id')
        .withWhere({
          path: ['timestamp'],
          operator: 'LessThan',
          valueDate: cutoffTimestamp
        })
        .withLimit(batch)
        .do();

      const data = records?.data?.Get?.[className] || [];
      
      if (data.length === 0) {
        return { deleted: 0, spaceFreed: 0 };
      }

      // Delete records
      const deletedCount = await this.deleteRecordsBatch(className, data.map(r => r.id));

      // Estimate space freed
      const estimatedSpaceFreed = deletedCount * 1000; // Rough estimate

      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime);

      this.emit('recordsDeleted', {
        className,
        deleted: deletedCount,
        spaceFreed: estimatedSpaceFreed,
        processingTime,
        timestamp: Date.now()
      });

      return {
        deleted: deletedCount,
        spaceFreed: estimatedSpaceFreed
      };

    } catch (error) {
      this.emit('deleteError', { error, className, olderThan });
      throw new Error(`Delete operation failed for ${className}: ${error.message}`);
    }
  }

  /**
   * Get data usage statistics for all classes
   */
  async getDataUsageStats(): Promise<DataUsageStats[]> {
    try {
      const classes = ['NexisConversation', 'NexisMemoryNode', 'NexisBiometricPattern', 'NexisKnowledgeGraph'];
      const stats: DataUsageStats[] = [];

      for (const className of classes) {
        try {
          const classStats = await this.getClassUsageStats(className);
          stats.push(classStats);
        } catch (error) {
          console.warn(`Failed to get stats for ${className}:`, error);
        }
      }

      return stats;

    } catch (error) {
      this.emit('statsError', { error });
      throw new Error(`Failed to get data usage stats: ${error.message}`);
    }
  }

  /**
   * Restore archived records
   */
  async restoreArchivedRecords(
    archiveIds: string[],
    targetClassName?: string
  ): Promise<{
    restored: number;
    failed: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    
    try {
      const result = {
        restored: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const archiveId of archiveIds) {
        try {
          const archived = await this.getArchivedRecord(archiveId);
          if (!archived) {
            result.errors.push(`Archive not found: ${archiveId}`);
            result.failed++;
            continue;
          }

          const className = targetClassName || archived.originalClassName;
          
          // Restore to Weaviate
          await this.weaviateClient.data
            .creator()
            .withClassName(className)
            .withProperties(archived.originalData)
            .do();

          result.restored++;

        } catch (error) {
          result.errors.push(`Failed to restore ${archiveId}: ${error.message}`);
          result.failed++;
        }
      }

      const processingTime = Date.now() - startTime;

      this.emit('recordsRestored', {
        restored: result.restored,
        failed: result.failed,
        processingTime,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.emit('restoreError', { error, archiveIds });
      throw new Error(`Restore operation failed: ${error.message}`);
    }
  }

  /**
   * Get lifecycle metrics
   */
  getMetrics(): LifecycleMetrics {
    return {
      ...this.metrics,
      nextScheduledCleanup: this.config.enableAutoCleanup ? 
        Date.now() + this.config.cleanupInterval : undefined
    };
  }

  /**
   * Update lifecycle configuration
   */
  updateConfig(newConfig: Partial<LifecycleConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart auto-cleanup if settings changed
    if (newConfig.enableAutoCleanup !== undefined || newConfig.cleanupInterval !== undefined) {
      this.stopAutoCleanup();
      if (this.config.enableAutoCleanup) {
        this.startAutoCleanup();
      }
    }

    this.emit('configUpdated', {
      oldConfig,
      newConfig: this.config,
      timestamp: Date.now()
    });
  }

  // ==================== Private Methods ====================

  /**
   * Initialize default lifecycle policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: LifecyclePolicy[] = [
      {
        className: 'NexisConversation',
        retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
        archiveAfter: 90 * 24 * 60 * 60 * 1000, // 90 days
        deleteAfter: 730 * 24 * 60 * 60 * 1000, // 2 years
        compressionEnabled: true,
        priority: 'high'
      },
      {
        className: 'NexisMemoryNode',
        retentionPeriod: 730 * 24 * 60 * 60 * 1000, // 2 years
        archiveAfter: 180 * 24 * 60 * 60 * 1000, // 6 months
        deleteAfter: 1095 * 24 * 60 * 60 * 1000, // 3 years
        compressionEnabled: true,
        priority: 'medium'
      },
      {
        className: 'NexisBiometricPattern',
        retentionPeriod: 1095 * 24 * 60 * 60 * 1000, // 3 years
        archiveAfter: 365 * 24 * 60 * 60 * 1000, // 1 year
        deleteAfter: 1460 * 24 * 60 * 60 * 1000, // 4 years
        compressionEnabled: true,
        priority: 'low'
      },
      {
        className: 'NexisKnowledgeGraph',
        retentionPeriod: 1095 * 24 * 60 * 60 * 1000, // 3 years
        archiveAfter: 365 * 24 * 60 * 60 * 1000, // 1 year
        deleteAfter: 1460 * 24 * 60 * 60 * 1000, // 4 years
        compressionEnabled: true,
        priority: 'medium'
      }
    ];

    for (const policy of defaultPolicies) {
      this.policies.set(policy.className, policy);
    }
  }

  /**
   * Start automatic cleanup scheduler
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.executeLifecycleManagement();
      } catch (error) {
        console.error('Auto cleanup failed:', error);
        this.emit('autoCleanupFailed', { error, timestamp: Date.now() });
      }
    }, this.config.cleanupInterval);

    this.emit('autoCleanupStarted', {
      interval: this.config.cleanupInterval,
      timestamp: Date.now()
    });
  }

  /**
   * Stop automatic cleanup scheduler
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.emit('autoCleanupStopped', { timestamp: Date.now() });
    }
  }

  /**
   * Process lifecycle for a specific class
   */
  private async processClassLifecycle(
    className: string, 
    policy: LifecyclePolicy
  ): Promise<{
    processed: number;
    archived: number;
    deleted: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      archived: 0,
      deleted: 0,
      errors: [] as string[]
    };

    try {
      // Archive old records first
      if (this.config.enableArchiving && policy.archiveAfter > 0) {
        const archiveResult = await this.archiveRecords(className, policy.archiveAfter);
        result.archived = archiveResult.archived;
        result.processed += archiveResult.archived;
      }

      // Delete very old records
      if (policy.deleteAfter > 0) {
        const deleteResult = await this.deleteOldRecords(className, policy.deleteAfter);
        result.deleted = deleteResult.deleted;
        result.processed += deleteResult.deleted;
      }

    } catch (error) {
      result.errors.push(`Lifecycle processing failed for ${className}: ${error.message}`);
    }

    return result;
  }

  /**
   * Archive a single record
   */
  private async archiveRecord(className: string, record: any): Promise<string> {
    const archiveId = this.generateArchiveId(className);
    const originalSize = JSON.stringify(record).length;
    
    // Compress data (simplified - would use proper compression)
    const compressedData = this.compressData(record);
    const compressedSize = compressedData.length;

    const archiveRecord: ArchiveRecord = {
      id: archiveId,
      originalClassName: className,
      archivedAt: Date.now(),
      originalData: record,
      compressionRatio: compressedSize / originalSize,
      metadata: {
        originalSize,
        compressedSize,
        checksum: this.generateChecksum(JSON.stringify(record))
      }
    };

    // Store archive (in production, would use archive storage)
    await this.storeArchiveRecord(archiveRecord);

    return archiveId;
  }

  /**
   * Delete records in batch
   */
  private async deleteRecordsBatch(className: string, ids: string[]): Promise<number> {
    let deletedCount = 0;

    for (const id of ids) {
      try {
        await this.weaviateClient.data
          .deleter()
          .withClassName(className)
          .withId(id)
          .do();
        
        deletedCount++;
      } catch (error) {
        console.warn(`Failed to delete record ${id}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Get usage statistics for a class
   */
  private async getClassUsageStats(className: string): Promise<DataUsageStats> {
    // Get record count
    const countResult = await this.weaviateClient.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();

    const totalRecords = countResult?.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;

    // Get oldest and newest records (simplified)
    const oldestResult = await this.weaviateClient.graphql
      .get()
      .withClassName(className)
      .withFields('timestamp')
      .withSort([{ path: ['timestamp'], order: 'asc' }])
      .withLimit(1)
      .do();

    const newestResult = await this.weaviateClient.graphql
      .get()
      .withClassName(className)
      .withFields('timestamp')
      .withSort([{ path: ['timestamp'], order: 'desc' }])
      .withLimit(1)
      .do();

    const oldestData = oldestResult?.data?.Get?.[className]?.[0];
    const newestData = newestResult?.data?.Get?.[className]?.[0];

    const oldestRecord = oldestData ? new Date(oldestData.timestamp).getTime() : Date.now();
    const newestRecord = newestData ? new Date(newestData.timestamp).getTime() : Date.now();
    const averageAge = (Date.now() - oldestRecord) / 2;

    // Calculate growth rate (simplified)
    const timeSpan = Math.max(1, newestRecord - oldestRecord);
    const growthRate = totalRecords / (timeSpan / (24 * 60 * 60 * 1000));

    return {
      className,
      totalRecords,
      oldestRecord,
      newestRecord,
      averageAge,
      sizeEstimate: totalRecords * 1000, // Rough estimate
      growthRate,
      accessFrequency: 1.0 // Would be calculated from access logs
    };
  }

  /**
   * Validate lifecycle policy
   */
  private validatePolicy(policy: LifecyclePolicy): void {
    if (policy.archiveAfter >= policy.deleteAfter) {
      throw new Error('Archive period must be less than delete period');
    }

    if (policy.retentionPeriod > policy.deleteAfter) {
      throw new Error('Retention period cannot be longer than delete period');
    }

    if (policy.archiveAfter <= 0 || policy.deleteAfter <= 0) {
      throw new Error('Archive and delete periods must be positive');
    }
  }

  /**
   * Update lifecycle metrics
   */
  private updateLifecycleMetrics(result: any): void {
    this.metrics.recordsArchived += result.archived;
    this.metrics.recordsDeleted += result.deleted;
    this.metrics.cleanupOperations++;
    this.metrics.lastCleanupTime = Date.now();
    
    if (result.processingTime) {
      this.updateProcessingMetrics(result.processingTime);
    }
  }

  /**
   * Update processing time metrics
   */
  private updateProcessingMetrics(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
    
    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * Helper methods (simplified implementations)
   */
  private generateArchiveId(className: string): string {
    return `archive_${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChecksum(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private compressData(data: any): string {
    // Simplified compression (production would use proper compression library)
    return JSON.stringify(data);
  }

  // Placeholder methods for archive storage
  private async storeArchiveRecord(archive: ArchiveRecord): Promise<void> {
    // Implementation would store to archive storage
  }

  private async getArchivedRecord(archiveId: string): Promise<ArchiveRecord | null> {
    // Implementation would retrieve from archive storage
    return null;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.stopAutoCleanup();
    
    // Wait for active operations to complete
    while (this.activeOperations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processingTimes = [];
    this.removeAllListeners();
  }
}