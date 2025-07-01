import { vectorDatabase } from './vector-database.js';
import type { BiometricData, PromptSession, User } from '../../shared/schema.js';

export interface WeaviateConversation {
  id: string;
  userId: number;
  timestamp: string;
  conversationType: string;
  userInput: string;
  aiResponse: string;
  biometricState: {
    heartRate: number;
    hrv: number;
    stressLevel: number;
    attentionLevel: number;
    cognitiveLoad: number;
    flowState: number;
    timestamp: number;
  };
  environmentalContext: {
    timeOfDay: string;
    location: string;
    soundLevel: number;
    lightLevel: number;
    temperature: number;
  };
  effectiveness: number;
  responseStrategy: string;
  conversationContext: string;
  learningMarkers: {
    isBreakthrough: boolean;
    difficultyLevel: number;
    userSatisfaction: number;
    cognitiveBreakthrough: boolean;
  };
}

export interface WeaviateBiometricPattern {
  id: string;
  patternName: string;
  biometricSignature: {
    heartRateRange: [number, number];
    stressRange: [number, number];
    attentionRange: [number, number];
    cognitiveLoadRange: [number, number];
    flowStateRange: [number, number];
  };
  optimalStrategies: string[];
  triggerConditions: string[];
  successRate: number;
  learnedFrom: number; // Number of conversations
  lastUpdated: string;
}

export interface WeaviateMemoryNode {
  id: string;
  userId: number;
  content: string;
  memoryType: 'fact' | 'experience' | 'preference' | 'skill' | 'insight';
  importance: number;
  lastAccessed: string;
  accessCount: number;
  emotionalValence: number;
  relatedTopics: string[];
  biometricContext: any;
  retrievalStrength: number;
}

export class WeaviatePrimaryStorage {
  private weaviateClient: any;
  private initialized = false;

  constructor() {
    this.weaviateClient = vectorDatabase.getClient();
  }

  /**
   * Initialize Weaviate as primary storage with comprehensive schemas
   */
  async initialize(): Promise<void> {
    try {
      if (!this.weaviateClient) {
        throw new Error('Weaviate client not available');
      }

      await this.createPrimarySchemas();
      this.initialized = true;
      console.log('Weaviate Primary Storage initialized as LLM backbone');
    } catch (error) {
      console.error('Failed to initialize Weaviate Primary Storage:', error);
      throw error;
    }
  }

  /**
   * Create comprehensive Weaviate schemas for primary storage
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
      try {
        const exists = await this.weaviateClient.schema.exists(schema.class);
        if (!exists) {
          await this.weaviateClient.schema.classCreator().withClass(schema).do();
          console.log(`Created primary Weaviate class: ${schema.class}`);
        }
      } catch (error) {
        console.warn(`Failed to create class ${schema.class}:`, error);
      }
    }
  }

  /**
   * Store conversation as primary data with full context
   */
  async storeConversation(conversation: WeaviateConversation): Promise<string> {
    if (!this.initialized) {
      throw new Error('Weaviate Primary Storage not initialized');
    }

    try {
      const result = await this.weaviateClient.data
        .creator()
        .withClassName('NexisConversation')
        .withProperties({
          userId: conversation.userId,
          timestamp: conversation.timestamp,
          conversationType: conversation.conversationType,
          userInput: conversation.userInput,
          aiResponse: conversation.aiResponse,
          conversationContext: conversation.conversationContext,
          effectiveness: conversation.effectiveness,
          responseStrategy: conversation.responseStrategy,
          
          // Biometric state
          heartRate: conversation.biometricState.heartRate,
          hrv: conversation.biometricState.hrv,
          stressLevel: conversation.biometricState.stressLevel,
          attentionLevel: conversation.biometricState.attentionLevel,
          cognitiveLoad: conversation.biometricState.cognitiveLoad,
          flowState: conversation.biometricState.flowState,
          biometricTimestamp: new Date(conversation.biometricState.timestamp).toISOString(),
          
          // Environmental context
          timeOfDay: conversation.environmentalContext.timeOfDay,
          location: conversation.environmentalContext.location,
          soundLevel: conversation.environmentalContext.soundLevel,
          lightLevel: conversation.environmentalContext.lightLevel,
          temperature: conversation.environmentalContext.temperature,
          
          // Learning markers
          isBreakthrough: conversation.learningMarkers.isBreakthrough,
          difficultyLevel: conversation.learningMarkers.difficultyLevel,
          userSatisfaction: conversation.learningMarkers.userSatisfaction,
          cognitiveBreakthrough: conversation.learningMarkers.cognitiveBreakthrough
        })
        .do();

      console.log(`Stored conversation ${conversation.id} in Weaviate primary storage`);
      return result.id;
    } catch (error) {
      console.error('Failed to store conversation in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Retrieve conversations with RAG-optimized context
   */
  async getRelevantContext(query: string, currentBiometrics: any, userId: number, limit: number = 10): Promise<any> {
    try {
      // Semantic search for relevant conversations
      const semanticResults = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          userInput
          aiResponse
          effectiveness
          responseStrategy
          heartRate
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          timeOfDay
          conversationContext
          isBreakthrough
          userSatisfaction
        `)
        .withNearText({ concepts: [query] })
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        })
        .withLimit(limit)
        .do();

      // Biometric similarity search
      const biometricResults = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          userInput
          aiResponse
          effectiveness
          responseStrategy
          cognitiveLoad
          attentionLevel
          stressLevel
        `)
        .withWhere({
          operator: 'And',
          operands: [
            { path: ['userId'], operator: 'Equal', valueInt: userId },
            { path: ['cognitiveLoad'], operator: 'GreaterThan', valueNumber: currentBiometrics.cognitiveLoad - 0.15 },
            { path: ['cognitiveLoad'], operator: 'LessThan', valueNumber: currentBiometrics.cognitiveLoad + 0.15 },
            { path: ['effectiveness'], operator: 'GreaterThan', valueNumber: 0.7 }
          ]
        })
        .withLimit(5)
        .do();

      return {
        semantic: semanticResults?.data?.Get?.NexisConversation || [],
        biometric: biometricResults?.data?.Get?.NexisConversation || [],
        combinedInsights: this.extractInsights(semanticResults, biometricResults)
      };
    } catch (error) {
      console.error('Failed to get relevant context from Weaviate:', error);
      return { semantic: [], biometric: [], combinedInsights: [] };
    }
  }

  /**
   * Build LLM context with infinite memory capability
   */
  async buildLLMContext(query: string, currentBiometrics: any, userId: number): Promise<any> {
    try {
      // Get relevant historical context
      const context = await this.getRelevantContext(query, currentBiometrics, userId, 15);
      
      // Get relevant memories
      const memories = await this.getRelevantMemories(query, userId, 5);
      
      // Get optimal response strategies for current biometric state
      const strategies = await this.getOptimalStrategies(currentBiometrics, userId);
      
      // Get knowledge graph connections
      const knowledgeConnections = await this.getKnowledgeConnections(query, userId);

      return {
        instruction: "You are Nexis, a biometric-aware AI with infinite memory and deep personal understanding.",
        currentUserState: {
          biometrics: currentBiometrics,
          query: query,
          timestamp: new Date().toISOString()
        },
        historicalContext: {
          similarConversations: context.semantic,
          biometricMatches: context.biometric,
          insights: context.combinedInsights
        },
        personalMemories: memories,
        optimalStrategies: strategies,
        knowledgeConnections: knowledgeConnections,
        systemPrompt: this.generateDynamicPrompt(currentBiometrics, context, strategies)
      };
    } catch (error) {
      console.error('Failed to build LLM context:', error);
      return this.getMinimalContext(query, currentBiometrics, userId);
    }
  }

  /**
   * Get relevant personal memories
   */
  private async getRelevantMemories(query: string, userId: number, limit: number = 5): Promise<any[]> {
    try {
      const results = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisMemoryNode')
        .withFields(`
          content
          memoryType
          importance
          emotionalValence
          relatedTopics
          retrievalStrength
        `)
        .withNearText({ concepts: [query] })
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        })
        .withLimit(limit)
        .do();

      return results?.data?.Get?.NexisMemoryNode || [];
    } catch (error) {
      console.error('Failed to get relevant memories:', error);
      return [];
    }
  }

  /**
   * Get optimal response strategies for current biometric state
   */
  private async getOptimalStrategies(biometrics: any, userId: number): Promise<string[]> {
    try {
      const results = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisBiometricPattern')
        .withFields(`
          patternName
          optimalStrategies
          successRate
        `)
        .withWhere({
          operator: 'And',
          operands: [
            { path: ['cognitiveLoadMin'], operator: 'LessThanEqual', valueNumber: biometrics.cognitiveLoad },
            { path: ['cognitiveLoadMax'], operator: 'GreaterThanEqual', valueNumber: biometrics.cognitiveLoad },
            { path: ['stressMin'], operator: 'LessThanEqual', valueNumber: biometrics.stressLevel },
            { path: ['stressMax'], operator: 'GreaterThanEqual', valueNumber: biometrics.stressLevel }
          ]
        })
        .withSort([{ path: ['successRate'], order: 'desc' }])
        .withLimit(3)
        .do();

      const patterns = results?.data?.Get?.NexisBiometricPattern || [];
      return patterns.flatMap(p => p.optimalStrategies || []);
    } catch (error) {
      console.error('Failed to get optimal strategies:', error);
      return ['Be supportive and clear', 'Adapt to user pace', 'Provide actionable guidance'];
    }
  }

  /**
   * Get knowledge graph connections
   */
  private async getKnowledgeConnections(query: string, userId: number): Promise<any[]> {
    try {
      const results = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisKnowledgeGraph')
        .withFields(`
          concept
          definition
          examples
          connections
          masteryLevel
        `)
        .withNearText({ concepts: [query] })
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueInt: userId
        })
        .withLimit(5)
        .do();

      return results?.data?.Get?.NexisKnowledgeGraph || [];
    } catch (error) {
      console.error('Failed to get knowledge connections:', error);
      return [];
    }
  }

  /**
   * Extract insights from conversation data
   */
  private extractInsights(semanticResults: any, biometricResults: any): string[] {
    const insights = [];
    
    try {
      const semantic = semanticResults?.data?.Get?.NexisConversation || [];
      const biometric = biometricResults?.data?.Get?.NexisConversation || [];
      
      if (semantic.length > 0) {
        const avgEffectiveness = semantic.reduce((sum, conv) => sum + (conv.effectiveness || 0), 0) / semantic.length;
        insights.push(`Similar conversations have ${(avgEffectiveness * 100).toFixed(0)}% average effectiveness`);
        
        const strategies = semantic.map(conv => conv.responseStrategy).filter(Boolean);
        if (strategies.length > 0) {
          const mostCommon = strategies.reduce((a, b, i, arr) => 
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
          );
          insights.push(`Most effective strategy historically: ${mostCommon}`);
        }
      }
      
      if (biometric.length > 0) {
        insights.push(`Found ${biometric.length} conversations in similar biometric state`);
        const breakthroughs = semantic.filter(conv => conv.isBreakthrough).length;
        if (breakthroughs > 0) {
          insights.push(`${breakthroughs} breakthrough moments in similar contexts`);
        }
      }
    } catch (error) {
      console.error('Failed to extract insights:', error);
    }
    
    return insights;
  }

  /**
   * Generate dynamic prompt based on full context
   */
  private generateDynamicPrompt(biometrics: any, context: any, strategies: string[]): string {
    const prompts = [];

    // Biometric-based adaptations
    if (biometrics.cognitiveLoad > 0.8) {
      prompts.push("User has high cognitive load. Break down complex concepts into simple, digestible steps.");
    } else if (biometrics.cognitiveLoad < 0.3) {
      prompts.push("User has low cognitive load. You can provide detailed, comprehensive information.");
    }

    if (biometrics.flowState > 0.7) {
      prompts.push("User is in flow state. Match their momentum with direct, technical responses.");
    }

    if (biometrics.stressLevel > 0.6) {
      prompts.push("User shows stress indicators. Be calming, supportive, and solution-focused.");
    }

    // Historical context adaptations
    if (context.semantic?.length > 0) {
      prompts.push("Reference relevant past conversations to build continuity and personal connection.");
    }

    // Strategy integration
    if (strategies.length > 0) {
      prompts.push(`Proven effective strategies for this user: ${strategies.slice(0, 2).join(', ')}`);
    }

    return prompts.length > 0 
      ? prompts.join(' ') 
      : "Respond with empathy and intelligence, adapting to the user's current state and history.";
  }

  /**
   * Minimal context fallback
   */
  private getMinimalContext(query: string, biometrics: any, userId: number): any {
    return {
      instruction: "You are Nexis, a helpful AI assistant.",
      currentUserState: { biometrics, query, timestamp: new Date().toISOString() },
      historicalContext: { similarConversations: [], biometricMatches: [], insights: [] },
      personalMemories: [],
      optimalStrategies: ['Be helpful and clear'],
      knowledgeConnections: [],
      systemPrompt: "Respond helpfully while being mindful of the user's current state."
    };
  }

  /**
   * Store memory in long-term knowledge base
   */
  async storeMemory(memory: WeaviateMemoryNode): Promise<string> {
    try {
      const result = await this.weaviateClient.data
        .creator()
        .withClassName('NexisMemoryNode')
        .withProperties({
          userId: memory.userId,
          content: memory.content,
          memoryType: memory.memoryType,
          importance: memory.importance,
          lastAccessed: memory.lastAccessed,
          accessCount: memory.accessCount,
          emotionalValence: memory.emotionalValence,
          relatedTopics: memory.relatedTopics,
          biometricContextHR: memory.biometricContext?.heartRate || 0,
          biometricContextStress: memory.biometricContext?.stressLevel || 0,
          retrievalStrength: memory.retrievalStrength
        })
        .do();

      return result.id;
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Learn patterns from conversation effectiveness
   */
  async learnFromConversations(userId: number): Promise<void> {
    try {
      // Get all high-effectiveness conversations
      const conversations = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          effectiveness
          responseStrategy
          heartRate
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          isBreakthrough
        `)
        .withWhere({
          operator: 'And',
          operands: [
            { path: ['userId'], operator: 'Equal', valueInt: userId },
            { path: ['effectiveness'], operator: 'GreaterThan', valueNumber: 0.7 }
          ]
        })
        .withLimit(100)
        .do();

      const data = conversations?.data?.Get?.NexisConversation || [];
      
      if (data.length < 5) {
        console.log('Insufficient conversation data for pattern learning');
        return;
      }

      // Analyze and store patterns
      const patterns = this.analyzeConversationPatterns(data);
      
      for (const pattern of patterns) {
        await this.storeBiometricPattern(pattern);
      }

      console.log(`Learned ${patterns.length} new biometric patterns from conversations`);
    } catch (error) {
      console.error('Failed to learn from conversations:', error);
    }
  }

  /**
   * Analyze conversation patterns for learning
   */
  private analyzeConversationPatterns(conversations: any[]): WeaviateBiometricPattern[] {
    const patterns: WeaviateBiometricPattern[] = [];

    // Group by similar biometric states
    const groups = this.groupBySimilarBiometrics(conversations);

    for (const [groupName, groupData] of Object.entries(groups)) {
      if (groupData.length < 3) continue;

      const pattern: WeaviateBiometricPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patternName: groupName,
        biometricSignature: this.calculateBiometricSignature(groupData),
        optimalStrategies: this.extractOptimalStrategies(groupData),
        triggerConditions: this.identifyTriggerConditions(groupData),
        successRate: groupData.reduce((sum, conv) => sum + conv.effectiveness, 0) / groupData.length,
        learnedFrom: groupData.length,
        lastUpdated: new Date().toISOString()
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Group conversations by similar biometric signatures
   */
  private groupBySimilarBiometrics(conversations: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'high_flow': [],
      'high_stress': [],
      'deep_focus': [],
      'creative_state': [],
      'learning_mode': []
    };

    for (const conv of conversations) {
      if (conv.flowState > 0.7) {
        groups.high_flow.push(conv);
      } else if (conv.stressLevel > 0.7) {
        groups.high_stress.push(conv);
      } else if (conv.attentionLevel > 0.8 && conv.cognitiveLoad > 0.6) {
        groups.deep_focus.push(conv);
      } else if (conv.cognitiveLoad < 0.5 && conv.attentionLevel > 0.6) {
        groups.creative_state.push(conv);
      } else {
        groups.learning_mode.push(conv);
      }
    }

    return groups;
  }

  /**
   * Calculate biometric signature for pattern
   */
  private calculateBiometricSignature(conversations: any[]): WeaviateBiometricPattern['biometricSignature'] {
    const metrics = ['heartRate', 'stressLevel', 'attentionLevel', 'cognitiveLoad', 'flowState'];
    const signature: any = {};

    for (const metric of metrics) {
      const values = conversations.map(c => c[metric]).filter(v => v != null);
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        signature[`${metric}Range`] = [min, max];
      }
    }

    return signature;
  }

  /**
   * Extract optimal strategies from successful conversations
   */
  private extractOptimalStrategies(conversations: any[]): string[] {
    const strategies = conversations
      .map(c => c.responseStrategy)
      .filter(Boolean)
      .reduce((acc, strategy) => {
        acc[strategy] = (acc[strategy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(strategies)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([strategy]) => strategy);
  }

  /**
   * Identify trigger conditions for patterns
   */
  private identifyTriggerConditions(conversations: any[]): string[] {
    const conditions = [];
    
    const avgCognitiveLoad = conversations.reduce((sum, c) => sum + (c.cognitiveLoad || 0), 0) / conversations.length;
    const avgStress = conversations.reduce((sum, c) => sum + (c.stressLevel || 0), 0) / conversations.length;
    const avgAttention = conversations.reduce((sum, c) => sum + (c.attentionLevel || 0), 0) / conversations.length;

    if (avgCognitiveLoad > 0.7) conditions.push('High cognitive engagement');
    if (avgStress > 0.6) conditions.push('Elevated stress response');
    if (avgAttention > 0.8) conditions.push('High attention focus');
    
    return conditions;
  }

  /**
   * Store learned biometric pattern
   */
  private async storeBiometricPattern(pattern: WeaviateBiometricPattern): Promise<void> {
    try {
      await this.weaviateClient.data
        .creator()
        .withClassName('NexisBiometricPattern')
        .withProperties({
          patternName: pattern.patternName,
          heartRateMin: pattern.biometricSignature.heartRateRange?.[0] || 0,
          heartRateMax: pattern.biometricSignature.heartRateRange?.[1] || 200,
          stressMin: pattern.biometricSignature.stressRange?.[0] || 0,
          stressMax: pattern.biometricSignature.stressRange?.[1] || 1,
          attentionMin: pattern.biometricSignature.attentionRange?.[0] || 0,
          attentionMax: pattern.biometricSignature.attentionRange?.[1] || 1,
          cognitiveLoadMin: pattern.biometricSignature.cognitiveLoadRange?.[0] || 0,
          cognitiveLoadMax: pattern.biometricSignature.cognitiveLoadRange?.[1] || 1,
          flowStateMin: pattern.biometricSignature.flowStateRange?.[0] || 0,
          flowStateMax: pattern.biometricSignature.flowStateRange?.[1] || 1,
          optimalStrategies: pattern.optimalStrategies,
          triggerConditions: pattern.triggerConditions,
          successRate: pattern.successRate,
          learnedFrom: pattern.learnedFrom,
          lastUpdated: pattern.lastUpdated
        })
        .do();

      console.log(`Stored biometric pattern: ${pattern.patternName}`);
    } catch (error) {
      console.error(`Failed to store pattern ${pattern.patternName}:`, error);
    }
  }

  /**
   * Get comprehensive storage statistics
   */
  async getStorageStats(): Promise<any> {
    try {
      const stats = await Promise.all([
        this.weaviateClient.graphql.aggregate().withClassName('NexisConversation').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisMemoryNode').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisBiometricPattern').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisKnowledgeGraph').withFields('meta { count }').do()
      ]);

      return {
        initialized: this.initialized,
        mode: 'primary_storage',
        conversations: stats[0]?.data?.Aggregate?.NexisConversation?.[0]?.meta?.count || 0,
        memories: stats[1]?.data?.Aggregate?.NexisMemoryNode?.[0]?.meta?.count || 0,
        patterns: stats[2]?.data?.Aggregate?.NexisBiometricPattern?.[0]?.meta?.count || 0,
        knowledge: stats[3]?.data?.Aggregate?.NexisKnowledgeGraph?.[0]?.meta?.count || 0,
        totalStorage: (stats[0]?.data?.Aggregate?.NexisConversation?.[0]?.meta?.count || 0) +
                     (stats[1]?.data?.Aggregate?.NexisMemoryNode?.[0]?.meta?.count || 0) +
                     (stats[2]?.data?.Aggregate?.NexisBiometricPattern?.[0]?.meta?.count || 0) +
                     (stats[3]?.data?.Aggregate?.NexisKnowledgeGraph?.[0]?.meta?.count || 0),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { initialized: false, error: error.message };
    }
  }
}

export const weaviatePrimaryStorage = new WeaviatePrimaryStorage();