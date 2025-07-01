// Import will be resolved at runtime
import { storage } from '../storage.js';
import type { BiometricData } from '../../shared/schema.js';

export interface ConversationData {
  id: string;
  userMessage: string;
  aiResponse: string;
  fullHistory: string;
  effectiveness: number;
  biometrics: {
    heartRate: number;
    hrv: number;
    stress: number;
    attention: number;
    cognitiveLoad: number;
    flow: number;
  };
  ndMarkers: {
    hyperfocus: boolean;
    switches: number;
    sensoryLoad: number;
    execFunction: number;
  };
  environment: {
    soundLevel: number;
    lightLevel: number;
    temperature: number;
    timeOfDay: string;
  };
}

export interface BiometricPattern {
  patternName: string;
  biometricSignature: Record<string, number>;
  optimalResponseStrategies: string[];
  triggerConditions: string[];
}

export interface LLMContext {
  instruction: string;
  currentUserState: {
    biometrics: any;
    query: string;
  };
  relevantHistory: any[];
  similarBiometricStates: any[];
  systemPrompt: string;
}

export class NexisBrain {
  private weaviateClient: any;

  constructor() {
    // Will be set during initialization
    this.weaviateClient = null;
  }

  /**
   * Initialize Nexis brain with required Weaviate schemas
   */
  async initialize(): Promise<void> {
    try {
      // Import vector service dynamically
      const { vectorDatabase } = await import('./vector-database.js');
      this.weaviateClient = vectorDatabase.getClient();
      
      await this.createNexisSchemas();
      console.log('Nexis Brain initialized with Weaviate schemas');
    } catch (error) {
      console.error('Failed to initialize Nexis Brain:', error);
      this.weaviateClient = null;
      // Don't throw to allow rest of app to work
    }
  }

  /**
   * Create all required Weaviate classes for Nexis
   */
  private async createNexisSchemas(): Promise<void> {
    const schemas = this.getNexisSchemas();
    
    for (const schema of schemas) {
      try {
        // Check if class already exists
        const exists = await this.weaviateClient.schema.exists(schema.class);
        if (!exists) {
          await this.weaviateClient.schema.classCreator().withClass(schema).do();
          console.log(`Created Weaviate class: ${schema.class}`);
        }
      } catch (error) {
        console.warn(`Failed to create class ${schema.class}:`, error);
      }
    }
  }

  /**
   * Get Nexis Weaviate schema definitions
   */
  private getNexisSchemas(): any[] {
    return [
      {
        class: "NexisConversation",
        description: "Complete conversation with biometric context",
        vectorizer: "text2vec-transformers",
        properties: [
          {
            name: "conversationId",
            dataType: ["string"],
            description: "Unique conversation identifier"
          },
          {
            name: "timestamp",
            dataType: ["date"],
            description: "When this conversation happened"
          },
          {
            name: "userMessage",
            dataType: ["text"],
            description: "What the user said"
          },
          {
            name: "aiResponse",
            dataType: ["text"],
            description: "What the AI responded"
          },
          {
            name: "conversationContext",
            dataType: ["text"],
            description: "Full conversation history up to this point"
          },
          {
            name: "effectivenessScore",
            dataType: ["number"],
            description: "How effective was this response (0-1)"
          },
          {
            name: "heartRate",
            dataType: ["number"],
            description: "Heart rate during interaction"
          },
          {
            name: "hrvSDNN",
            dataType: ["number"],
            description: "Heart rate variability"
          },
          {
            name: "stressLevel",
            dataType: ["number"],
            description: "Stress level (0-1)"
          },
          {
            name: "attentionLevel",
            dataType: ["number"],
            description: "Attention level (0-1)"
          },
          {
            name: "cognitiveLoad",
            dataType: ["number"],
            description: "Cognitive load (0-1)"
          },
          {
            name: "flowState",
            dataType: ["number"],
            description: "Flow state indicator (0-1)"
          },
          {
            name: "hyperfocusActive",
            dataType: ["boolean"],
            description: "Whether hyperfocus is detected"
          },
          {
            name: "contextSwitchCount",
            dataType: ["int"],
            description: "Number of context switches"
          },
          {
            name: "sensoryLoadLevel",
            dataType: ["number"],
            description: "Sensory processing load"
          },
          {
            name: "executiveFunctionLoad",
            dataType: ["number"],
            description: "Executive function load"
          },
          {
            name: "soundLevel",
            dataType: ["number"],
            description: "Environmental sound level"
          },
          {
            name: "lightLevel",
            dataType: ["number"],
            description: "Environmental light level"
          },
          {
            name: "temperature",
            dataType: ["number"],
            description: "Environmental temperature"
          },
          {
            name: "timeOfDay",
            dataType: ["string"],
            description: "Time of day category"
          }
        ]
      },
      {
        class: "NexisMemoryNode",
        description: "Individual memory/knowledge nodes",
        vectorizer: "text2vec-transformers",
        properties: [
          {
            name: "content",
            dataType: ["text"],
            description: "The actual memory content"
          },
          {
            name: "memoryType",
            dataType: ["string"],
            description: "Type: fact, experience, preference, skill"
          },
          {
            name: "importance",
            dataType: ["number"],
            description: "How important is this memory (0-1)"
          },
          {
            name: "lastAccessed",
            dataType: ["date"],
            description: "When this memory was last accessed"
          },
          {
            name: "accessCount",
            dataType: ["int"],
            description: "How many times accessed"
          },
          {
            name: "emotionalValence",
            dataType: ["number"],
            description: "Emotional association (-1 to 1)"
          }
        ]
      },
      {
        class: "NexisBiometricPattern",
        description: "Learned biometric patterns for different cognitive states",
        properties: [
          {
            name: "patternName",
            dataType: ["string"],
            description: "e.g., 'deep_focus', 'creative_flow', 'stress_response'"
          },
          {
            name: "heartRateMin",
            dataType: ["number"],
            description: "Minimum heart rate for this pattern"
          },
          {
            name: "heartRateMax",
            dataType: ["number"],
            description: "Maximum heart rate for this pattern"
          },
          {
            name: "stressLevelMin",
            dataType: ["number"],
            description: "Minimum stress level"
          },
          {
            name: "stressLevelMax",
            dataType: ["number"],
            description: "Maximum stress level"
          },
          {
            name: "attentionLevelMin",
            dataType: ["number"],
            description: "Minimum attention level"
          },
          {
            name: "attentionLevelMax",
            dataType: ["number"],
            description: "Maximum attention level"
          },
          {
            name: "optimalResponseStrategies",
            dataType: ["string[]"],
            description: "Best ways to respond in this state"
          },
          {
            name: "triggerConditions",
            dataType: ["string[]"],
            description: "What triggers this pattern"
          }
        ]
      },
      {
        class: "NexisPromptTemplate",
        description: "Effective prompt templates with context",
        properties: [
          {
            name: "template",
            dataType: ["text"],
            description: "The prompt template content"
          },
          {
            name: "effectiveness",
            dataType: ["number"],
            description: "How effective this template is (0-1)"
          },
          {
            name: "bestForCognitiveState",
            dataType: ["string[]"],
            description: "Which cognitive states this works best in"
          },
          {
            name: "category",
            dataType: ["string"],
            description: "Template category"
          },
          {
            name: "usageCount",
            dataType: ["int"],
            description: "How many times this template was used"
          }
        ]
      }
    ];
  }

  /**
   * Store a conversation with full biometric and contextual data
   */
  async storeConversation(conversationData: ConversationData): Promise<string> {
    try {
      const properties = {
        conversationId: conversationData.id,
        timestamp: new Date().toISOString(),
        userMessage: conversationData.userMessage,
        aiResponse: conversationData.aiResponse,
        conversationContext: conversationData.fullHistory,
        effectivenessScore: conversationData.effectiveness,
        heartRate: conversationData.biometrics.heartRate,
        hrvSDNN: conversationData.biometrics.hrv,
        stressLevel: conversationData.biometrics.stress,
        attentionLevel: conversationData.biometrics.attention,
        cognitiveLoad: conversationData.biometrics.cognitiveLoad,
        flowState: conversationData.biometrics.flow,
        hyperfocusActive: conversationData.ndMarkers.hyperfocus,
        contextSwitchCount: conversationData.ndMarkers.switches,
        sensoryLoadLevel: conversationData.ndMarkers.sensoryLoad,
        executiveFunctionLoad: conversationData.ndMarkers.execFunction,
        soundLevel: conversationData.environment.soundLevel,
        lightLevel: conversationData.environment.lightLevel,
        temperature: conversationData.environment.temperature,
        timeOfDay: conversationData.environment.timeOfDay
      };

      const result = await this.weaviateClient.data
        .creator()
        .withClassName('NexisConversation')
        .withProperties(properties)
        .do();

      console.log(`Stored conversation ${conversationData.id} in Nexis Brain`);
      return result.id;
    } catch (error) {
      console.error('Failed to store conversation:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant context for intelligent responses
   */
  async getRelevantContext(query: string, currentBiometrics: any): Promise<any> {
    try {
      // Semantic search for similar conversations
      const semanticResults = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          userMessage 
          aiResponse 
          effectivenessScore 
          heartRate 
          stressLevel 
          attentionLevel 
          cognitiveLoad
          flowState
        `)
        .withNearText({ concepts: [query] })
        .withLimit(5)
        .do();

      // Search for similar biometric states
      const biometricResults = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          userMessage
          aiResponse
          effectivenessScore
          cognitiveLoad
          attentionLevel
          stressLevel
        `)
        .withWhere({
          operator: 'And',
          operands: [
            {
              path: ['cognitiveLoad'],
              operator: 'GreaterThan',
              valueNumber: Math.max(0, currentBiometrics.cognitiveLoad - 0.1)
            },
            {
              path: ['cognitiveLoad'],
              operator: 'LessThan',
              valueNumber: Math.min(1, currentBiometrics.cognitiveLoad + 0.1)
            },
            {
              path: ['effectivenessScore'],
              operator: 'GreaterThan',
              valueNumber: 0.7
            }
          ]
        })
        .withLimit(3)
        .do();

      return {
        semantic: semanticResults?.data?.Get?.NexisConversation || [],
        biometric: biometricResults?.data?.Get?.NexisConversation || []
      };
    } catch (error) {
      console.error('Failed to get relevant context:', error);
      return { semantic: [], biometric: [] };
    }
  }

  /**
   * Learn and store biometric patterns from historical data
   */
  async learnBiometricPatterns(): Promise<void> {
    try {
      // Get high-effectiveness conversations for pattern learning
      const conversations = await this.weaviateClient.graphql
        .get()
        .withClassName('NexisConversation')
        .withFields(`
          heartRate
          stressLevel
          attentionLevel
          cognitiveLoad
          flowState
          effectivenessScore
        `)
        .withWhere({
          path: ['effectivenessScore'],
          operator: 'GreaterThan',
          valueNumber: 0.8
        })
        .withLimit(100)
        .do();

      const data = conversations?.data?.Get?.NexisConversation || [];
      
      if (data.length < 10) {
        console.log('Insufficient data for pattern learning');
        return;
      }

      // Analyze patterns
      const patterns = this.analyzeBiometricPatterns(data);
      
      // Store learned patterns
      for (const pattern of patterns) {
        await this.storeBiometricPattern(pattern);
      }

      console.log(`Learned and stored ${patterns.length} biometric patterns`);
    } catch (error) {
      console.error('Failed to learn biometric patterns:', error);
    }
  }

  /**
   * Analyze biometric data to identify patterns
   */
  private analyzeBiometricPatterns(data: any[]): BiometricPattern[] {
    const patterns: BiometricPattern[] = [];

    // Deep focus pattern (low stress, high attention, moderate-high cognitive load)
    const deepFocusData = data.filter(d => 
      d.stressLevel < 0.3 && 
      d.attentionLevel > 0.7 && 
      d.cognitiveLoad > 0.6 && 
      d.cognitiveLoad < 0.9
    );

    if (deepFocusData.length > 5) {
      patterns.push({
        patternName: 'deep_focus',
        biometricSignature: this.calculateSignature(deepFocusData),
        optimalResponseStrategies: [
          'Be direct and technical',
          'Provide comprehensive information',
          'Match the user\'s analytical pace',
          'Avoid interrupting the flow'
        ],
        triggerConditions: [
          'Low stress with high attention',
          'Sustained cognitive engagement',
          'Minimal environmental distractions'
        ]
      });
    }

    // Creative flow pattern (moderate stress, high attention, variable cognitive load)
    const creativeFlowData = data.filter(d => 
      d.stressLevel > 0.2 && 
      d.stressLevel < 0.6 && 
      d.attentionLevel > 0.6 && 
      d.flowState > 0.7
    );

    if (creativeFlowData.length > 5) {
      patterns.push({
        patternName: 'creative_flow',
        biometricSignature: this.calculateSignature(creativeFlowData),
        optimalResponseStrategies: [
          'Encourage exploration',
          'Provide inspirational examples',
          'Ask open-ended questions',
          'Support divergent thinking'
        ],
        triggerConditions: [
          'Balanced arousal state',
          'High flow indicators',
          'Creative task engagement'
        ]
      });
    }

    // Stress response pattern (high stress, variable attention)
    const stressData = data.filter(d => d.stressLevel > 0.7);

    if (stressData.length > 3) {
      patterns.push({
        patternName: 'stress_response',
        biometricSignature: this.calculateSignature(stressData),
        optimalResponseStrategies: [
          'Be calming and supportive',
          'Break down complex tasks',
          'Offer reassurance',
          'Suggest stress management techniques'
        ],
        triggerConditions: [
          'Elevated stress markers',
          'Rapid heart rate changes',
          'Decreased attention stability'
        ]
      });
    }

    return patterns;
  }

  /**
   * Calculate biometric signature for a pattern
   */
  private calculateSignature(data: any[]): Record<string, number> {
    const signature: Record<string, number> = {};
    
    const metrics = ['heartRate', 'stressLevel', 'attentionLevel', 'cognitiveLoad', 'flowState'];
    
    for (const metric of metrics) {
      const values = data.map(d => d[metric]).filter(v => v !== undefined && v !== null);
      if (values.length > 0) {
        signature[`${metric}_mean`] = values.reduce((a, b) => a + b, 0) / values.length;
        signature[`${metric}_std`] = this.calculateStandardDeviation(values);
      }
    }
    
    return signature;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Store a learned biometric pattern
   */
  private async storeBiometricPattern(pattern: BiometricPattern): Promise<void> {
    try {
      const properties = {
        patternName: pattern.patternName,
        heartRateMin: pattern.biometricSignature.heartRate_mean - pattern.biometricSignature.heartRate_std,
        heartRateMax: pattern.biometricSignature.heartRate_mean + pattern.biometricSignature.heartRate_std,
        stressLevelMin: Math.max(0, pattern.biometricSignature.stressLevel_mean - pattern.biometricSignature.stressLevel_std),
        stressLevelMax: Math.min(1, pattern.biometricSignature.stressLevel_mean + pattern.biometricSignature.stressLevel_std),
        attentionLevelMin: Math.max(0, pattern.biometricSignature.attentionLevel_mean - pattern.biometricSignature.attentionLevel_std),
        attentionLevelMax: Math.min(1, pattern.biometricSignature.attentionLevel_mean + pattern.biometricSignature.attentionLevel_std),
        optimalResponseStrategies: pattern.optimalResponseStrategies,
        triggerConditions: pattern.triggerConditions
      };

      await this.weaviateClient.data
        .creator()
        .withClassName('NexisBiometricPattern')
        .withProperties(properties)
        .do();

      console.log(`Stored biometric pattern: ${pattern.patternName}`);
    } catch (error) {
      console.error(`Failed to store pattern ${pattern.patternName}:`, error);
    }
  }

  /**
   * Build comprehensive LLM context for intelligent responses
   */
  async buildLLMContext(currentQuery: string, currentBiometrics: any): Promise<LLMContext> {
    try {
      const relevantMemories = await this.getRelevantContext(currentQuery, currentBiometrics);
      const dynamicPrompt = this.generateDynamicPrompt(currentBiometrics);

      return {
        instruction: "You are Nexis, a neurodivergent-optimized AI assistant with biometric awareness.",
        currentUserState: {
          biometrics: currentBiometrics,
          query: currentQuery
        },
        relevantHistory: relevantMemories.semantic,
        similarBiometricStates: relevantMemories.biometric,
        systemPrompt: dynamicPrompt
      };
    } catch (error) {
      console.error('Failed to build LLM context:', error);
      return this.getDefaultContext(currentQuery, currentBiometrics);
    }
  }

  /**
   * Generate dynamic prompt based on current biometric state
   */
  private generateDynamicPrompt(biometrics: any): string {
    const prompts = [];

    // Cognitive load analysis
    if (biometrics.cognitiveLoad > 0.8) {
      prompts.push("User is experiencing high cognitive load. Be extra clear, break down complex ideas into simple steps, and avoid overwhelming details.");
    } else if (biometrics.cognitiveLoad < 0.3) {
      prompts.push("User has low cognitive load. You can provide more detailed and complex information.");
    }

    // Flow state detection
    if (biometrics.flowState > 0.7) {
      prompts.push("User is in flow state. Match their pace and depth. Be direct, technical, and avoid interrupting their momentum.");
    }

    // Stress level management
    if (biometrics.stressLevel > 0.6) {
      prompts.push("User stress detected. Be calming, supportive, and solution-focused. Offer reassurance and break tasks into manageable pieces.");
    }

    // Attention level adaptation
    if (biometrics.attentionLevel < 0.4) {
      prompts.push("User attention is low. Use engaging language, provide clear structure, and highlight key points.");
    } else if (biometrics.attentionLevel > 0.8) {
      prompts.push("User attention is high. You can provide detailed, nuanced responses.");
    }

    // Heart rate variability insights
    if (biometrics.hrv < 20) {
      prompts.push("Low HRV detected, indicating potential fatigue or stress. Suggest shorter tasks and recovery periods.");
    }

    return prompts.length > 0 
      ? prompts.join(' ') 
      : "Respond naturally while being aware of the user's current state.";
  }

  /**
   * Get default context when sophisticated analysis fails
   */
  private getDefaultContext(currentQuery: string, currentBiometrics: any): LLMContext {
    return {
      instruction: "You are Nexis, an AI assistant optimized for biometric-aware interactions.",
      currentUserState: {
        biometrics: currentBiometrics,
        query: currentQuery
      },
      relevantHistory: [],
      similarBiometricStates: [],
      systemPrompt: "Respond helpfully while being mindful of the user's physiological state."
    };
  }

  /**
   * Store a memory node for long-term learning
   */
  async storeMemory(content: string, type: 'fact' | 'experience' | 'preference' | 'skill', importance: number = 0.5): Promise<void> {
    try {
      await this.weaviateClient.data
        .creator()
        .withClassName('NexisMemoryNode')
        .withProperties({
          content,
          memoryType: type,
          importance,
          lastAccessed: new Date().toISOString(),
          accessCount: 1,
          emotionalValence: 0
        })
        .do();

      console.log(`Stored ${type} memory: ${content.substring(0, 50)}...`);
    } catch (error) {
      console.error('Failed to store memory:', error);
    }
  }

  /**
   * Get service status and statistics
   */
  async getStatus(): Promise<any> {
    try {
      const stats = await Promise.all([
        this.weaviateClient.graphql.aggregate().withClassName('NexisConversation').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisMemoryNode').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisBiometricPattern').withFields('meta { count }').do(),
        this.weaviateClient.graphql.aggregate().withClassName('NexisPromptTemplate').withFields('meta { count }').do()
      ]);

      return {
        initialized: true,
        conversations: stats[0]?.data?.Aggregate?.NexisConversation?.[0]?.meta?.count || 0,
        memories: stats[1]?.data?.Aggregate?.NexisMemoryNode?.[0]?.meta?.count || 0,
        patterns: stats[2]?.data?.Aggregate?.NexisBiometricPattern?.[0]?.meta?.count || 0,
        templates: stats[3]?.data?.Aggregate?.NexisPromptTemplate?.[0]?.meta?.count || 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get Nexis status:', error);
      return { initialized: false, error: error.message };
    }
  }
}

export const nexisBrain = new NexisBrain();