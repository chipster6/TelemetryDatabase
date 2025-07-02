/**
 * Rollback to PostgreSQL Migration Script
 * Safe rollback mechanism in case issues arise after Weaviate migration
 */

import { storage } from '../server/storage.js';
import { weaviateService } from '../server/services/weaviate.service.js';
import type { InsertPromptSession, InsertBiometricData, InsertCognitiveCorrelation } from '../shared/schema.js';

interface RollbackStats {
  sessionsExported: number;
  biometricRecordsExported: number;
  correlationsExported: number;
  totalProcessingTime: number;
  successRate: number;
  errors: string[];
}

interface DualWriteStats {
  discrepancies: number;
  lastChecked: Date;
  writeErrors: number;
  syncStatus: 'healthy' | 'degraded' | 'critical';
}

/**
 * Main rollback function - exports all Weaviate data back to PostgreSQL
 */
export async function rollbackToPostgreSQL(options: {
  dryRun?: boolean;
  batchSize?: number;
  preserveWeaviateData?: boolean;
} = {}): Promise<RollbackStats> {
  const startTime = Date.now();
  let sessionsExported = 0;
  let biometricRecordsExported = 0;
  let correlationsExported = 0;
  let errors: string[] = [];

  console.log('🔄 Starting Weaviate to PostgreSQL rollback...');

  try {
    // Initialize both services
    await weaviateService.initialize();
    console.log('✓ Weaviate service initialized for rollback');

    // Get all conversations from Weaviate
    const conversations = await weaviateService.searchConversations('', 10000); // Large limit
    console.log(`Found ${conversations.length} conversations in Weaviate`);

    if (options.dryRun) {
      console.log('🔍 DRY RUN - No data will be written to PostgreSQL');
    }

    // Process conversations in batches
    const batchSize = options.batchSize || 50;
    for (let i = 0; i < conversations.length; i += batchSize) {
      const batch = conversations.slice(i, i + batchSize);
      
      for (const conversation of batch) {
        try {
          // Convert conversation back to PostgreSQL format
          const sessionData = await convertConversationToSession(conversation);
          const biometricData = await convertConversationToBiometric(conversation);
          const correlationData = await convertConversationToCorrelation(conversation);

          if (!options.dryRun) {
            // Store in PostgreSQL
            if (sessionData) {
              await storage.createPromptSession(sessionData);
              sessionsExported++;
            }

            if (biometricData) {
              await storage.createBiometricData(biometricData);
              biometricRecordsExported++;
            }

            if (correlationData) {
              await storage.createCognitiveCorrelation(correlationData);
              correlationsExported++;
            }
          } else {
            // Just count for dry run
            if (sessionData) sessionsExported++;
            if (biometricData) biometricRecordsExported++;
            if (correlationData) correlationsExported++;
          }

        } catch (error) {
          const errorMsg = `Failed to convert conversation ${conversation.conversationId}: ${error}`;
          console.warn(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Progress logging
      console.log(`Processed ${Math.min(i + batchSize, conversations.length)}/${conversations.length} conversations`);
    }

    // Get memories and patterns
    const memories = await weaviateService.searchMemories('', undefined, 1000);
    const patterns = await weaviateService.learnBiometricPatterns();
    
    console.log(`Additional data found: ${memories.length} memories, ${patterns.length} patterns`);

    const totalTime = Date.now() - startTime;
    const totalRecords = sessionsExported + biometricRecordsExported + correlationsExported;
    const successRate = totalRecords > 0 ? ((totalRecords - errors.length) / totalRecords) * 100 : 100;

    const stats: RollbackStats = {
      sessionsExported,
      biometricRecordsExported,
      correlationsExported,
      totalProcessingTime: totalTime,
      successRate,
      errors
    };

    if (options.dryRun) {
      console.log(`✅ DRY RUN completed in ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`Would export: ${sessionsExported} sessions, ${biometricRecordsExported} biometric records, ${correlationsExported} correlations`);
    } else {
      console.log(`✅ Rollback completed in ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`Exported: ${sessionsExported} sessions, ${biometricRecordsExported} biometric records, ${correlationsExported} correlations`);
      console.log(`Success rate: ${successRate.toFixed(1)}%`);
      
      if (errors.length > 0) {
        console.log(`⚠️ ${errors.length} errors encountered during rollback`);
      }
    }

    return stats;

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

/**
 * Convert Weaviate conversation to PostgreSQL session format
 */
async function convertConversationToSession(conversation: any): Promise<InsertPromptSession | null> {
  try {
    const sessionData: InsertPromptSession = {
      userId: conversation.userId,
      systemPrompt: `Restored from Weaviate conversation ${conversation.conversationId}`,
      userInput: conversation.userMessage,
      temperature: 0.7,
      maxTokens: 1000
    };

    return sessionData;
  } catch (error) {
    console.warn('Failed to convert conversation to session:', error);
    return null;
  }
}

/**
 * Convert Weaviate conversation to PostgreSQL biometric format
 */
async function convertConversationToBiometric(conversation: any): Promise<InsertBiometricData | null> {
  try {
    if (!conversation.heartRate && !conversation.stressLevel) {
      return null; // No biometric data
    }

    const biometricData: InsertBiometricData = {
      sessionId: null, // Will be linked after session creation
      heartRate: conversation.heartRate,
      hrv: conversation.hrv,
      stressLevel: conversation.stressLevel,
      attentionLevel: conversation.attentionLevel,
      cognitiveLoad: conversation.cognitiveLoad,
      skinTemperature: null,
      respiratoryRate: null,
      oxygenSaturation: null,
      environmentalData: {
        soundLevel: conversation.soundLevel,
        lightLevel: conversation.lightLevel,
        temperature: conversation.temperature,
        timeOfDay: conversation.timeOfDay
      },
      deviceSource: 'weaviate_rollback'
    };

    return biometricData;
  } catch (error) {
    console.warn('Failed to convert conversation to biometric:', error);
    return null;
  }
}

/**
 * Convert Weaviate conversation to PostgreSQL cognitive correlation format
 */
async function convertConversationToCorrelation(conversation: any): Promise<InsertCognitiveCorrelation | null> {
  try {
    if (!conversation.effectivenessScore) {
      return null;
    }

    const correlationData: InsertCognitiveCorrelation = {
      sessionId: null, // Will be linked after session creation
      attentionScore: conversation.attentionLevel,
      stressScore: conversation.stressLevel,
      cognitiveLoadScore: conversation.cognitiveLoad,
      responseQualityScore: conversation.effectivenessScore,
      circadianAlignment: 0.5, // Default value
      promptComplexityScore: 0.5 // Default value
    };

    return correlationData;
  } catch (error) {
    console.warn('Failed to convert conversation to correlation:', error);
    return null;
  }
}

/**
 * Enable dual-write mode during transition
 */
export class DualWriteManager {
  private enabled = false;
  private stats: DualWriteStats = {
    discrepancies: 0,
    lastChecked: new Date(),
    writeErrors: 0,
    syncStatus: 'healthy'
  };

  /**
   * Enable dual-write mode
   */
  enable(): void {
    this.enabled = true;
    console.log('🔄 Dual-write mode enabled - writing to both Weaviate and PostgreSQL');
  }

  /**
   * Disable dual-write mode
   */
  disable(): void {
    this.enabled = false;
    console.log('✓ Dual-write mode disabled');
  }

  /**
   * Check if dual-write is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Write data to both systems and verify consistency
   */
  async dualWrite(data: any, type: 'session' | 'biometric' | 'correlation'): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    let success = true;

    try {
      // Write to PostgreSQL first (primary during transition)
      await this.writeToPostgreSQL(data, type);

      // Write to Weaviate second
      await this.writeToWeaviate(data, type);

    } catch (error) {
      console.error('Dual-write error:', error);
      this.stats.writeErrors++;
      this.stats.syncStatus = 'degraded';
      success = false;
    }

    return success;
  }

  /**
   * Verify data consistency between systems
   */
  async verifyConsistency(): Promise<DualWriteStats> {
    const checkStart = Date.now();
    
    try {
      // Sample recent data from both systems
      const pgSessions = await storage.getPromptSessions(undefined, 10);
      const weaviateConversations = await weaviateService.searchConversations('', 10);

      // Compare counts and detect discrepancies
      const discrepancies = Math.abs(pgSessions.length - weaviateConversations.length);
      
      this.stats = {
        discrepancies,
        lastChecked: new Date(),
        writeErrors: this.stats.writeErrors,
        syncStatus: discrepancies === 0 ? 'healthy' : discrepancies < 5 ? 'degraded' : 'critical'
      };

    } catch (error) {
      console.error('Consistency check failed:', error);
      this.stats.syncStatus = 'critical';
    }

    console.log(`Consistency check completed in ${Date.now() - checkStart}ms`);
    return this.stats;
  }

  /**
   * Get dual-write statistics
   */
  getStats(): DualWriteStats {
    return { ...this.stats };
  }

  private async writeToPostgreSQL(data: any, type: string): Promise<void> {
    switch (type) {
      case 'session':
        await storage.createPromptSession(data);
        break;
      case 'biometric':
        await storage.createBiometricData(data);
        break;
      case 'correlation':
        await storage.createCognitiveCorrelation(data);
        break;
    }
  }

  private async writeToWeaviate(data: any, type: string): Promise<void> {
    // Convert PostgreSQL format to Weaviate conversation format
    const conversationData = this.convertToWeaviateFormat(data, type);
    await weaviateService.storeConversation(conversationData);
  }

  private convertToWeaviateFormat(data: any, type: string): any {
    // Basic conversion logic - adapt based on data type
    return {
      conversationId: `dual_write_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      userMessage: data.userInput || data.input || 'Dual-write data',
      aiResponse: data.aiResponse || data.response || 'Dual-write response',
      conversationType: 'dual_write',
      effectivenessScore: data.satisfactionRating ? data.satisfactionRating / 5 : 0.5,
      responseStrategy: 'dual_write',
      biometricState: data.biometricContext || {},
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Trigger complete rollback via admin endpoint
 */
export async function triggerRollback(preserveWeaviate = true): Promise<RollbackStats> {
  console.log('🚨 EMERGENCY ROLLBACK TRIGGERED');
  
  // First run a dry run to estimate
  const dryRunStats = await rollbackToPostgreSQL({ 
    dryRun: true, 
    preserveWeaviateData: preserveWeaviate 
  });
  
  console.log('Dry run completed, proceeding with actual rollback...');
  
  // Execute the actual rollback
  const rollbackStats = await rollbackToPostgreSQL({ 
    dryRun: false, 
    preserveWeaviateData: preserveWeaviate 
  });
  
  console.log('✅ Emergency rollback completed');
  return rollbackStats;
}

export const dualWriteManager = new DualWriteManager();

// Auto-enable dual-write if environment variable is set
if (process.env.ENABLE_DUAL_WRITE === 'true') {
  dualWriteManager.enable();
}