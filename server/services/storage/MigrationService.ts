import { EventEmitter } from 'events';
import { vectorDatabase } from '../vector-database.js';

export interface MigrationScript {
  id: string;
  version: string;
  description: string;
  targetClass?: string;
  type: 'schema' | 'data' | 'index' | 'configuration';
  dependencies: string[];
  reversible: boolean;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
  validate?: () => Promise<boolean>;
}

export interface MigrationRecord {
  id: string;
  version: string;
  description: string;
  type: string;
  executedAt: number;
  executionTime: number;
  success: boolean;
  error?: string;
  rollbackAvailable: boolean;
}

export interface MigrationConfig {
  enableAutoMigration: boolean;
  validateBeforeExecution: boolean;
  createBackupBeforeMigration: boolean;
  maxConcurrentMigrations: number;
  migrationTimeout: number; // milliseconds
  rollbackOnFailure: boolean;
}

export interface MigrationMetrics {
  totalMigrations: number;
  successfulMigrations: number;
  failedMigrations: number;
  rollbacksPerformed: number;
  averageExecutionTime: number;
  lastMigrationTime?: number;
}

export interface SchemaChange {
  operation: 'add' | 'remove' | 'modify';
  target: 'class' | 'property' | 'index';
  className?: string;
  propertyName?: string;
  details: any;
}

/**
 * Database migration and schema evolution service
 * Handles version control, schema changes, data transformations, and rollbacks
 */
export class MigrationService extends EventEmitter {
  private weaviateClient: any;
  private config: MigrationConfig;
  private metrics: MigrationMetrics;
  private migrationHistory: Map<string, MigrationRecord> = new Map();
  private pendingMigrations: Map<string, MigrationScript> = new Map();
  private activeMigrations: Set<string> = new Set();
  private executionTimes: number[] = [];

  constructor(config: Partial<MigrationConfig> = {}) {
    super();
    
    this.weaviateClient = vectorDatabase.getClient();
    
    this.config = {
      enableAutoMigration: false,
      validateBeforeExecution: true,
      createBackupBeforeMigration: true,
      maxConcurrentMigrations: 1,
      migrationTimeout: 30 * 60 * 1000, // 30 minutes
      rollbackOnFailure: true,
      ...config
    };

    this.metrics = {
      totalMigrations: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      rollbacksPerformed: 0,
      averageExecutionTime: 0
    };

    this.initializeSystemMigrations();
  }

  /**
   * Register a new migration script
   */
  registerMigration(migration: MigrationScript): void {
    this.validateMigrationScript(migration);
    
    if (this.pendingMigrations.has(migration.id)) {
      throw new Error(`Migration already registered: ${migration.id}`);
    }

    if (this.migrationHistory.has(migration.id)) {
      throw new Error(`Migration already executed: ${migration.id}`);
    }

    this.pendingMigrations.set(migration.id, migration);
    
    this.emit('migrationRegistered', {
      migrationId: migration.id,
      version: migration.version,
      type: migration.type,
      timestamp: Date.now()
    });
  }

  /**
   * Execute a specific migration
   */
  async executeMigration(migrationId: string): Promise<MigrationRecord> {
    const startTime = Date.now();
    
    try {
      const migration = this.pendingMigrations.get(migrationId);
      if (!migration) {
        throw new Error(`Migration not found: ${migrationId}`);
      }

      if (this.activeMigrations.has(migrationId)) {
        throw new Error(`Migration already in progress: ${migrationId}`);
      }

      if (this.activeMigrations.size >= this.config.maxConcurrentMigrations) {
        throw new Error('Maximum concurrent migrations limit reached');
      }

      this.activeMigrations.add(migrationId);

      // Check dependencies
      await this.validateDependencies(migration);

      // Validate migration if configured
      if (this.config.validateBeforeExecution && migration.validate) {
        const isValid = await migration.validate();
        if (!isValid) {
          throw new Error('Migration validation failed');
        }
      }

      // Create backup if configured
      let backupId: string | undefined;
      if (this.config.createBackupBeforeMigration && migration.targetClass) {
        backupId = await this.createMigrationBackup(migration.targetClass);
      }

      // Execute migration with timeout
      const executionPromise = migration.execute();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Migration timeout')), this.config.migrationTimeout);
      });

      await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;
      const record = this.createMigrationRecord(migration, true, executionTime);

      this.migrationHistory.set(migrationId, record);
      this.pendingMigrations.delete(migrationId);
      this.updateMigrationMetrics(true, executionTime);

      this.emit('migrationCompleted', {
        migrationId,
        record,
        backupId,
        timestamp: Date.now()
      });

      return record;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const record = this.createMigrationRecord(
        this.pendingMigrations.get(migrationId)!,
        false,
        executionTime,
        error.message
      );

      this.migrationHistory.set(migrationId, record);
      this.updateMigrationMetrics(false, executionTime);

      // Rollback if configured and possible
      if (this.config.rollbackOnFailure) {
        try {
          await this.rollbackMigration(migrationId);
        } catch (rollbackError) {
          console.error(`Rollback failed for migration ${migrationId}:`, rollbackError);
        }
      }

      this.emit('migrationFailed', {
        migrationId,
        error,
        record,
        timestamp: Date.now()
      });

      throw error;
    } finally {
      this.activeMigrations.delete(migrationId);
    }
  }

  /**
   * Execute all pending migrations
   */
  async executeAllMigrations(): Promise<{
    executed: MigrationRecord[];
    failed: MigrationRecord[];
    skipped: string[];
  }> {
    const result = {
      executed: [] as MigrationRecord[],
      failed: [] as MigrationRecord[],
      skipped: [] as string[]
    };

    try {
      // Sort migrations by dependencies and version
      const sortedMigrations = this.sortMigrationsByDependencies();

      for (const migration of sortedMigrations) {
        try {
          const record = await this.executeMigration(migration.id);
          result.executed.push(record);
        } catch (error) {
          const record = this.migrationHistory.get(migration.id);
          if (record) {
            result.failed.push(record);
          }
          
          // Stop executing further migrations if one fails
          if (this.config.rollbackOnFailure) {
            break;
          }
        }
      }

      this.emit('batchMigrationCompleted', {
        result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.emit('batchMigrationFailed', { error, result });
      throw error;
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const record = this.migrationHistory.get(migrationId);
      if (!record) {
        throw new Error(`Migration record not found: ${migrationId}`);
      }

      if (!record.rollbackAvailable) {
        throw new Error(`Migration is not reversible: ${migrationId}`);
      }

      // Find the original migration script for rollback
      const migration = this.findMigrationScript(migrationId);
      if (!migration || !migration.rollback) {
        throw new Error(`Rollback function not available for migration: ${migrationId}`);
      }

      this.emit('rollbackStarted', {
        migrationId,
        timestamp: Date.now()
      });

      await migration.rollback();

      // Update record to reflect rollback
      record.rollbackAvailable = false;
      this.metrics.rollbacksPerformed++;

      const rollbackTime = Date.now() - startTime;

      this.emit('rollbackCompleted', {
        migrationId,
        rollbackTime,
        timestamp: Date.now()
      });

    } catch (error) {
      this.emit('rollbackFailed', { error, migrationId });
      throw new Error(`Rollback failed for migration ${migrationId}: ${error.message}`);
    }
  }

  /**
   * Create a new schema class
   */
  async createSchemaClass(className: string, schema: any): Promise<void> {
    try {
      const migration: MigrationScript = {
        id: `create_class_${className}_${Date.now()}`,
        version: '1.0.0',
        description: `Create schema class: ${className}`,
        targetClass: className,
        type: 'schema',
        dependencies: [],
        reversible: true,
        execute: async () => {
          const exists = await this.weaviateClient.schema.exists(className);
          if (!exists) {
            await this.weaviateClient.schema.classCreator().withClass(schema).do();
          }
        },
        rollback: async () => {
          await this.weaviateClient.schema.classDeleter().withClassName(className).do();
        },
        validate: async () => {
          const exists = await this.weaviateClient.schema.exists(className);
          return !exists; // Valid if class doesn't exist yet
        }
      };

      this.registerMigration(migration);
      
      if (this.config.enableAutoMigration) {
        await this.executeMigration(migration.id);
      }

    } catch (error) {
      this.emit('schemaCreationError', { error, className });
      throw error;
    }
  }

  /**
   * Add property to existing schema class
   */
  async addSchemaProperty(
    className: string, 
    propertyName: string, 
    propertyConfig: any
  ): Promise<void> {
    try {
      const migration: MigrationScript = {
        id: `add_property_${className}_${propertyName}_${Date.now()}`,
        version: '1.0.0',
        description: `Add property ${propertyName} to ${className}`,
        targetClass: className,
        type: 'schema',
        dependencies: [],
        reversible: false, // Property removal is complex
        execute: async () => {
          await this.weaviateClient.schema
            .propertyCreator()
            .withClassName(className)
            .withProperty(propertyConfig)
            .do();
        },
        validate: async () => {
          const schema = await this.weaviateClient.schema.getter().do();
          const classSchema = schema.classes?.find((c: any) => c.class === className);
          return !classSchema?.properties?.find((p: any) => p.name === propertyName);
        }
      };

      this.registerMigration(migration);
      
      if (this.config.enableAutoMigration) {
        await this.executeMigration(migration.id);
      }

    } catch (error) {
      this.emit('propertyAdditionError', { error, className, propertyName });
      throw error;
    }
  }

  /**
   * Migrate data between schema versions
   */
  async migrateData(
    sourceClass: string,
    targetClass: string,
    transformFunction: (data: any) => any
  ): Promise<void> {
    const migration: MigrationScript = {
      id: `migrate_data_${sourceClass}_to_${targetClass}_${Date.now()}`,
      version: '1.0.0',
      description: `Migrate data from ${sourceClass} to ${targetClass}`,
      targetClass: sourceClass,
      type: 'data',
      dependencies: [],
      reversible: false,
      execute: async () => {
        const batchSize = 1000;
        let offset = 0;

        while (true) {
          // Get batch of source data
          const results = await this.weaviateClient.graphql
            .get()
            .withClassName(sourceClass)
            .withFields('*')
            .withLimit(batchSize)
            .withOffset(offset)
            .do();

          const data = results?.data?.Get?.[sourceClass] || [];
          if (data.length === 0) break;

          // Transform and insert into target class
          for (const record of data) {
            const transformedData = transformFunction(record);
            await this.weaviateClient.data
              .creator()
              .withClassName(targetClass)
              .withProperties(transformedData)
              .do();
          }

          offset += batchSize;
        }
      }
    };

    this.registerMigration(migration);
    
    if (this.config.enableAutoMigration) {
      await this.executeMigration(migration.id);
    }
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): MigrationRecord[] {
    return Array.from(this.migrationHistory.values())
      .sort((a, b) => a.executedAt - b.executedAt);
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): MigrationScript[] {
    return Array.from(this.pendingMigrations.values());
  }

  /**
   * Get migration metrics
   */
  getMetrics(): MigrationMetrics {
    return { ...this.metrics };
  }

  /**
   * Update migration configuration
   */
  updateConfig(newConfig: Partial<MigrationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    this.emit('configUpdated', {
      oldConfig,
      newConfig: this.config,
      timestamp: Date.now()
    });
  }

  // ==================== Private Methods ====================

  /**
   * Initialize system migrations for primary storage setup
   */
  private initializeSystemMigrations(): void {
    // Create primary Weaviate schemas migration
    const createPrimarySchemaMigration: MigrationScript = {
      id: 'create_primary_schemas_v1',
      version: '1.0.0',
      description: 'Create primary Weaviate schemas for Nexis system',
      type: 'schema',
      dependencies: [],
      reversible: true,
      execute: async () => {
        await this.createPrimarySchemas();
      },
      rollback: async () => {
        await this.dropPrimarySchemas();
      },
      validate: async () => {
        const conversationExists = await this.weaviateClient.schema.exists('NexisConversation');
        return !conversationExists;
      }
    };

    this.registerMigration(createPrimarySchemaMigration);
  }

  /**
   * Create primary Weaviate schemas
   */
  private async createPrimarySchemas(): Promise<void> {
    const schemas = [
      {
        class: "NexisConversation",
        description: "Primary conversation storage with full context",
        vectorizer: "text2vec-transformers",
        moduleConfig: {
          "text2vec-transformers": {
            poolingStrategy: "masked_mean"
          }
        },
        properties: [
          { name: "userId", dataType: ["int"], description: "User identifier" },
          { name: "timestamp", dataType: ["date"], description: "Conversation timestamp" },
          { name: "conversationType", dataType: ["string"], description: "Type of conversation" },
          { name: "userInput", dataType: ["text"], description: "User's input" },
          { name: "aiResponse", dataType: ["text"], description: "AI's response" },
          { name: "conversationContext", dataType: ["text"], description: "Full conversation history" },
          { name: "effectiveness", dataType: ["number"], description: "Response effectiveness (0-1)" },
          { name: "responseStrategy", dataType: ["string"], description: "Strategy used for response" },
          
          // Biometric state
          { name: "heartRate", dataType: ["number"], description: "Heart rate during conversation" },
          { name: "hrv", dataType: ["number"], description: "Heart rate variability" },
          { name: "stressLevel", dataType: ["number"], description: "Stress level (0-1)" },
          { name: "attentionLevel", dataType: ["number"], description: "Attention level (0-1)" },
          { name: "cognitiveLoad", dataType: ["number"], description: "Cognitive load (0-1)" },
          { name: "flowState", dataType: ["number"], description: "Flow state indicator (0-1)" },
          { name: "biometricTimestamp", dataType: ["date"], description: "When biometrics were captured" },
          
          // Environmental context
          { name: "timeOfDay", dataType: ["string"], description: "Time of day category" },
          { name: "location", dataType: ["string"], description: "Location context" },
          { name: "soundLevel", dataType: ["number"], description: "Environmental sound level" },
          { name: "lightLevel", dataType: ["number"], description: "Environmental light level" },
          { name: "temperature", dataType: ["number"], description: "Environmental temperature" },
          
          // Learning markers
          { name: "isBreakthrough", dataType: ["boolean"], description: "Was this a breakthrough moment" },
          { name: "difficultyLevel", dataType: ["number"], description: "Conversation difficulty (1-10)" },
          { name: "userSatisfaction", dataType: ["number"], description: "User satisfaction (0-1)" },
          { name: "cognitiveBreakthrough", dataType: ["boolean"], description: "Cognitive breakthrough achieved" }
        ]
      },
      {
        class: "NexisBiometricPattern",
        description: "Learned biometric patterns for optimal responses",
        vectorizer: "text2vec-transformers",
        properties: [
          { name: "patternName", dataType: ["string"], description: "Pattern identifier" },
          { name: "heartRateMin", dataType: ["number"], description: "Minimum heart rate" },
          { name: "heartRateMax", dataType: ["number"], description: "Maximum heart rate" },
          { name: "stressMin", dataType: ["number"], description: "Minimum stress level" },
          { name: "stressMax", dataType: ["number"], description: "Maximum stress level" },
          { name: "attentionMin", dataType: ["number"], description: "Minimum attention level" },
          { name: "attentionMax", dataType: ["number"], description: "Maximum attention level" },
          { name: "cognitiveLoadMin", dataType: ["number"], description: "Minimum cognitive load" },
          { name: "cognitiveLoadMax", dataType: ["number"], description: "Maximum cognitive load" },
          { name: "flowStateMin", dataType: ["number"], description: "Minimum flow state" },
          { name: "flowStateMax", dataType: ["number"], description: "Maximum flow state" },
          { name: "optimalStrategies", dataType: ["string[]"], description: "Best response strategies" },
          { name: "triggerConditions", dataType: ["string[]"], description: "Pattern triggers" },
          { name: "successRate", dataType: ["number"], description: "Success rate (0-1)" },
          { name: "learnedFrom", dataType: ["int"], description: "Number of learning samples" },
          { name: "lastUpdated", dataType: ["date"], description: "Last pattern update" }
        ]
      },
      {
        class: "NexisMemoryNode",
        description: "Long-term memory storage for personalized AI",
        vectorizer: "text2vec-transformers",
        properties: [
          { name: "userId", dataType: ["int"], description: "User identifier" },
          { name: "content", dataType: ["text"], description: "Memory content" },
          { name: "memoryType", dataType: ["string"], description: "Type of memory" },
          { name: "importance", dataType: ["number"], description: "Memory importance (0-1)" },
          { name: "lastAccessed", dataType: ["date"], description: "Last access time" },
          { name: "accessCount", dataType: ["int"], description: "Access frequency" },
          { name: "emotionalValence", dataType: ["number"], description: "Emotional association (-1 to 1)" },
          { name: "relatedTopics", dataType: ["string[]"], description: "Related topics/tags" },
          { name: "biometricContextHR", dataType: ["number"], description: "Heart rate when memory formed" },
          { name: "biometricContextStress", dataType: ["number"], description: "Stress when memory formed" },
          { name: "retrievalStrength", dataType: ["number"], description: "How easily retrieved (0-1)" }
        ]
      },
      {
        class: "NexisKnowledgeGraph",
        description: "Interconnected knowledge for context building",
        vectorizer: "text2vec-transformers",
        properties: [
          { name: "userId", dataType: ["int"], description: "User identifier" },
          { name: "concept", dataType: ["text"], description: "Core concept" },
          { name: "definition", dataType: ["text"], description: "Concept definition" },
          { name: "examples", dataType: ["string[]"], description: "Practical examples" },
          { name: "connections", dataType: ["string[]"], description: "Connected concepts" },
          { name: "masteryLevel", dataType: ["number"], description: "User's mastery (0-1)" },
          { name: "learningPath", dataType: ["string[]"], description: "Recommended learning sequence" },
          { name: "lastReinforced", dataType: ["date"], description: "Last reinforcement" }
        ]
      }
    ];

    for (const schema of schemas) {
      const exists = await this.weaviateClient.schema.exists(schema.class);
      if (!exists) {
        await this.weaviateClient.schema.classCreator().withClass(schema).do();
      }
    }
  }

  /**
   * Drop primary schemas (for rollback)
   */
  private async dropPrimarySchemas(): Promise<void> {
    const classes = ['NexisConversation', 'NexisBiometricPattern', 'NexisMemoryNode', 'NexisKnowledgeGraph'];
    
    for (const className of classes) {
      try {
        await this.weaviateClient.schema.classDeleter().withClassName(className).do();
      } catch (error) {
        // Continue with other classes if one fails
        console.warn(`Failed to drop class ${className}:`, error);
      }
    }
  }

  /**
   * Validate migration script
   */
  private validateMigrationScript(migration: MigrationScript): void {
    if (!migration.id || !migration.version || !migration.description) {
      throw new Error('Migration must have id, version, and description');
    }

    if (!migration.execute || typeof migration.execute !== 'function') {
      throw new Error('Migration must have an execute function');
    }

    if (migration.reversible && (!migration.rollback || typeof migration.rollback !== 'function')) {
      throw new Error('Reversible migration must have a rollback function');
    }

    if (!['schema', 'data', 'index', 'configuration'].includes(migration.type)) {
      throw new Error('Invalid migration type');
    }
  }

  /**
   * Validate migration dependencies
   */
  private async validateDependencies(migration: MigrationScript): Promise<void> {
    for (const depId of migration.dependencies) {
      if (!this.migrationHistory.has(depId)) {
        throw new Error(`Migration dependency not met: ${depId}`);
      }

      const depRecord = this.migrationHistory.get(depId)!;
      if (!depRecord.success) {
        throw new Error(`Migration dependency failed: ${depId}`);
      }
    }
  }

  /**
   * Sort migrations by dependencies and version
   */
  private sortMigrationsByDependencies(): MigrationScript[] {
    const migrations = Array.from(this.pendingMigrations.values());
    const sorted: MigrationScript[] = [];
    const processed = new Set<string>();

    const processDepdendencies = (migration: MigrationScript) => {
      if (processed.has(migration.id)) return;

      // Process dependencies first
      for (const depId of migration.dependencies) {
        const dep = migrations.find(m => m.id === depId);
        if (dep && !processed.has(depId)) {
          processDepdendencies(dep);
        }
      }

      sorted.push(migration);
      processed.add(migration.id);
    };

    for (const migration of migrations) {
      processDepdendencies(migration);
    }

    return sorted;
  }

  /**
   * Create migration record
   */
  private createMigrationRecord(
    migration: MigrationScript,
    success: boolean,
    executionTime: number,
    error?: string
  ): MigrationRecord {
    return {
      id: migration.id,
      version: migration.version,
      description: migration.description,
      type: migration.type,
      executedAt: Date.now(),
      executionTime,
      success,
      error,
      rollbackAvailable: migration.reversible && success
    };
  }

  /**
   * Update migration metrics
   */
  private updateMigrationMetrics(success: boolean, executionTime: number): void {
    this.metrics.totalMigrations++;
    
    if (success) {
      this.metrics.successfulMigrations++;
      this.metrics.lastMigrationTime = Date.now();
    } else {
      this.metrics.failedMigrations++;
    }

    this.executionTimes.push(executionTime);
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }

    this.metrics.averageExecutionTime = 
      this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length;
  }

  /**
   * Find migration script by ID
   */
  private findMigrationScript(migrationId: string): MigrationScript | null {
    return this.pendingMigrations.get(migrationId) || null;
  }

  /**
   * Create backup before migration
   */
  private async createMigrationBackup(className: string): Promise<string> {
    // This would integrate with the BackupService
    // For now, return a mock backup ID
    return `migration_backup_${className}_${Date.now()}`;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    // Wait for active migrations to complete
    while (this.activeMigrations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.executionTimes = [];
    this.removeAllListeners();
  }
}