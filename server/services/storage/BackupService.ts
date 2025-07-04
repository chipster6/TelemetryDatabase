import { EventEmitter } from 'events';
import { vectorDatabase } from '../vector-database.js';
import type { VectorDocument } from './StorageManager';

export interface BackupConfig {
  enableAutoBackup: boolean;
  backupInterval: number; // milliseconds
  maxBackupSize: number; // bytes
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  retentionPeriod: number; // milliseconds
}

export interface BackupMetadata {
  id: string;
  timestamp: number;
  version: string;
  className: string;
  recordCount: number;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
}

export interface BackupMetrics {
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  totalDataBacked: number; // bytes
  averageBackupTime: number;
  lastBackupTime?: number;
  nextScheduledBackup?: number;
}

export interface RestoreOptions {
  targetClassName?: string;
  overwriteExisting: boolean;
  validateIntegrity: boolean;
  batchSize: number;
}

/**
 * Comprehensive backup and recovery service for Weaviate data
 * Handles automated backups, data export/import, and disaster recovery
 */
export class BackupService extends EventEmitter {
  private weaviateClient: any;
  private config: BackupConfig;
  private metrics: BackupMetrics;
  private backupTimer: NodeJS.Timeout | null = null;
  private backupTimes: number[] = [];
  private activeBackups: Map<string, Promise<void>> = new Map();

  constructor(config: Partial<BackupConfig> = {}) {
    super();
    
    this.weaviateClient = vectorDatabase.getClient();
    
    this.config = {
      enableAutoBackup: true,
      backupInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxBackupSize: 100 * 1024 * 1024, // 100MB
      compressionEnabled: true,
      encryptionEnabled: false,
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      ...config
    };

    this.metrics = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      totalDataBacked: 0,
      averageBackupTime: 0
    };

    if (this.config.enableAutoBackup) {
      this.startAutoBackup();
    }
  }

  /**
   * Create a complete backup of a Weaviate class
   */
  async createBackup(className: string, options: {
    includeVectors?: boolean;
    batchSize?: number;
    compression?: boolean;
  } = {}): Promise<BackupMetadata> {
    const startTime = Date.now();
    const backupId = this.generateBackupId(className);
    
    try {
      if (!this.weaviateClient) {
        throw new Error('Weaviate client not available');
      }

      // Check if backup is already in progress
      if (this.activeBackups.has(className)) {
        throw new Error(`Backup already in progress for class: ${className}`);
      }

      const backupPromise = this.performBackup(className, backupId, options);
      this.activeBackups.set(className, backupPromise);

      await backupPromise;

      const backupTime = Date.now() - startTime;
      const metadata = await this.generateBackupMetadata(backupId, className, backupTime);

      this.updateBackupMetrics(true, backupTime, metadata.size);
      
      this.emit('backupCreated', {
        backupId,
        className,
        metadata,
        backupTime,
        timestamp: Date.now()
      });

      return metadata;

    } catch (error) {
      this.updateBackupMetrics(false, Date.now() - startTime, 0);
      this.emit('backupFailed', { error, className, backupId });
      throw new Error(`Backup failed for ${className}: ${error.message}`);
    } finally {
      this.activeBackups.delete(className);
    }
  }

  /**
   * Restore data from a backup
   */
  async restoreFromBackup(
    backupId: string, 
    options: RestoreOptions = {
      overwriteExisting: false,
      validateIntegrity: true,
      batchSize: 100
    }
  ): Promise<{
    restoredRecords: number;
    skippedRecords: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Validate backup integrity if requested
      if (options.validateIntegrity) {
        const isValid = await this.validateBackupIntegrity(backupId, metadata);
        if (!isValid) {
          throw new Error(`Backup integrity validation failed: ${backupId}`);
        }
      }

      const restorationResult = await this.performRestore(backupId, metadata, options);
      
      const restoreTime = Date.now() - startTime;
      
      this.emit('restoreCompleted', {
        backupId,
        className: metadata.className,
        restoredRecords: restorationResult.restoredRecords,
        skippedRecords: restorationResult.skippedRecords,
        restoreTime,
        timestamp: Date.now()
      });

      return restorationResult;

    } catch (error) {
      this.emit('restoreFailed', { error, backupId, options });
      throw new Error(`Restore failed for backup ${backupId}: ${error.message}`);
    }
  }

  /**
   * Export data to external format (JSON, CSV)
   */
  async exportData(
    className: string,
    format: 'json' | 'csv' = 'json',
    options: {
      includeVectors?: boolean;
      filterConditions?: any;
      maxRecords?: number;
    } = {}
  ): Promise<{
    exportId: string;
    format: string;
    recordCount: number;
    size: number;
    downloadUrl?: string;
  }> {
    const startTime = Date.now();
    const exportId = this.generateExportId(className, format);
    
    try {
      // Query data with optional filters
      let query = this.weaviateClient.graphql
        .get()
        .withClassName(className);

      // Add all fields (simplified - in production would be configurable)
      query = query.withFields('*');

      if (options.filterConditions) {
        query = query.withWhere(options.filterConditions);
      }

      if (options.maxRecords) {
        query = query.withLimit(options.maxRecords);
      }

      const results = await query.do();
      const data = results?.data?.Get?.[className] || [];

      // Format data based on requested format
      const formattedData = this.formatExportData(data, format, options);
      const exportSize = Buffer.byteLength(formattedData, 'utf8');

      // Store export data (in production, would save to file system or cloud storage)
      await this.storeExportData(exportId, formattedData);

      const exportTime = Date.now() - startTime;

      this.emit('dataExported', {
        exportId,
        className,
        format,
        recordCount: data.length,
        size: exportSize,
        exportTime,
        timestamp: Date.now()
      });

      return {
        exportId,
        format,
        recordCount: data.length,
        size: exportSize
      };

    } catch (error) {
      this.emit('exportFailed', { error, className, format, options });
      throw new Error(`Export failed for ${className}: ${error.message}`);
    }
  }

  /**
   * Import data from external source
   */
  async importData(
    className: string,
    data: any[],
    options: {
      batchSize?: number;
      skipDuplicates?: boolean;
      validateSchema?: boolean;
    } = {}
  ): Promise<{
    importedRecords: number;
    skippedRecords: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 100;
    
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid import data provided');
      }

      const result = {
        importedRecords: 0,
        skippedRecords: 0,
        errors: [] as string[]
      };

      // Process data in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResult = await this.importBatch(className, batch, options);
        
        result.importedRecords += batchResult.imported;
        result.skippedRecords += batchResult.skipped;
        result.errors.push(...batchResult.errors);
      }

      const importTime = Date.now() - startTime;

      this.emit('dataImported', {
        className,
        totalRecords: data.length,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorCount: result.errors.length,
        importTime,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.emit('importFailed', { error, className, dataLength: data?.length });
      throw new Error(`Import failed for ${className}: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups(className?: string): Promise<BackupMetadata[]> {
    try {
      // In production, this would query a backup metadata store
      // For now, return mock data
      const allBackups = await this.getAllBackupMetadata();
      
      if (className) {
        return allBackups.filter(backup => backup.className === className);
      }
      
      return allBackups;

    } catch (error) {
      this.emit('listBackupsError', { error, className });
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<{
    deletedBackups: number;
    freedSpace: number;
  }> {
    try {
      const allBackups = await this.getAllBackupMetadata();
      const cutoffTime = Date.now() - this.config.retentionPeriod;
      
      const oldBackups = allBackups.filter(backup => backup.timestamp < cutoffTime);
      
      let freedSpace = 0;
      for (const backup of oldBackups) {
        await this.deleteBackup(backup.id);
        freedSpace += backup.size;
      }

      this.emit('backupsCleanedUp', {
        deletedBackups: oldBackups.length,
        freedSpace,
        timestamp: Date.now()
      });

      return {
        deletedBackups: oldBackups.length,
        freedSpace
      };

    } catch (error) {
      this.emit('cleanupError', { error });
      throw new Error(`Backup cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get backup service metrics
   */
  getMetrics(): BackupMetrics {
    return {
      ...this.metrics,
      nextScheduledBackup: this.config.enableAutoBackup ? 
        Date.now() + this.config.backupInterval : undefined
    };
  }

  /**
   * Update backup configuration
   */
  updateConfig(newConfig: Partial<BackupConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart auto-backup if settings changed
    if (newConfig.enableAutoBackup !== undefined || newConfig.backupInterval !== undefined) {
      this.stopAutoBackup();
      if (this.config.enableAutoBackup) {
        this.startAutoBackup();
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
   * Start automatic backup scheduler
   */
  private startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(async () => {
      try {
        const classes = ['NexisConversation', 'NexisMemoryNode', 'NexisBiometricPattern', 'NexisKnowledgeGraph'];
        
        for (const className of classes) {
          await this.createBackup(className, { compression: this.config.compressionEnabled });
        }

        // Cleanup old backups
        await this.cleanupOldBackups();

      } catch (error) {
        console.error('Auto backup failed:', error);
        this.emit('autoBackupFailed', { error, timestamp: Date.now() });
      }
    }, this.config.backupInterval);

    this.emit('autoBackupStarted', {
      interval: this.config.backupInterval,
      timestamp: Date.now()
    });
  }

  /**
   * Stop automatic backup scheduler
   */
  private stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
      this.emit('autoBackupStopped', { timestamp: Date.now() });
    }
  }

  /**
   * Perform the actual backup operation
   */
  private async performBackup(
    className: string, 
    backupId: string, 
    options: any
  ): Promise<void> {
    // Implementation would depend on storage backend
    // This is a simplified version
    const batchSize = options.batchSize || 1000;
    let offset = 0;
    const backupData: any[] = [];

    while (true) {
      const batch = await this.weaviateClient.graphql
        .get()
        .withClassName(className)
        .withFields('*')
        .withLimit(batchSize)
        .withOffset(offset)
        .do();

      const data = batch?.data?.Get?.[className] || [];
      if (data.length === 0) break;

      backupData.push(...data);
      offset += batchSize;
    }

    // Store backup data (simplified - would use proper storage)
    await this.storeBackupData(backupId, backupData, options);
  }

  /**
   * Perform restoration from backup
   */
  private async performRestore(
    backupId: string,
    metadata: BackupMetadata,
    options: RestoreOptions
  ): Promise<{ restoredRecords: number; skippedRecords: number; errors: string[] }> {
    // Implementation would restore data from backup
    // This is a simplified version
    const data = await this.loadBackupData(backupId);
    return await this.importData(metadata.className, data, {
      batchSize: options.batchSize,
      skipDuplicates: !options.overwriteExisting
    });
  }

  /**
   * Import a batch of records
   */
  private async importBatch(
    className: string,
    batch: any[],
    options: any
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const record of batch) {
      try {
        await this.weaviateClient.data
          .creator()
          .withClassName(className)
          .withProperties(record)
          .do();
        
        result.imported++;
      } catch (error) {
        if (options.skipDuplicates && error.message.includes('already exists')) {
          result.skipped++;
        } else {
          result.errors.push(`Record import failed: ${error.message}`);
        }
      }
    }

    return result;
  }

  /**
   * Generate backup metadata
   */
  private async generateBackupMetadata(
    backupId: string,
    className: string,
    backupTime: number
  ): Promise<BackupMetadata> {
    // Simplified metadata generation
    const stats = await this.weaviateClient.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();

    const recordCount = stats?.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;

    return {
      id: backupId,
      timestamp: Date.now(),
      version: '1.0.0',
      className,
      recordCount,
      size: recordCount * 1000, // Estimated size
      compressed: this.config.compressionEnabled,
      encrypted: this.config.encryptionEnabled,
      checksum: this.generateChecksum(backupId + className + recordCount)
    };
  }

  /**
   * Update backup metrics
   */
  private updateBackupMetrics(success: boolean, backupTime: number, dataSize: number): void {
    this.metrics.totalBackups++;
    
    if (success) {
      this.metrics.successfulBackups++;
      this.metrics.totalDataBacked += dataSize;
      this.metrics.lastBackupTime = Date.now();
      
      this.backupTimes.push(backupTime);
      if (this.backupTimes.length > 100) {
        this.backupTimes.shift();
      }
      
      this.metrics.averageBackupTime = 
        this.backupTimes.reduce((sum, time) => sum + time, 0) / this.backupTimes.length;
    } else {
      this.metrics.failedBackups++;
    }
  }

  /**
   * Helper methods (simplified implementations)
   */
  private generateBackupId(className: string): string {
    return `backup_${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExportId(className: string, format: string): string {
    return `export_${className}_${format}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChecksum(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private formatExportData(data: any[], format: string, options: any): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      // Simple CSV conversion (production would use proper CSV library)
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => 
          JSON.stringify(row[header] || '').replace(/"/g, '""')
        );
        csvRows.push(values.join(','));
      }
      
      return csvRows.join('\n');
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  // Placeholder methods for storage operations
  private async storeBackupData(backupId: string, data: any[], options: any): Promise<void> {
    // Implementation would store to file system or cloud storage
  }

  private async loadBackupData(backupId: string): Promise<any[]> {
    // Implementation would load from storage
    return [];
  }

  private async storeExportData(exportId: string, data: string): Promise<void> {
    // Implementation would store export data
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // Implementation would fetch metadata from storage
    return null;
  }

  private async getAllBackupMetadata(): Promise<BackupMetadata[]> {
    // Implementation would fetch all metadata from storage
    return [];
  }

  private async validateBackupIntegrity(backupId: string, metadata: BackupMetadata): Promise<boolean> {
    // Implementation would validate backup integrity
    return true;
  }

  private async deleteBackup(backupId: string): Promise<void> {
    // Implementation would delete backup from storage
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.stopAutoBackup();
    
    // Wait for active backups to complete
    await Promise.all(this.activeBackups.values());
    
    this.activeBackups.clear();
    this.backupTimes = [];
    this.removeAllListeners();
  }
}