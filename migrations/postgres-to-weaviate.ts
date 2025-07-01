/**
 * PostgreSQL to Weaviate Migration Script
 * Transforms existing relational data into Weaviate's vector-first architecture
 */

import { storage } from '../server/storage.js';
import { weaviateService } from '../server/services/weaviate.service.js';
import type { BiometricData, PromptSession } from '../shared/schema.js';

interface MigrationStats {
  conversationsCreated: number;
  memoriesCreated: number;
  patternsLearned: number;
  totalProcessingTime: number;
  successRate: number;
}

/**
 * Main migration function
 */
export async function migratePostgresToWeaviate(options: {
  dryRun?: boolean;
  batchSize?: number;
} = {}): Promise<MigrationStats> {
  const startTime = Date.now();
  let conversationsCreated = 0;
  let memoriesCreated = 0;
  let processed = 0;
  let errors = 0;

  console.log('🚀 Starting PostgreSQL to Weaviate migration...');

  try {
    // Get all existing data
    const [promptSessions, biometricData] = await Promise.all([
      storage.getPromptSessions(),
      storage.getBiometricData()
    ]);

    console.log(`Found ${promptSessions.length} prompt sessions and ${biometricData.length} biometric records`);

    // Group biometric data by session
    const biometricBySession = new Map<number, BiometricData[]>();
    for (const data of biometricData) {
      if (data.sessionId) {
        if (!biometricBySession.has(data.sessionId)) {
          biometricBySession.set(data.sessionId, []);
        }
        biometricBySession.get(data.sessionId)!.push(data);
      }
    }

    // Convert sessions to conversations
    for (const session of promptSessions) {
      try {
        if (!options.dryRun) {
          await convertSessionToConversation(session, biometricBySession);
          conversationsCreated++;
        }
        processed++;
      } catch (error) {
        console.warn(`Failed to migrate session ${session.id}:`, error);
        errors++;
      }
    }

    // Create sample memories
    if (!options.dryRun) {
      const sampleMemories = generateSampleMemories();
      for (const memory of sampleMemories) {
        await weaviateService.storeMemory(memory);
        memoriesCreated++;
      }
    }

    // Learn patterns from migrated data
    let patternsLearned = 0;
    if (!options.dryRun) {
      const patterns = await weaviateService.learnBiometricPatterns();
      patternsLearned = patterns.length;
    }

    const totalTime = Date.now() - startTime;
    const successRate = processed > 0 ? ((processed - errors) / processed) * 100 : 0;

    console.log(`✅ Migration completed in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`Created: ${conversationsCreated} conversations, ${memoriesCreated} memories, ${patternsLearned} patterns`);
    console.log(`Success rate: ${successRate.toFixed(1)}%`);

    return {
      conversationsCreated,
      memoriesCreated,
      patternsLearned,
      totalProcessingTime: totalTime,
      successRate
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function convertSessionToConversation(
  session: PromptSession,
  biometricBySession: Map<number, BiometricData[]>
): Promise<void> {
  const sessionBiometrics = biometricBySession.get(session.id) || [];
  const avgBiometrics = calculateAverageBiometrics(sessionBiometrics);

  const conversationData = {
    conversationId: `migrated_${session.id}_${Date.now()}`,
    userId: session.userId || 1,
    sessionId: `migrated_session_${session.id}`,
    userMessage: session.originalPrompt || 'Migrated conversation',
    aiResponse: session.refinedPrompt || session.response || 'Migrated response',
    conversationContext: `Original session from ${session.createdAt}`,
    conversationType: 'migrated',
    effectivenessScore: 0.7,
    responseStrategy: 'adaptive_balanced',
    biometricState: avgBiometrics,
    neurodivergentMarkers: {
      hyperfocusState: false,
      contextSwitches: 0,
      sensoryLoad: 0.5,
      executiveFunction: 0.7,
      workingMemoryLoad: 0.5,
      attentionRegulation: 0.6
    },
    environmentalContext: {
      timeOfDay: 'unknown',
      dayOfWeek: 'unknown',
      location: 'unknown',
      soundLevel: 50,
      lightLevel: 300,
      temperature: 22,
      humidity: 50,
      airQuality: 80
    },
    learningMarkers: {
      isBreakthrough: false,
      cognitiveBreakthrough: false,
      difficultyLevel: 5,
      userSatisfaction: 0.7,
      learningGoals: ['general'],
      skillAreas: ['general'],
      knowledgeDomains: ['general'],
      adaptationNeeded: false,
      followUpRequired: false
    },
    timestamp: session.createdAt.toISOString()
  };

  await weaviateService.storeConversation(conversationData);
}

function calculateAverageBiometrics(biometricData: BiometricData[]): any {
  if (biometricData.length === 0) {
    return {
      heartRate: 75,
      hrv: 45,
      stressLevel: 0.5,
      attentionLevel: 0.6,
      cognitiveLoad: 0.5,
      flowState: 0.4,
      arousal: 0.5,
      valence: 0.0,
      timestamp: Date.now()
    };
  }

  const sum = biometricData.reduce((acc, data) => ({
    heartRate: acc.heartRate + (data.heartRate || 75),
    hrv: acc.hrv + (data.hrv || 45),
    stressLevel: acc.stressLevel + (data.stressLevel || 0.5),
    attentionLevel: acc.attentionLevel + (data.attentionLevel || 0.6),
    cognitiveLoad: acc.cognitiveLoad + (data.cognitiveLoad || 0.5),
    flowState: acc.flowState + (data.flowState || 0.4)
  }), {
    heartRate: 0, hrv: 0, stressLevel: 0, attentionLevel: 0, cognitiveLoad: 0, flowState: 0
  });

  const count = biometricData.length;
  return {
    heartRate: Math.round(sum.heartRate / count),
    hrv: Math.round(sum.hrv / count),
    stressLevel: Number((sum.stressLevel / count).toFixed(2)),
    attentionLevel: Number((sum.attentionLevel / count).toFixed(2)),
    cognitiveLoad: Number((sum.cognitiveLoad / count).toFixed(2)),
    flowState: Number((sum.flowState / count).toFixed(2)),
    arousal: 0.5,
    valence: 0.0,
    timestamp: Date.now()
  };
}

function generateSampleMemories(): any[] {
  return [
    {
      memoryId: `mem_${Date.now()}_1`,
      userId: 1,
      content: "User prefers technical explanations with examples",
      memoryType: 'preference',
      importance: 0.8,
      confidenceLevel: 0.9,
      emotionalValence: 0.2,
      emotionalIntensity: 0.3,
      relatedTopics: ['technical_communication'],
      associatedSkills: ['problem_solving'],
      retrievalStrength: 0.9,
      createdAt: new Date().toISOString()
    }
  ];
}