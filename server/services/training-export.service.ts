/**
 * Training Data Export Service for Nexis Platform
 * Exports high-quality Weaviate conversations for custom LLM training
 */

import { weaviateService } from './weaviate.service.js';
import * as fs from 'fs/promises';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const gzip = promisify(zlib.gzip);

export interface TrainingDataPoint {
  instruction: string;           // System prompt
  input: string;                // User message
  output: string;               // AI response
  biometric_context: {
    heartRate: number;
    hrv: number;
    cognitiveLoad: number;
    attentionLevel: number;
    stressLevel: number;
    flowState: number;
    arousal: number;
    valence: number;
  };
  effectiveness: number;        // 0-1 score
  neurodivergent_markers: {
    hyperfocus: boolean;
    contextSwitches: number;
    sensoryLoad: number;
    executiveFunction: number;
    workingMemoryLoad: number;
    attentionRegulation: number;
  };
  environmental_context: {
    timeOfDay: string;
    location: string;
    soundLevel: number;
    lightLevel: number;
    temperature: number;
  };
  conversation_metadata: {
    conversationId: string;
    timestamp: string;
    responseStrategy: string;
    difficultyLevel: number;
    isBreakthrough: boolean;
    learningGoals: string[];
    skillAreas: string[];
    knowledgeDomains: string[];
  };
}

export interface ExportJobConfig {
  minEffectiveness: number;
  maxRecords: number;
  cognitiveStateFilter?: string[];
  timeRangeStart?: string;
  timeRangeEnd?: string;
  includeBreakthroughsOnly?: boolean;
  groupByCognitiveState?: boolean;
  outputFormat: 'jsonl' | 'csv' | 'json';
  compressionEnabled: boolean;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: ExportJobConfig;
  progress: number;
  startTime: number;
  endTime?: number;
  recordsProcessed: number;
  recordsExported: number;
  outputFiles: string[];
  errors: string[];
  stats: {
    cognitiveStateDistribution: Record<string, number>;
    effectivenessDistribution: Record<string, number>;
    averageEffectiveness: number;
    breakthroughCount: number;
    totalDataSize: number;
  };
}

export class TrainingExportService {
  private jobs = new Map<string, ExportJob>();
  private exportHistory = new Set<string>(); // Track exported conversation IDs
  private exportDirectory = './exports/training-data';
  private maxConcurrentJobs = 2;
  private currentJobs = 0;

  constructor() {
    this.ensureExportDirectory();
    this.loadExportHistory();
  }

  /**
   * Export high-quality conversations for LLM training
   */
  async exportTrainingData(config: ExportJobConfig): Promise<string> {
    if (this.currentJobs >= this.maxConcurrentJobs) {
      throw new Error('Maximum concurrent export jobs reached. Please wait for existing jobs to complete.');
    }

    const jobId = uuidv4();
    const job: ExportJob = {
      id: jobId,
      status: 'pending',
      config,
      progress: 0,
      startTime: Date.now(),
      recordsProcessed: 0,
      recordsExported: 0,
      outputFiles: [],
      errors: [],
      stats: {
        cognitiveStateDistribution: {},
        effectivenessDistribution: {},
        averageEffectiveness: 0,
        breakthroughCount: 0,
        totalDataSize: 0
      }
    };

    this.jobs.set(jobId, job);
    this.currentJobs++;

    // Start export in background
    this.performExport(job).catch(error => {
      job.status = 'failed';
      job.errors.push(error.message);
      console.error(`Export job ${jobId} failed:`, error);
    }).finally(() => {
      this.currentJobs--;
    });

    return jobId;
  }

  /**
   * Perform the actual export process
   */
  private async performExport(job: ExportJob): Promise<void> {
    try {
      job.status = 'running';
      console.log(`Starting training data export job: ${job.id}`);

      // Step 1: Query high-quality conversations from Weaviate
      job.progress = 10;
      const conversations = await this.queryHighQualityConversations(job.config);
      console.log(`Found ${conversations.length} high-quality conversations`);

      // Step 2: Filter and transform data
      job.progress = 30;
      const trainingData = await this.transformConversationsToTrainingData(conversations, job);

      // Step 3: Group by cognitive state if requested
      job.progress = 50;
      const groupedData = job.config.groupByCognitiveState 
        ? this.groupByCognitiveState(trainingData)
        : { 'all_states': trainingData };

      // Step 4: Export to files
      job.progress = 70;
      const outputFiles = await this.writeTrainingFiles(groupedData, job);
      job.outputFiles = outputFiles;

      // Step 5: Generate statistics
      job.progress = 90;
      this.calculateExportStats(trainingData, job);

      // Step 6: Update export history
      job.progress = 100;
      this.updateExportHistory(conversations.map(c => c.conversationId));

      job.status = 'completed';
      job.endTime = Date.now();
      job.recordsExported = trainingData.length;

      console.log(`Export job ${job.id} completed successfully. Exported ${job.recordsExported} training examples.`);

    } catch (error) {
      job.status = 'failed';
      job.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Export job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Query high-quality conversations from Weaviate
   */
  private async queryHighQualityConversations(config: ExportJobConfig): Promise<any[]> {
    try {
      // Build query filters
      const whereFilters = [];
      
      // Effectiveness filter
      whereFilters.push({
        path: ['effectivenessScore'],
        operator: 'GreaterThan',
        valueNumber: config.minEffectiveness
      });

      // Time range filter
      if (config.timeRangeStart) {
        whereFilters.push({
          path: ['timestamp'],
          operator: 'GreaterThan',
          valueDate: config.timeRangeStart
        });
      }

      if (config.timeRangeEnd) {
        whereFilters.push({
          path: ['timestamp'],
          operator: 'LessThan',
          valueDate: config.timeRangeEnd
        });
      }

      // Breakthrough filter
      if (config.includeBreakthroughsOnly) {
        whereFilters.push({
          path: ['isBreakthrough'],
          operator: 'Equal',
          valueBoolean: true
        });
      }

      // Get Weaviate client and query
      const weaviateClient = await this.getWeaviateClient();
      
      const result = await weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          conversationId
          userMessage
          aiResponse
          effectivenessScore
          responseStrategy
          heartRate
          hrv
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          arousal
          valence
          hyperfocusState
          contextSwitches
          sensoryLoad
          executiveFunction
          workingMemoryLoad
          attentionRegulation
          timeOfDay
          location
          soundLevel
          lightLevel
          temperature
          timestamp
          difficultyLevel
          isBreakthrough
          learningGoals
          skillAreas
          knowledgeDomains
        `)
        .withWhere({
          operator: 'And',
          operands: whereFilters
        })
        .withSort([{ path: ['effectivenessScore'], order: 'desc' }])
        .withLimit(config.maxRecords)
        .do();

      return result?.data?.Get?.NexisConversation || [];

    } catch (error) {
      console.error('Failed to query conversations from Weaviate:', error);
      throw error;
    }
  }

  /**
   * Transform conversations to training data format
   */
  private async transformConversationsToTrainingData(
    conversations: any[],
    job: ExportJob
  ): Promise<TrainingDataPoint[]> {
    const trainingData: TrainingDataPoint[] = [];

    for (const conv of conversations) {
      try {
        // Skip if already exported
        if (this.exportHistory.has(conv.conversationId)) {
          continue;
        }

        const trainingPoint: TrainingDataPoint = {
          instruction: this.generateSystemInstruction(conv),
          input: conv.userMessage || '',
          output: conv.aiResponse || '',
          biometric_context: {
            heartRate: conv.heartRate || 75,
            hrv: conv.hrv || 45,
            cognitiveLoad: conv.cognitiveLoad || 0.5,
            attentionLevel: conv.attentionLevel || 0.6,
            stressLevel: conv.stressLevel || 0.5,
            flowState: conv.flowState || 0.4,
            arousal: conv.arousal || 0.5,
            valence: conv.valence || 0.0
          },
          effectiveness: conv.effectivenessScore || 0.7,
          neurodivergent_markers: {
            hyperfocus: conv.hyperfocusState || false,
            contextSwitches: conv.contextSwitches || 0,
            sensoryLoad: conv.sensoryLoad || 0.5,
            executiveFunction: conv.executiveFunction || 0.7,
            workingMemoryLoad: conv.workingMemoryLoad || 0.5,
            attentionRegulation: conv.attentionRegulation || 0.6
          },
          environmental_context: {
            timeOfDay: conv.timeOfDay || 'unknown',
            location: conv.location || 'unknown',
            soundLevel: conv.soundLevel || 50,
            lightLevel: conv.lightLevel || 300,
            temperature: conv.temperature || 22
          },
          conversation_metadata: {
            conversationId: conv.conversationId,
            timestamp: conv.timestamp,
            responseStrategy: conv.responseStrategy || 'adaptive',
            difficultyLevel: conv.difficultyLevel || 5,
            isBreakthrough: conv.isBreakthrough || false,
            learningGoals: conv.learningGoals || ['general'],
            skillAreas: conv.skillAreas || ['general'],
            knowledgeDomains: conv.knowledgeDomains || ['general']
          }
        };

        trainingData.push(trainingPoint);
        job.recordsProcessed++;

      } catch (error) {
        job.errors.push(`Failed to transform conversation ${conv.conversationId}: ${error}`);
      }
    }

    return trainingData;
  }

  /**
   * Generate system instruction based on conversation context
   */
  private generateSystemInstruction(conversation: any): string {
    const biometrics = {
      cognitiveLoad: conversation.cognitiveLoad || 0.5,
      stressLevel: conversation.stressLevel || 0.5,
      attentionLevel: conversation.attentionLevel || 0.6,
      flowState: conversation.flowState || 0.4
    };

    let instruction = "You are Nexis, a biometric-aware AI assistant with infinite memory and deep understanding of user patterns. ";

    // Add biometric-specific instructions
    if (biometrics.cognitiveLoad > 0.8) {
      instruction += "The user has high cognitive load - provide clear, step-by-step responses with simple language. ";
    } else if (biometrics.cognitiveLoad < 0.3) {
      instruction += "The user has low cognitive load - you can provide detailed, comprehensive information. ";
    }

    if (biometrics.stressLevel > 0.6) {
      instruction += "The user is experiencing stress - be supportive, calming, and focus on solutions. ";
    }

    if (biometrics.flowState > 0.7) {
      instruction += "The user is in flow state - maintain momentum with direct, focused responses. ";
    }

    if (biometrics.attentionLevel < 0.4) {
      instruction += "The user has low attention - use engaging examples and shorter response segments. ";
    }

    // Add strategy-specific instructions
    const strategy = conversation.responseStrategy || 'adaptive';
    switch (strategy) {
      case 'technical_detailed':
        instruction += "Provide technical depth with code examples and detailed explanations.";
        break;
      case 'creative_supportive':
        instruction += "Encourage creative exploration with open-ended suggestions.";
        break;
      case 'structured_logical':
        instruction += "Use clear frameworks and logical progression in your response.";
        break;
      default:
        instruction += "Adapt your response style to the user's current cognitive state and needs.";
    }

    return instruction;
  }

  /**
   * Group training data by cognitive state
   */
  private groupByCognitiveState(trainingData: TrainingDataPoint[]): Record<string, TrainingDataPoint[]> {
    const groups: Record<string, TrainingDataPoint[]> = {
      'high_flow_state': [],
      'high_stress': [],
      'high_cognitive_load': [],
      'low_attention': [],
      'hyperfocus': [],
      'balanced': []
    };

    for (const point of trainingData) {
      const biometrics = point.biometric_context;
      const neurodivergent = point.neurodivergent_markers;

      if (biometrics.flowState > 0.7) {
        groups.high_flow_state.push(point);
      } else if (biometrics.stressLevel > 0.6) {
        groups.high_stress.push(point);
      } else if (biometrics.cognitiveLoad > 0.8) {
        groups.high_cognitive_load.push(point);
      } else if (biometrics.attentionLevel < 0.4) {
        groups.low_attention.push(point);
      } else if (neurodivergent.hyperfocus) {
        groups.hyperfocus.push(point);
      } else {
        groups.balanced.push(point);
      }
    }

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, data]) => data.length > 0)
    );
  }

  /**
   * Write training files in specified format
   */
  private async writeTrainingFiles(
    groupedData: Record<string, TrainingDataPoint[]>,
    job: ExportJob
  ): Promise<string[]> {
    const outputFiles: string[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const [groupName, data] of Object.entries(groupedData)) {
      const filename = `nexis-training-${groupName}-${timestamp}`;
      const filepath = `${this.exportDirectory}/${filename}`;

      try {
        let content: string;
        let extension: string;

        switch (job.config.outputFormat) {
          case 'jsonl':
            content = data.map(point => JSON.stringify(point)).join('\n');
            extension = 'jsonl';
            break;
          case 'json':
            content = JSON.stringify(data, null, 2);
            extension = 'json';
            break;
          case 'csv':
            content = this.convertToCSV(data);
            extension = 'csv';
            break;
          default:
            throw new Error(`Unsupported output format: ${job.config.outputFormat}`);
        }

        let finalPath = `${filepath}.${extension}`;

        // Compress if enabled
        if (job.config.compressionEnabled) {
          const compressed = await gzip(Buffer.from(content, 'utf8'));
          await fs.writeFile(`${finalPath}.gz`, compressed);
          finalPath = `${finalPath}.gz`;
        } else {
          await fs.writeFile(finalPath, content, 'utf8');
        }

        outputFiles.push(finalPath);
        console.log(`Exported ${data.length} training examples to ${finalPath}`);

      } catch (error) {
        job.errors.push(`Failed to write file for group ${groupName}: ${error}`);
      }
    }

    return outputFiles;
  }

  /**
   * Convert training data to CSV format
   */
  private convertToCSV(data: TrainingDataPoint[]): string {
    const headers = [
      'instruction', 'input', 'output', 'effectiveness',
      'heartRate', 'cognitiveLoad', 'stressLevel', 'attentionLevel', 'flowState',
      'hyperfocus', 'sensoryLoad', 'executiveFunction',
      'timeOfDay', 'isBreakthrough', 'responseStrategy'
    ];

    const csvRows = [headers.join(',')];

    for (const point of data) {
      const row = [
        `"${point.instruction.replace(/"/g, '""')}"`,
        `"${point.input.replace(/"/g, '""')}"`,
        `"${point.output.replace(/"/g, '""')}"`,
        point.effectiveness,
        point.biometric_context.heartRate,
        point.biometric_context.cognitiveLoad,
        point.biometric_context.stressLevel,
        point.biometric_context.attentionLevel,
        point.biometric_context.flowState,
        point.neurodivergent_markers.hyperfocus,
        point.neurodivergent_markers.sensoryLoad,
        point.neurodivergent_markers.executiveFunction,
        point.environmental_context.timeOfDay,
        point.conversation_metadata.isBreakthrough,
        point.conversation_metadata.responseStrategy
      ];

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Calculate export statistics
   */
  private calculateExportStats(trainingData: TrainingDataPoint[], job: ExportJob): void {
    if (trainingData.length === 0) return;

    // Cognitive state distribution
    const cognitiveStates: Record<string, number> = {};
    const effectivenessRanges: Record<string, number> = {
      'high (0.8-1.0)': 0,
      'medium (0.6-0.8)': 0,
      'low (0.0-0.6)': 0
    };

    let totalEffectiveness = 0;
    let breakthroughCount = 0;
    let totalDataSize = 0;

    for (const point of trainingData) {
      // Determine cognitive state
      const biometrics = point.biometric_context;
      let state = 'balanced';
      
      if (biometrics.flowState > 0.7) state = 'high_flow';
      else if (biometrics.stressLevel > 0.6) state = 'high_stress';
      else if (biometrics.cognitiveLoad > 0.8) state = 'high_cognitive_load';
      else if (point.neurodivergent_markers.hyperfocus) state = 'hyperfocus';

      cognitiveStates[state] = (cognitiveStates[state] || 0) + 1;

      // Effectiveness distribution
      const effectiveness = point.effectiveness;
      if (effectiveness >= 0.8) effectivenessRanges['high (0.8-1.0)']++;
      else if (effectiveness >= 0.6) effectivenessRanges['medium (0.6-0.8)']++;
      else effectivenessRanges['low (0.0-0.6)']++;

      totalEffectiveness += effectiveness;
      
      if (point.conversation_metadata.isBreakthrough) {
        breakthroughCount++;
      }

      // Estimate data size
      totalDataSize += JSON.stringify(point).length;
    }

    job.stats = {
      cognitiveStateDistribution: cognitiveStates,
      effectivenessDistribution: effectivenessRanges,
      averageEffectiveness: totalEffectiveness / trainingData.length,
      breakthroughCount,
      totalDataSize
    };
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * List all jobs
   */
  getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clean up old jobs (keep last 50)
   */
  cleanupOldJobs(): void {
    const jobs = Array.from(this.jobs.entries())
      .sort(([,a], [,b]) => b.startTime - a.startTime);

    if (jobs.length > 50) {
      const toDelete = jobs.slice(50);
      toDelete.forEach(([jobId]) => this.jobs.delete(jobId));
    }
  }

  /**
   * Schedule daily export
   */
  scheduleDailyExport(config: ExportJobConfig): void {
    // This would integrate with a job scheduler
    console.log('Daily export scheduled with config:', config);
  }

  /**
   * Helper methods
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.exportDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create export directory:', error);
    }
  }

  private async loadExportHistory(): Promise<void> {
    try {
      const historyFile = `${this.exportDirectory}/export-history.json`;
      const data = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(data);
      this.exportHistory = new Set(history);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.exportHistory = new Set();
    }
  }

  private updateExportHistory(conversationIds: string[]): void {
    conversationIds.forEach(id => this.exportHistory.add(id));
    this.saveExportHistory();
  }

  private async saveExportHistory(): Promise<void> {
    try {
      const historyFile = `${this.exportDirectory}/export-history.json`;
      const history = Array.from(this.exportHistory);
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save export history:', error);
    }
  }

  private async getWeaviateClient(): Promise<any> {
    // Get client from weaviate service
    return (weaviateService as any).weaviateClient;
  }
}

export const trainingExportService = new TrainingExportService();