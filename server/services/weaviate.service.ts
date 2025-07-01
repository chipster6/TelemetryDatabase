/**
 * Comprehensive Weaviate Service Layer for Nexis Platform
 * Primary data store with full biometric context and infinite memory
 */

import { vectorDatabase } from './vector-database.js';
import { initializeWeaviateSchema, getSchemaStats } from '../weaviate/schema.js';
import type { BiometricData } from '../../shared/schema.js';

export interface ConversationData {
  conversationId: string;
  userId: number;
  sessionId: string;
  userMessage: string;
  aiResponse: string;
  conversationContext: string;
  conversationType: string;
  effectivenessScore: number;
  responseStrategy: string;
  biometricState: BiometricSnapshot;
  neurodivergentMarkers: NeurodivergentMarkers;
  environmentalContext: EnvironmentalContext;
  learningMarkers: LearningMarkers;
  timestamp: string;
}

export interface BiometricSnapshot {
  heartRate: number;
  hrv: number;
  stressLevel: number;
  attentionLevel: number;
  cognitiveLoad: number;
  flowState: number;
  arousal: number;
  valence: number;
  timestamp: number;
}

export interface NeurodivergentMarkers {
  hyperfocusState: boolean;
  contextSwitches: number;
  sensoryLoad: number;
  executiveFunction: number;
  workingMemoryLoad: number;
  attentionRegulation: number;
}

export interface EnvironmentalContext {
  timeOfDay: string;
  dayOfWeek: string;
  location: string;
  soundLevel: number;
  lightLevel: number;
  temperature: number;
  humidity: number;
  airQuality: number;
}

export interface LearningMarkers {
  isBreakthrough: boolean;
  cognitiveBreakthrough: boolean;
  difficultyLevel: number;
  userSatisfaction: number;
  learningGoals: string[];
  skillAreas: string[];
  knowledgeDomains: string[];
  adaptationNeeded: boolean;
  followUpRequired: boolean;
}

export interface Memory {
  memoryId: string;
  userId: number;
  content: string;
  memoryType: 'fact' | 'experience' | 'preference' | 'skill' | 'insight' | 'pattern';
  importance: number;
  confidenceLevel: number;
  emotionalValence: number;
  emotionalIntensity: number;
  relatedTopics: string[];
  associatedSkills: string[];
  formationBiometrics: any;
  retrievalStrength: number;
  createdAt: string;
}

export interface BiometricPattern {
  patternId: string;
  patternName: string;
  description: string;
  biometricRanges: {
    heartRate: [number, number];
    hrv: [number, number];
    stressLevel: [number, number];
    attentionLevel: [number, number];
    cognitiveLoad: [number, number];
    flowState: [number, number];
  };
  optimalStrategies: string[];
  avoidStrategies: string[];
  successRate: number;
  sampleSize: number;
  lastUpdated: string;
}

export interface Strategy {
  communicationStyle: string;
  informationDensity: string;
  responseLength: string;
  interactionPace: string;
  strategies: string[];
  effectiveness: number;
  contextFactors: string[];
}

export interface LLMContext {
  instruction: string;
  currentUserState: {
    biometrics: BiometricSnapshot;
    query: string;
    timestamp: string;
    neurodivergentState: NeurodivergentMarkers;
    environment: EnvironmentalContext;
  };
  historicalContext: {
    semanticMatches: any[];
    biometricMatches: any[];
    patternMatches: any[];
    insights: string[];
  };
  personalMemories: Memory[];
  optimalStrategies: Strategy[];
  knowledgeConnections: any[];
  effectivePrompts: any[];
  systemPrompt: string;
  contextualAdaptations: string[];
}

export class WeaviateService {
  private weaviateClient: any;
  private initialized = false;
  private healthStatus = 'unknown';
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.weaviateClient = vectorDatabase.getClient();
  }

  /**
   * Initialize Weaviate service and schema
   */
  async initialize(): Promise<void> {
    try {
      if (!this.weaviateClient) {
        throw new Error('Weaviate client not available - check WEAVIATE_URL and WEAVIATE_API_KEY');
      }

      // Test connection
      await this.checkHealth();
      
      if (this.healthStatus !== 'healthy') {
        throw new Error('Weaviate health check failed');
      }

      // Initialize schema
      await initializeWeaviateSchema(this.weaviateClient);
      
      this.initialized = true;
      console.log('✓ Weaviate service initialized as primary data store');
      
      // Start periodic health checks
      this.startHealthMonitoring();
      
    } catch (error) {
      console.error('Failed to initialize Weaviate service:', error);
      this.healthStatus = 'error';
      throw error;
    }
  }

  /**
   * Check Weaviate health status
   */
  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    
    // Skip if recently checked
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL && this.healthStatus === 'healthy') {
      return true;
    }

    try {
      const health = await this.weaviateClient.misc.liveChecker().do();
      const meta = await this.weaviateClient.misc.metaGetter().do();
      
      this.healthStatus = 'healthy';
      this.lastHealthCheck = now;
      
      console.log(`Weaviate health check: OK (version: ${meta.version})`);
      return true;
      
    } catch (error) {
      console.error('Weaviate health check failed:', error);
      this.healthStatus = 'error';
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.checkHealth();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Store conversation with full context in Weaviate
   */
  async storeConversation(data: ConversationData): Promise<string> {
    if (!this.initialized) {
      throw new Error('Weaviate service not initialized');
    }

    try {
      const properties = {
        // Core conversation
        conversationId: data.conversationId,
        userId: data.userId,
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        userMessage: data.userMessage,
        aiResponse: data.aiResponse,
        conversationContext: data.conversationContext,
        conversationType: data.conversationType,
        
        // Effectiveness and learning
        effectivenessScore: data.effectivenessScore,
        userSatisfaction: data.learningMarkers.userSatisfaction,
        responseStrategy: data.responseStrategy,
        isBreakthrough: data.learningMarkers.isBreakthrough,
        cognitiveBreakthrough: data.learningMarkers.cognitiveBreakthrough,
        difficultyLevel: data.learningMarkers.difficultyLevel,
        
        // Biometric state
        heartRate: data.biometricState.heartRate,
        hrv: data.biometricState.hrv,
        stressLevel: data.biometricState.stressLevel,
        attentionLevel: data.biometricState.attentionLevel,
        cognitiveLoad: data.biometricState.cognitiveLoad,
        flowState: data.biometricState.flowState,
        arousal: data.biometricState.arousal,
        valence: data.biometricState.valence,
        biometricTimestamp: new Date(data.biometricState.timestamp).toISOString(),
        
        // Neurodivergent markers
        hyperfocusState: data.neurodivergentMarkers.hyperfocusState,
        contextSwitches: data.neurodivergentMarkers.contextSwitches,
        sensoryLoad: data.neurodivergentMarkers.sensoryLoad,
        executiveFunction: data.neurodivergentMarkers.executiveFunction,
        workingMemoryLoad: data.neurodivergentMarkers.workingMemoryLoad,
        attentionRegulation: data.neurodivergentMarkers.attentionRegulation,
        
        // Environmental context
        timeOfDay: data.environmentalContext.timeOfDay,
        dayOfWeek: data.environmentalContext.dayOfWeek,
        location: data.environmentalContext.location,
        soundLevel: data.environmentalContext.soundLevel,
        lightLevel: data.environmentalContext.lightLevel,
        temperature: data.environmentalContext.temperature,
        humidity: data.environmentalContext.humidity,
        airQuality: data.environmentalContext.airQuality,
        
        // Learning metadata
        learningGoals: data.learningMarkers.learningGoals,
        skillAreas: data.learningMarkers.skillAreas,
        knowledgeDomains: data.learningMarkers.knowledgeDomains,
        adaptationNeeded: data.learningMarkers.adaptationNeeded,
        followUpRequired: data.learningMarkers.followUpRequired
      };

      const result = await this.weaviateClient.data
        .creator()
        .withClassName('NexisConversation')
        .withProperties(properties)
        .do();

      console.log(`✓ Stored conversation ${data.conversationId} in Weaviate primary storage`);
      return result.id;
      
    } catch (error) {
      console.error('Failed to store conversation in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(id: string): Promise<any> {
    try {
      const result = await this.weaviateClient.data
        .getterById()
        .withClassName('NexisConversation')
        .withId(id)
        .do();

      return result;
      
    } catch (error) {
      console.error(`Failed to get conversation ${id}:`, error);
      return null;
    }
  }

  /**
   * Search conversations with semantic similarity
   */
  async searchConversations(query: string, limit: number = 10, userId?: number): Promise<any[]> {
    try {
      let whereFilter;
      
      if (userId) {
        whereFilter = {
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        };
      }

      const result = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          conversationId
          userMessage
          aiResponse
          effectivenessScore
          responseStrategy
          heartRate
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          timeOfDay
          isBreakthrough
          userSatisfaction
          timestamp
        `)
        .withNearText({ concepts: [query] })
        .withWhere(whereFilter)
        .withLimit(limit)
        .do();

      return result?.data?.Get?.NexisConversation || [];
      
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  }

  /**
   * Search conversations by biometric state similarity
   */
  async searchByBiometricState(biometrics: BiometricSnapshot, limit: number = 10, userId?: number): Promise<any[]> {
    try {
      const tolerance = 0.15; // 15% tolerance for biometric matching
      
      const whereConditions = [
        { path: ['cognitiveLoad'], operator: 'GreaterThan', valueNumber: biometrics.cognitiveLoad - tolerance },
        { path: ['cognitiveLoad'], operator: 'LessThan', valueNumber: biometrics.cognitiveLoad + tolerance },
        { path: ['stressLevel'], operator: 'GreaterThan', valueNumber: biometrics.stressLevel - tolerance },
        { path: ['stressLevel'], operator: 'LessThan', valueNumber: biometrics.stressLevel + tolerance },
        { path: ['attentionLevel'], operator: 'GreaterThan', valueNumber: biometrics.attentionLevel - tolerance },
        { path: ['attentionLevel'], operator: 'LessThan', valueNumber: biometrics.attentionLevel + tolerance }
      ];

      if (userId) {
        whereConditions.push({ path: ['userId'], operator: 'Equal', valueInt: userId });
      }

      const result = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          conversationId
          userMessage
          aiResponse
          effectivenessScore
          responseStrategy
          heartRate
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          hyperfocusState
          executiveFunction
        `)
        .withWhere({
          operator: 'And',
          operands: whereConditions
        })
        .withSort([{ path: ['effectivenessScore'], order: 'desc' }])
        .withLimit(limit)
        .do();

      return result?.data?.Get?.NexisConversation || [];
      
    } catch (error) {
      console.error('Failed to search by biometric state:', error);
      return [];
    }
  }

  /**
   * Store memory in long-term knowledge base
   */
  async storeMemory(memory: Memory): Promise<string> {
    try {
      const properties = {
        memoryId: memory.memoryId,
        userId: memory.userId,
        content: memory.content,
        memoryType: memory.memoryType,
        importance: memory.importance,
        confidenceLevel: memory.confidenceLevel,
        emotionalValence: memory.emotionalValence,
        emotionalIntensity: memory.emotionalIntensity,
        createdAt: memory.createdAt,
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        relatedTopics: memory.relatedTopics,
        associatedSkills: memory.associatedSkills,
        retrievalStrength: memory.retrievalStrength,
        formationBiometrics: memory.formationBiometrics || {}
      };

      const result = await this.weaviateClient.data
        .creator()
        .withClassName('NexisMemoryNode')
        .withProperties(properties)
        .do();

      console.log(`✓ Stored memory ${memory.memoryId}`);
      return result.id;
      
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Search memories with semantic similarity
   */
  async searchMemories(query: string, userId?: number, limit: number = 5): Promise<Memory[]> {
    try {
      let whereFilter;
      
      if (userId) {
        whereFilter = {
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        };
      }

      const result = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisMemoryNode')
        .withFields(`
          memoryId
          content
          memoryType
          importance
          confidenceLevel
          emotionalValence
          emotionalIntensity
          relatedTopics
          associatedSkills
          retrievalStrength
          createdAt
          lastAccessed
          accessCount
        `)
        .withNearText({ concepts: [query] })
        .withWhere(whereFilter)
        .withSort([{ path: ['importance'], order: 'desc' }])
        .withLimit(limit)
        .do();

      const memories = result?.data?.Get?.NexisMemoryNode || [];
      
      // Update access count for retrieved memories
      for (const memory of memories) {
        this.updateMemoryAccess(memory.memoryId);
      }
      
      return memories;
      
    } catch (error) {
      console.error('Failed to search memories:', error);
      return [];
    }
  }

  /**
   * Update memory access tracking
   */
  private async updateMemoryAccess(memoryId: string): Promise<void> {
    try {
      // This would typically update access count and last accessed time
      // For now, we'll implement this as a background task
      console.log(`Memory ${memoryId} accessed`);
    } catch (error) {
      console.error('Failed to update memory access:', error);
    }
  }

  /**
   * Learn biometric patterns from conversation effectiveness
   */
  async learnBiometricPatterns(userId?: number): Promise<BiometricPattern[]> {
    try {
      console.log('Learning biometric patterns from conversation effectiveness...');
      
      // Get high-effectiveness conversations
      const whereConditions = [
        { path: ['effectivenessScore'], operator: 'GreaterThan', valueNumber: 0.7 }
      ];

      if (userId) {
        whereConditions.push({ path: ['userId'], operator: 'Equal', valueInt: userId });
      }

      const conversations = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          effectivenessScore
          responseStrategy
          heartRate
          hrv
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          hyperfocusState
          executiveFunction
          timeOfDay
          userSatisfaction
        `)
        .withWhere({
          operator: 'And',
          operands: whereConditions
        })
        .withLimit(100)
        .do();

      const data = conversations?.data?.Get?.NexisConversation || [];
      
      if (data.length < 5) {
        console.log('Insufficient conversation data for pattern learning');
        return [];
      }

      const patterns = this.analyzeAndCreatePatterns(data);
      
      // Store learned patterns
      for (const pattern of patterns) {
        await this.storeBiometricPattern(pattern);
      }

      console.log(`✓ Learned ${patterns.length} biometric patterns`);
      return patterns;
      
    } catch (error) {
      console.error('Failed to learn biometric patterns:', error);
      return [];
    }
  }

  /**
   * Analyze conversations and create biometric patterns
   */
  private analyzeAndCreatePatterns(conversations: any[]): BiometricPattern[] {
    const patterns: BiometricPattern[] = [];
    
    // Group conversations by similar biometric signatures
    const groups = this.groupConversationsByBiometrics(conversations);
    
    for (const [groupName, groupData] of Object.entries(groups)) {
      if (groupData.length < 3) continue;
      
      const pattern: BiometricPattern = {
        patternId: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patternName: groupName,
        description: `Optimal response pattern for ${groupName} cognitive state`,
        biometricRanges: this.calculateBiometricRanges(groupData),
        optimalStrategies: this.extractOptimalStrategies(groupData),
        avoidStrategies: this.extractIneffectiveStrategies(groupData),
        successRate: groupData.reduce((sum: number, conv: any) => sum + conv.effectivenessScore, 0) / groupData.length,
        sampleSize: groupData.length,
        lastUpdated: new Date().toISOString()
      };
      
      patterns.push(pattern);
    }
    
    return patterns;
  }

  /**
   * Group conversations by biometric similarities
   */
  private groupConversationsByBiometrics(conversations: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'high_flow_deep_focus': [],
      'stressed_high_cognitive_load': [],
      'hyperfocus_technical': [],
      'creative_relaxed': [],
      'learning_moderate_load': [],
      'executive_function_support': []
    };

    for (const conv of conversations) {
      if (conv.flowState > 0.7 && conv.attentionLevel > 0.8) {
        groups.high_flow_deep_focus.push(conv);
      } else if (conv.stressLevel > 0.6 && conv.cognitiveLoad > 0.7) {
        groups.stressed_high_cognitive_load.push(conv);
      } else if (conv.hyperfocusState && conv.cognitiveLoad > 0.6) {
        groups.hyperfocus_technical.push(conv);
      } else if (conv.cognitiveLoad < 0.5 && conv.stressLevel < 0.4) {
        groups.creative_relaxed.push(conv);
      } else if (conv.executiveFunction < 0.5) {
        groups.executive_function_support.push(conv);
      } else {
        groups.learning_moderate_load.push(conv);
      }
    }

    return groups;
  }

  /**
   * Calculate biometric ranges for pattern
   */
  private calculateBiometricRanges(conversations: any[]): BiometricPattern['biometricRanges'] {
    const metrics = ['heartRate', 'hrv', 'stressLevel', 'attentionLevel', 'cognitiveLoad', 'flowState'];
    const ranges: any = {};

    for (const metric of metrics) {
      const values = conversations.map(c => c[metric]).filter(v => v != null);
      if (values.length > 0) {
        ranges[metric] = [Math.min(...values), Math.max(...values)];
      }
    }

    return ranges;
  }

  /**
   * Extract optimal strategies from successful conversations
   */
  private extractOptimalStrategies(conversations: any[]): string[] {
    const strategies = conversations
      .map(c => c.responseStrategy)
      .filter(Boolean)
      .reduce((acc: Record<string, number>, strategy: string) => {
        acc[strategy] = (acc[strategy] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(strategies)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([strategy]) => strategy);
  }

  /**
   * Extract ineffective strategies to avoid
   */
  private extractIneffectiveStrategies(conversations: any[]): string[] {
    // This would analyze low-effectiveness conversations
    // For now, return common ineffective patterns
    return ['overly_complex', 'too_fast_paced', 'information_overload'];
  }

  /**
   * Store learned biometric pattern
   */
  private async storeBiometricPattern(pattern: BiometricPattern): Promise<void> {
    try {
      const properties = {
        patternId: pattern.patternId,
        patternName: pattern.patternName,
        description: pattern.description,
        
        // Biometric ranges
        heartRateMin: pattern.biometricRanges.heartRate?.[0] || 0,
        heartRateMax: pattern.biometricRanges.heartRate?.[1] || 200,
        hrvMin: pattern.biometricRanges.hrv?.[0] || 0,
        hrvMax: pattern.biometricRanges.hrv?.[1] || 100,
        stressMin: pattern.biometricRanges.stressLevel?.[0] || 0,
        stressMax: pattern.biometricRanges.stressLevel?.[1] || 1,
        attentionMin: pattern.biometricRanges.attentionLevel?.[0] || 0,
        attentionMax: pattern.biometricRanges.attentionLevel?.[1] || 1,
        cognitiveLoadMin: pattern.biometricRanges.cognitiveLoad?.[0] || 0,
        cognitiveLoadMax: pattern.biometricRanges.cognitiveLoad?.[1] || 1,
        flowStateMin: pattern.biometricRanges.flowState?.[0] || 0,
        flowStateMax: pattern.biometricRanges.flowState?.[1] || 1,
        
        // Strategies
        optimalStrategies: pattern.optimalStrategies,
        avoidStrategies: pattern.avoidStrategies,
        
        // Performance
        successRate: pattern.successRate,
        sampleSize: pattern.sampleSize,
        lastUpdated: pattern.lastUpdated,
        createdAt: new Date().toISOString()
      };

      await this.weaviateClient.data
        .creator()
        .withClassName('NexisBiometricPattern')
        .withProperties(properties)
        .do();

      console.log(`✓ Stored biometric pattern: ${pattern.patternName}`);
      
    } catch (error) {
      console.error(`Failed to store pattern ${pattern.patternName}:`, error);
    }
  }

  /**
   * Get optimal response strategy for current biometric state
   */
  async getOptimalResponseStrategy(biometrics: BiometricSnapshot, userId?: number): Promise<Strategy> {
    try {
      // Find matching biometric patterns
      const patterns = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisBiometricPattern')
        .withFields(`
          patternName
          optimalStrategies
          avoidStrategies
          successRate
          cognitiveLoadMin
          cognitiveLoadMax
          stressMin
          stressMax
          attentionMin
          attentionMax
          flowStateMin
          flowStateMax
        `)
        .withWhere({
          operator: 'And',
          operands: [
            { path: ['cognitiveLoadMin'], operator: 'LessThanEqual', valueNumber: biometrics.cognitiveLoad },
            { path: ['cognitiveLoadMax'], operator: 'GreaterThanEqual', valueNumber: biometrics.cognitiveLoad },
            { path: ['stressMin'], operator: 'LessThanEqual', valueNumber: biometrics.stressLevel },
            { path: ['stressMax'], operator: 'GreaterThanEqual', valueNumber: biometrics.stressLevel },
            { path: ['attentionMin'], operator: 'LessThanEqual', valueNumber: biometrics.attentionLevel },
            { path: ['attentionMax'], operator: 'GreaterThanEqual', valueNumber: biometrics.attentionLevel }
          ]
        })
        .withSort([{ path: ['successRate'], order: 'desc' }])
        .withLimit(3)
        .do();

      const patternData = patterns?.data?.Get?.NexisBiometricPattern || [];
      
      if (patternData.length === 0) {
        return this.getDefaultStrategy(biometrics);
      }

      const bestPattern = patternData[0];
      
      return {
        communicationStyle: this.determineCommunicationStyle(biometrics, bestPattern),
        informationDensity: this.determineInformationDensity(biometrics),
        responseLength: this.determineResponseLength(biometrics),
        interactionPace: this.determineInteractionPace(biometrics),
        strategies: bestPattern.optimalStrategies || [],
        effectiveness: bestPattern.successRate || 0.5,
        contextFactors: this.identifyContextFactors(biometrics)
      };
      
    } catch (error) {
      console.error('Failed to get optimal response strategy:', error);
      return this.getDefaultStrategy(biometrics);
    }
  }

  /**
   * Determine optimal communication style based on biometrics
   */
  private determineCommunicationStyle(biometrics: BiometricSnapshot, pattern: any): string {
    if (biometrics.stressLevel > 0.7) return 'calm_supportive';
    if (biometrics.flowState > 0.7) return 'direct_technical';
    if (biometrics.cognitiveLoad > 0.8) return 'simple_clear';
    if (biometrics.attentionLevel < 0.4) return 'engaging_interactive';
    return 'adaptive_balanced';
  }

  /**
   * Determine optimal information density
   */
  private determineInformationDensity(biometrics: BiometricSnapshot): string {
    if (biometrics.cognitiveLoad > 0.8) return 'low';
    if (biometrics.flowState > 0.7 && biometrics.attentionLevel > 0.8) return 'high';
    return 'medium';
  }

  /**
   * Determine optimal response length
   */
  private determineResponseLength(biometrics: BiometricSnapshot): string {
    if (biometrics.cognitiveLoad > 0.8 || biometrics.stressLevel > 0.7) return 'short';
    if (biometrics.flowState > 0.7) return 'detailed';
    return 'medium';
  }

  /**
   * Determine optimal interaction pace
   */
  private determineInteractionPace(biometrics: BiometricSnapshot): string {
    if (biometrics.stressLevel > 0.6) return 'slow';
    if (biometrics.flowState > 0.7) return 'fast';
    return 'medium';
  }

  /**
   * Identify important context factors
   */
  private identifyContextFactors(biometrics: BiometricSnapshot): string[] {
    const factors = [];
    
    if (biometrics.cognitiveLoad > 0.8) factors.push('high_cognitive_load');
    if (biometrics.stressLevel > 0.6) factors.push('elevated_stress');
    if (biometrics.flowState > 0.7) factors.push('flow_state');
    if (biometrics.attentionLevel < 0.4) factors.push('attention_challenges');
    
    return factors;
  }

  /**
   * Get default strategy for unknown biometric states
   */
  private getDefaultStrategy(biometrics: BiometricSnapshot): Strategy {
    return {
      communicationStyle: 'adaptive_balanced',
      informationDensity: 'medium',
      responseLength: 'medium',
      interactionPace: 'medium',
      strategies: ['be_supportive', 'adapt_to_pace', 'provide_clear_guidance'],
      effectiveness: 0.6,
      contextFactors: this.identifyContextFactors(biometrics)
    };
  }

  /**
   * Build comprehensive LLM context with infinite memory
   */
  async buildLLMContext(query: string, biometrics: BiometricSnapshot, userId: number): Promise<LLMContext> {
    try {
      console.log(`Building LLM context for user ${userId}...`);
      
      // Get semantic matches
      const semanticMatches = await this.searchConversations(query, 10, userId);
      
      // Get biometric state matches
      const biometricMatches = await this.searchByBiometricState(biometrics, 5, userId);
      
      // Get relevant memories
      const memories = await this.searchMemories(query, userId, 5);
      
      // Get optimal strategies
      const strategy = await this.getOptimalResponseStrategy(biometrics, userId);
      
      // Get effective prompt templates
      const effectivePrompts = await this.getEffectivePrompts(query, biometrics);
      
      // Generate insights
      const insights = this.generateContextualInsights(semanticMatches, biometricMatches, memories);
      
      // Generate system prompt
      const systemPrompt = this.generateDynamicSystemPrompt(biometrics, strategy, insights);
      
      // Generate contextual adaptations
      const adaptations = this.generateContextualAdaptations(biometrics, strategy);

      return {
        instruction: "You are Nexis, a biometric-aware AI with infinite memory and deep personal understanding.",
        currentUserState: {
          biometrics,
          query,
          timestamp: new Date().toISOString(),
          neurodivergentState: this.extractNeurodivergentMarkers(biometrics),
          environment: this.extractEnvironmentalContext()
        },
        historicalContext: {
          semanticMatches,
          biometricMatches,
          patternMatches: [],
          insights
        },
        personalMemories: memories,
        optimalStrategies: [strategy],
        knowledgeConnections: [],
        effectivePrompts,
        systemPrompt,
        contextualAdaptations: adaptations
      };
      
    } catch (error) {
      console.error('Failed to build LLM context:', error);
      return this.getMinimalContext(query, biometrics, userId);
    }
  }

  /**
   * Get effective prompt templates for current context
   */
  private async getEffectivePrompts(query: string, biometrics: BiometricSnapshot): Promise<any[]> {
    try {
      // This would search for effective prompt templates
      // For now, return empty array - to be implemented with NexisPromptTemplate
      return [];
    } catch (error) {
      console.error('Failed to get effective prompts:', error);
      return [];
    }
  }

  /**
   * Generate contextual insights from historical data
   */
  private generateContextualInsights(semantic: any[], biometric: any[], memories: any[]): string[] {
    const insights = [];
    
    if (semantic.length > 0) {
      const avgEffectiveness = semantic.reduce((sum, conv) => sum + (conv.effectivenessScore || 0), 0) / semantic.length;
      insights.push(`Similar conversations: ${(avgEffectiveness * 100).toFixed(0)}% avg effectiveness`);
    }
    
    if (biometric.length > 0) {
      insights.push(`Found ${biometric.length} conversations in similar cognitive state`);
      const breakthroughs = biometric.filter(conv => conv.isBreakthrough).length;
      if (breakthroughs > 0) {
        insights.push(`${breakthroughs} breakthrough moments in similar states`);
      }
    }
    
    if (memories.length > 0) {
      insights.push(`${memories.length} relevant personal memories retrieved`);
      const highImportance = memories.filter(m => m.importance > 0.8).length;
      if (highImportance > 0) {
        insights.push(`${highImportance} high-importance memories found`);
      }
    }
    
    return insights;
  }

  /**
   * Generate dynamic system prompt
   */
  private generateDynamicSystemPrompt(biometrics: BiometricSnapshot, strategy: Strategy, insights: string[]): string {
    const prompts = [];
    
    // Biometric adaptations
    if (biometrics.cognitiveLoad > 0.8) {
      prompts.push("User has high cognitive load. Break down complex concepts into simple, digestible steps.");
    }
    
    if (biometrics.stressLevel > 0.6) {
      prompts.push("User shows stress indicators. Be calming, supportive, and solution-focused.");
    }
    
    if (biometrics.flowState > 0.7) {
      prompts.push("User is in flow state. Match their momentum with direct, technical responses.");
    }
    
    // Strategy integration
    prompts.push(`Communication style: ${strategy.communicationStyle}`);
    prompts.push(`Information density: ${strategy.informationDensity}`);
    prompts.push(`Response length: ${strategy.responseLength}`);
    
    // Historical insights
    if (insights.length > 0) {
      prompts.push(`Context: ${insights.join(', ')}`);
    }
    
    return prompts.length > 0 
      ? prompts.join(' ') 
      : "Respond with empathy and intelligence, adapting to the user's current state and history.";
  }

  /**
   * Generate contextual adaptations
   */
  private generateContextualAdaptations(biometrics: BiometricSnapshot, strategy: Strategy): string[] {
    const adaptations = [];
    
    if (biometrics.cognitiveLoad > 0.8) {
      adaptations.push('reduce_complexity');
      adaptations.push('increase_clarity');
    }
    
    if (biometrics.stressLevel > 0.6) {
      adaptations.push('calming_tone');
      adaptations.push('supportive_language');
    }
    
    if (biometrics.flowState > 0.7) {
      adaptations.push('match_momentum');
      adaptations.push('technical_depth');
    }
    
    return adaptations;
  }

  /**
   * Extract neurodivergent markers from biometrics
   */
  private extractNeurodivergentMarkers(biometrics: BiometricSnapshot): NeurodivergentMarkers {
    return {
      hyperfocusState: biometrics.flowState > 0.8 && biometrics.attentionLevel > 0.9,
      contextSwitches: 0, // Would be tracked separately
      sensoryLoad: Math.min(1, biometrics.arousal * 1.2), // Approximation
      executiveFunction: Math.max(0, 1 - biometrics.stressLevel), // Inverse relationship
      workingMemoryLoad: biometrics.cognitiveLoad,
      attentionRegulation: biometrics.attentionLevel
    };
  }

  /**
   * Extract environmental context
   */
  private extractEnvironmentalContext(): EnvironmentalContext {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay = 'unknown';
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    return {
      timeOfDay,
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
      location: 'unknown',
      soundLevel: 0,
      lightLevel: 0,
      temperature: 0,
      humidity: 0,
      airQuality: 0
    };
  }

  /**
   * Get minimal context fallback
   */
  private getMinimalContext(query: string, biometrics: BiometricSnapshot, userId: number): LLMContext {
    return {
      instruction: "You are Nexis, a helpful AI assistant.",
      currentUserState: {
        biometrics,
        query,
        timestamp: new Date().toISOString(),
        neurodivergentState: this.extractNeurodivergentMarkers(biometrics),
        environment: this.extractEnvironmentalContext()
      },
      historicalContext: {
        semanticMatches: [],
        biometricMatches: [],
        patternMatches: [],
        insights: []
      },
      personalMemories: [],
      optimalStrategies: [this.getDefaultStrategy(biometrics)],
      knowledgeConnections: [],
      effectivePrompts: [],
      systemPrompt: "Respond helpfully while being mindful of the user's current state.",
      contextualAdaptations: []
    };
  }

  /**
   * Get comprehensive service statistics
   */
  async getServiceStats(): Promise<any> {
    try {
      const [conversationStats, memoryStats, patternStats, schemaStats] = await Promise.all([
        this.weaviateClient.graphql.aggregate().withClassName('NexisConversation').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisMemoryNode').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisBiometricPattern').withFields('meta { count }').do(),
        getSchemaStats(this.weaviateClient)
      ]);

      return {
        initialized: this.initialized,
        healthStatus: this.healthStatus,
        lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
        mode: 'primary_storage',
        dataStore: 'weaviate_first',
        
        // Data counts
        conversations: conversationStats?.data?.Aggregate?.NexisConversation?.[0]?.meta?.count || 0,
        memories: memoryStats?.data?.Aggregate?.NexisMemoryNode?.[0]?.meta?.count || 0,
        patterns: patternStats?.data?.Aggregate?.NexisBiometricPattern?.[0]?.meta?.count || 0,
        
        // Schema info
        schema: schemaStats,
        
        // Capabilities
        capabilities: {
          infiniteMemory: true,
          semanticSearch: true,
          biometricPatternLearning: true,
          ragPipeline: true,
          personalizedAdaptation: true,
          neurodivergentSupport: true,
          contextualIntelligence: true
        },
        
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Failed to get service stats:', error);
      return { 
        initialized: false, 
        healthStatus: 'error',
        error: error.message,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Update memory importance based on usage patterns
   */
  async updateMemoryImportance(memoryId: string, importance: number): Promise<void> {
    try {
      // This would update the importance value in Weaviate
      // For now, log the update
      console.log(`Memory ${memoryId} importance updated to ${importance}`);
    } catch (error) {
      console.error('Failed to update memory importance:', error);
    }
  }
}

export const weaviateService = new WeaviateService();