/**
 * LLM Training Data Export Service (Prompt 8)
 * Exports Weaviate conversation data in formats suitable for custom LLM training
 */

import fs from 'fs/promises';
import path from 'path';
import { weaviateService } from './weaviate.service.js';

interface TrainingDataPoint {
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
    dayOfWeek: string;
    location: string;
    soundLevel: number;
    lightLevel: number;
    temperature: number;
  };
  learning_markers: {
    isBreakthrough: boolean;
    cognitiveBreakthrough: boolean;
    difficultyLevel: number;
    userSatisfaction: number;
    adaptationNeeded: boolean;
  };
  conversation_id: string;
  timestamp: string;
  user_id: number;
}

interface ExportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  totalRecords: number;
  processedRecords: number;
  outputFiles: string[];
  filters: ExportFilters;
  error?: string;
}

interface ExportFilters {
  minEffectiveness: number;
  cognitiveStates: string[];
  dateRange: { start: Date; end: Date };
  includeBreakthroughs: boolean;
  userId?: number;
}

class TrainingExportService {
  private exportJobs = new Map<string, ExportJob>();
  private exportedConversations = new Set<string>();
  private outputDir = './exports/training-data';

  constructor() {
    this.initializeExportDirectory();
    this.loadExportHistory();
  }

  private async initializeExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'cognitive-states'), { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'compressed'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize export directory:', error);
    }
  }

  private async loadExportHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.outputDir, 'export-history.json');
      const data = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(data);
      this.exportedConversations = new Set(history.exportedConversations || []);
    } catch (error) {
      // File doesn't exist yet, start fresh
      console.log('Starting fresh export history');
    }
  }

  private async saveExportHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.outputDir, 'export-history.json');
      const history = {
        exportedConversations: Array.from(this.exportedConversations),
        lastExport: new Date().toISOString()
      };
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save export history:', error);
    }
  }

  /**
   * Start a new training data export job
   */
  async startExport(filters: ExportFilters): Promise<string> {
    const jobId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ExportJob = {
      id: jobId,
      status: 'pending',
      startTime: new Date(),
      totalRecords: 0,
      processedRecords: 0,
      outputFiles: [],
      filters,
    };

    this.exportJobs.set(jobId, job);
    
    // Start export in background
    this.processExport(jobId).catch(error => {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
    });

    return jobId;
  }

  /**
   * Get export job status
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.exportJobs.get(jobId) || null;
  }

  /**
   * Process export job
   */
  private async processExport(jobId: string): Promise<void> {
    const job = this.exportJobs.get(jobId);
    if (!job) throw new Error('Job not found');

    job.status = 'running';
    console.log(`Starting export job ${jobId} with filters:`, job.filters);

    try {
      // Fetch conversations from Weaviate
      const conversations = await this.fetchTrainingConversations(job.filters);
      job.totalRecords = conversations.length;

      // Group by cognitive states
      const groupedData = this.groupByCognitiveStates(conversations);

      // Export each group
      for (const [stateName, stateConversations] of Object.entries(groupedData)) {
        const filename = await this.exportCognitiveStateData(
          stateName,
          stateConversations,
          jobId
        );
        job.outputFiles.push(filename);
      }

      // Create comprehensive export
      const mainFilename = await this.exportMainTrainingData(conversations, jobId);
      job.outputFiles.push(mainFilename);

      // Compress exports
      const compressedFile = await this.compressExports(job.outputFiles, jobId);
      job.outputFiles.push(compressedFile);

      // Update export history
      conversations.forEach(conv => {
        this.exportedConversations.add(conv.conversation_id);
      });
      await this.saveExportHistory();

      job.status = 'completed';
      job.endTime = new Date();
      job.processedRecords = conversations.length;

      console.log(`Export job ${jobId} completed: ${conversations.length} conversations exported`);

    } catch (error) {
      console.error(`Export job ${jobId} failed:`, error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();
    }
  }

  /**
   * Fetch high-quality conversations for training
   */
  private async fetchTrainingConversations(filters: ExportFilters): Promise<TrainingDataPoint[]> {
    const conversations = await weaviateService.searchConversations('', 10000); // Large limit
    
    return conversations
      .filter(conv => {
        // Filter by effectiveness
        if (conv.effectivenessScore < filters.minEffectiveness) return false;
        
        // Filter by date range
        const convDate = new Date(conv.timestamp);
        if (convDate < filters.dateRange.start || convDate > filters.dateRange.end) return false;
        
        // Filter by user if specified
        if (filters.userId && conv.userId !== filters.userId) return false;
        
        // Filter by cognitive states
        if (filters.cognitiveStates.length > 0) {
          const hasMatchingState = filters.cognitiveStates.some(state => 
            conv.conversationType.includes(state) || 
            conv.responseStrategy.includes(state)
          );
          if (!hasMatchingState) return false;
        }
        
        // Filter breakthroughs only if specified
        if (filters.includeBreakthroughs && !conv.learningMarkers?.isBreakthrough) return false;
        
        // Skip already exported conversations
        if (this.exportedConversations.has(conv.conversationId)) return false;
        
        return true;
      })
      .map(conv => this.convertToTrainingFormat(conv));
  }

  /**
   * Convert Weaviate conversation to training format
   */
  private convertToTrainingFormat(conversation: any): TrainingDataPoint {
    return {
      instruction: `You are Nexis, an AI assistant specialized in biometric-aware responses. The user's current biometric state shows: HR ${conversation.biometricState?.heartRate || 70}bpm, stress level ${(conversation.biometricState?.stressLevel || 0.5) * 100}%, cognitive load ${(conversation.biometricState?.cognitiveLoad || 0.5) * 100}%. Respond appropriately to their cognitive state.`,
      input: conversation.userMessage,
      output: conversation.aiResponse,
      biometric_context: {
        heartRate: conversation.biometricState?.heartRate || 70,
        hrv: conversation.biometricState?.hrv || 40,
        cognitiveLoad: conversation.biometricState?.cognitiveLoad || 0.5,
        attentionLevel: conversation.biometricState?.attentionLevel || 0.6,
        stressLevel: conversation.biometricState?.stressLevel || 0.5,
        flowState: conversation.biometricState?.flowState || 0.5
      },
      effectiveness: conversation.effectivenessScore,
      neurodivergent_markers: {
        hyperfocus: conversation.neurodivergentMarkers?.hyperfocusState || false,
        contextSwitches: conversation.neurodivergentMarkers?.contextSwitches || 0,
        sensoryLoad: conversation.neurodivergentMarkers?.sensoryLoad || 0.5,
        executiveFunction: conversation.neurodivergentMarkers?.executiveFunction || 0.7,
        workingMemoryLoad: conversation.neurodivergentMarkers?.workingMemoryLoad || 0.5,
        attentionRegulation: conversation.neurodivergentMarkers?.attentionRegulation || 0.6
      },
      environmental_context: {
        timeOfDay: conversation.environmentalContext?.timeOfDay || 'unknown',
        dayOfWeek: conversation.environmentalContext?.dayOfWeek || 'unknown',
        location: conversation.environmentalContext?.location || 'unknown',
        soundLevel: conversation.environmentalContext?.soundLevel || 50,
        lightLevel: conversation.environmentalContext?.lightLevel || 300,
        temperature: conversation.environmentalContext?.temperature || 22
      },
      learning_markers: {
        isBreakthrough: conversation.learningMarkers?.isBreakthrough || false,
        cognitiveBreakthrough: conversation.learningMarkers?.cognitiveBreakthrough || false,
        difficultyLevel: conversation.learningMarkers?.difficultyLevel || 1,
        userSatisfaction: conversation.learningMarkers?.userSatisfaction || 0.8,
        adaptationNeeded: conversation.learningMarkers?.adaptationNeeded || false
      },
      conversation_id: conversation.conversationId,
      timestamp: conversation.timestamp,
      user_id: conversation.userId
    };
  }

  /**
   * Group conversations by cognitive states
   */
  private groupByCognitiveStates(conversations: TrainingDataPoint[]): Record<string, TrainingDataPoint[]> {
    const groups: Record<string, TrainingDataPoint[]> = {
      'high-focus': [],
      'low-stress': [],
      'medium-stress': [],
      'high-stress': [],
      'flow-state': [],
      'breakthrough': [],
      'hyperfocus': [],
      'low-cognitive-load': [],
      'high-cognitive-load': []
    };

    conversations.forEach(conv => {
      // Categorize by stress level
      if (conv.biometric_context.stressLevel < 0.3) {
        groups['low-stress'].push(conv);
      } else if (conv.biometric_context.stressLevel < 0.7) {
        groups['medium-stress'].push(conv);
      } else {
        groups['high-stress'].push(conv);
      }

      // Categorize by attention and flow
      if (conv.biometric_context.attentionLevel > 0.8) {
        groups['high-focus'].push(conv);
      }
      
      if (conv.biometric_context.flowState > 0.7) {
        groups['flow-state'].push(conv);
      }

      // Categorize by cognitive load
      if (conv.biometric_context.cognitiveLoad < 0.3) {
        groups['low-cognitive-load'].push(conv);
      } else if (conv.biometric_context.cognitiveLoad > 0.7) {
        groups['high-cognitive-load'].push(conv);
      }

      // Special categories
      if (conv.learning_markers.isBreakthrough) {
        groups['breakthrough'].push(conv);
      }
      
      if (conv.neurodivergent_markers.hyperfocus) {
        groups['hyperfocus'].push(conv);
      }
    });

    return groups;
  }

  /**
   * Export cognitive state specific data
   */
  private async exportCognitiveStateData(
    stateName: string,
    conversations: TrainingDataPoint[],
    jobId: string
  ): Promise<string> {
    const filename = `${stateName}-training-data-${jobId}.jsonl`;
    const filepath = path.join(this.outputDir, 'cognitive-states', filename);
    
    const jsonlData = conversations
      .map(conv => JSON.stringify(conv))
      .join('\n');
    
    await fs.writeFile(filepath, jsonlData);
    console.log(`Exported ${conversations.length} conversations for ${stateName} to ${filename}`);
    
    return filename;
  }

  /**
   * Export main training data file
   */
  private async exportMainTrainingData(
    conversations: TrainingDataPoint[],
    jobId: string
  ): Promise<string> {
    const filename = `nexis-training-data-${jobId}.jsonl`;
    const filepath = path.join(this.outputDir, filename);
    
    const jsonlData = conversations
      .map(conv => JSON.stringify(conv))
      .join('\n');
    
    await fs.writeFile(filepath, jsonlData);
    
    // Also create CSV version for analysis
    const csvFilename = `nexis-training-data-${jobId}.csv`;
    const csvFilepath = path.join(this.outputDir, csvFilename);
    const csvData = this.convertToCSV(conversations);
    await fs.writeFile(csvFilepath, csvData);
    
    console.log(`Exported ${conversations.length} total conversations to ${filename} and ${csvFilename}`);
    
    return filename;
  }

  /**
   * Convert to CSV format for analysis
   */
  private convertToCSV(conversations: TrainingDataPoint[]): string {
    const headers = [
      'conversation_id', 'timestamp', 'user_id', 'effectiveness',
      'heart_rate', 'stress_level', 'cognitive_load', 'attention_level',
      'hyperfocus', 'context_switches', 'is_breakthrough',
      'time_of_day', 'difficulty_level', 'user_satisfaction'
    ];
    
    const rows = conversations.map(conv => [
      conv.conversation_id,
      conv.timestamp,
      conv.user_id,
      conv.effectiveness,
      conv.biometric_context.heartRate,
      conv.biometric_context.stressLevel,
      conv.biometric_context.cognitiveLoad,
      conv.biometric_context.attentionLevel,
      conv.neurodivergent_markers.hyperfocus,
      conv.neurodivergent_markers.contextSwitches,
      conv.learning_markers.isBreakthrough,
      conv.environmental_context.timeOfDay,
      conv.learning_markers.difficultyLevel,
      conv.learning_markers.userSatisfaction
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Compress export files
   */
  private async compressExports(files: string[], jobId: string): Promise<string> {
    // For now, just create a metadata file - in production you'd use actual compression
    const compressedFilename = `nexis-training-export-${jobId}.tar.gz.info`;
    const compressedFilepath = path.join(this.outputDir, 'compressed', compressedFilename);
    
    const metadata = {
      exportId: jobId,
      files: files,
      totalSize: 'calculated_in_production',
      compressionRatio: 'calculated_in_production',
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(compressedFilepath, JSON.stringify(metadata, null, 2));
    return compressedFilename;
  }

  /**
   * Schedule daily exports
   */
  async scheduleDailyExport(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filters: ExportFilters = {
      minEffectiveness: 0.8,
      cognitiveStates: [],
      dateRange: { start: yesterday, end: today },
      includeBreakthroughs: false
    };
    
    const jobId = await this.startExport(filters);
    console.log(`Scheduled daily export job: ${jobId}`);
  }

  /**
   * Get export statistics
   */
  getExportStats(): {
    totalJobs: number;
    completedJobs: number;
    totalConversationsExported: number;
    lastExportTime?: Date;
  } {
    const jobs = Array.from(this.exportJobs.values());
    return {
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      totalConversationsExported: this.exportedConversations.size,
      lastExportTime: jobs.length > 0 ? 
        Math.max(...jobs.map(j => j.endTime?.getTime() || 0)) > 0 ?
        new Date(Math.max(...jobs.map(j => j.endTime?.getTime() || 0))) : undefined : undefined
    };
  }
}

export const trainingExportService = new TrainingExportService();