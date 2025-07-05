import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { logger } from '../../utils/logger.js';
import { BiometricEmbeddings } from './biometricEmbeddings.js';

export interface InteractionData {
  userId: string;
  sessionId: string;
  prompt: string;
  response: string;
  timestamp: Date;
  cognitiveLoad: number;
  attentionLevel: number;
  flowState: boolean;
  neurodivergentPatterns: string[];
  contextualTags: string[];
  satisfactionScore?: number;
  completionTime?: number;
}

export interface PersonalMemory {
  id: string;
  userId: string;
  sessionId: string;
  content: string;
  interactionType: 'prompt' | 'response' | 'context';
  cognitiveLoad: number;
  attentionLevel: number;
  flowState: boolean;
  neurodivergentPatterns: string[];
  contextualTags: string[];
  timestamp: Date;
  satisfactionScore?: number;
  completionTime?: number;
  embedding?: number[];
}

export interface MemoryQuery {
  userId: string;
  query: string;
  cognitiveState?: {
    cognitiveLoad: number;
    attentionLevel: number;
    flowState: boolean;
    neurodivergentPatterns: string[];
  };
  limit?: number;
  relevanceThreshold?: number;
}

export class PersonalMemoryService {
  private client: WeaviateClient;
  private biometricEmbeddings: BiometricEmbeddings;
  private readonly className = 'PersonalMemory';

  constructor(weaviateUrl: string = 'http://weaviate:8080') {
    this.client = weaviate.client({
      scheme: 'http',
      host: weaviateUrl.replace('http://', '').replace('https://', ''),
    });
    this.biometricEmbeddings = new BiometricEmbeddings();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Personal Memory Service');
      
      // Check if schema exists, create if not
      const schemaExists = await this.checkSchemaExists();
      if (!schemaExists) {
        await this.createSchema();
        logger.info('Personal Memory schema created');
      } else {
        logger.info('Personal Memory schema already exists');
      }
    } catch (error) {
      logger.error('Failed to initialize Personal Memory Service:', error);
      throw error;
    }
  }

  async storeInteraction(interactionData: InteractionData): Promise<void> {
    try {
      logger.debug('Storing interaction in personal memory', {
        userId: interactionData.userId,
        sessionId: interactionData.sessionId,
        cognitiveLoad: interactionData.cognitiveLoad
      });

      // Create separate memory entries for prompt and response
      const memoryEntries: PersonalMemory[] = [
        {
          id: `${interactionData.userId}-${interactionData.sessionId}-prompt-${Date.now()}`,
          userId: interactionData.userId,
          sessionId: interactionData.sessionId,
          content: interactionData.prompt,
          interactionType: 'prompt',
          cognitiveLoad: interactionData.cognitiveLoad,
          attentionLevel: interactionData.attentionLevel,
          flowState: interactionData.flowState,
          neurodivergentPatterns: interactionData.neurodivergentPatterns,
          contextualTags: interactionData.contextualTags,
          timestamp: interactionData.timestamp,
          satisfactionScore: interactionData.satisfactionScore,
          completionTime: interactionData.completionTime
        },
        {
          id: `${interactionData.userId}-${interactionData.sessionId}-response-${Date.now()}`,
          userId: interactionData.userId,
          sessionId: interactionData.sessionId,
          content: interactionData.response,
          interactionType: 'response',
          cognitiveLoad: interactionData.cognitiveLoad,
          attentionLevel: interactionData.attentionLevel,
          flowState: interactionData.flowState,
          neurodivergentPatterns: interactionData.neurodivergentPatterns,
          contextualTags: interactionData.contextualTags,
          timestamp: interactionData.timestamp,
          satisfactionScore: interactionData.satisfactionScore,
          completionTime: interactionData.completionTime
        }
      ];

      // Generate biometric-enhanced embeddings for each entry
      for (const memory of memoryEntries) {
        memory.embedding = await this.biometricEmbeddings.generateBiometricEmbedding(
          memory.content,
          {
            cognitiveLoad: memory.cognitiveLoad,
            attentionLevel: memory.attentionLevel,
            flowState: memory.flowState,
            activePatterns: memory.neurodivergentPatterns,
            timestamp: memory.timestamp
          }
        );

        // Store in Weaviate
        await this.storeMemoryEntry(memory);
      }

      logger.debug('Interaction stored successfully in personal memory');
    } catch (error) {
      logger.error('Failed to store interaction:', error);
      throw new Error('Failed to store interaction in personal memory');
    }
  }

  async retrieveRelevant(query: MemoryQuery): Promise<PersonalMemory[]> {
    try {
      logger.debug('Retrieving relevant memories', {
        userId: query.userId,
        query: query.query.substring(0, 50) + '...',
        cognitiveLoad: query.cognitiveState?.cognitiveLoad
      });

      // Generate embedding for the query with current cognitive state
      const queryEmbedding = await this.biometricEmbeddings.generateBiometricEmbedding(
        query.query,
        query.cognitiveState || {
          cognitiveLoad: 0.5,
          attentionLevel: 0.5,
          flowState: false,
          activePatterns: [],
          timestamp: new Date()
        }
      );

      // Build Weaviate query with cognitive state filtering
      let weaviateQuery = this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields([
          'userId',
          'sessionId', 
          'content',
          'interactionType',
          'cognitiveLoad',
          'attentionLevel',
          'flowState',
          'neurodivergentPatterns',
          'contextualTags',
          'timestamp',
          'satisfactionScore',
          'completionTime',
          '_additional { certainty distance }'
        ])
        .withNearVector({
          vector: queryEmbedding,
          certainty: query.relevanceThreshold || 0.7
        })
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueText: query.userId
        })
        .withLimit(query.limit || 10);

      // Add cognitive state filtering if provided
      if (query.cognitiveState) {
        weaviateQuery = this.addCognitiveStateFiltering(weaviateQuery, query.cognitiveState);
      }

      const result = await weaviateQuery.do();
      const memories = this.formatMemoryResults(result);

      logger.debug('Retrieved relevant memories', {
        userId: query.userId,
        count: memories.length
      });

      return memories;
    } catch (error) {
      logger.error('Failed to retrieve relevant memories:', error);
      throw new Error('Failed to retrieve relevant memories');
    }
  }

  async getMemoryBySession(userId: string, sessionId: string): Promise<PersonalMemory[]> {
    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields([
          'userId', 'sessionId', 'content', 'interactionType',
          'cognitiveLoad', 'attentionLevel', 'flowState',
          'neurodivergentPatterns', 'contextualTags', 'timestamp',
          'satisfactionScore', 'completionTime'
        ])
        .withWhere({
          operator: 'And',
          operands: [
            {
              path: ['userId'],
              operator: 'Equal',
              valueText: userId
            },
            {
              path: ['sessionId'],
              operator: 'Equal',
              valueText: sessionId
            }
          ]
        })
        .withSort([{ path: ['timestamp'], order: 'asc' }])
        .do();

      return this.formatMemoryResults(result);
    } catch (error) {
      logger.error('Failed to get memory by session:', error);
      throw error;
    }
  }

  async getUserMemoryStats(userId: string): Promise<{
    totalInteractions: number;
    averageCognitiveLoad: number;
    flowStatePercentage: number;
    commonPatterns: string[];
    lastInteraction: Date | null;
  }> {
    try {
      const result = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('meta { count } cognitiveLoad { mean } flowState { count }')
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueText: userId
        })
        .do();

      // Get common neurodivergent patterns
      const patternResult = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(['neurodivergentPatterns'])
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueText: userId
        })
        .withLimit(100)
        .do();

      const patternCounts = new Map<string, number>();
      if (patternResult.data?.Get?.[this.className]) {
        for (const item of patternResult.data.Get[this.className]) {
          for (const pattern of item.neurodivergentPatterns || []) {
            patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
          }
        }
      }

      const commonPatterns = Array.from(patternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern]) => pattern);

      // Get last interaction
      const lastResult = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(['timestamp'])
        .withWhere({
          path: ['userId'],
          operator: 'Equal',
          valueText: userId
        })
        .withSort([{ path: ['timestamp'], order: 'desc' }])
        .withLimit(1)
        .do();

      const lastInteraction = lastResult.data?.Get?.[this.className]?.[0]?.timestamp
        ? new Date(lastResult.data.Get[this.className][0].timestamp)
        : null;

      const stats = result.data?.Aggregate?.[this.className]?.[0];
      
      return {
        totalInteractions: stats?.meta?.count || 0,
        averageCognitiveLoad: stats?.cognitiveLoad?.mean || 0,
        flowStatePercentage: stats?.flowState?.count || 0,
        commonPatterns,
        lastInteraction
      };
    } catch (error) {
      logger.error('Failed to get user memory stats:', error);
      throw error;
    }
  }

  private async checkSchemaExists(): Promise<boolean> {
    try {
      const schema = await this.client.schema.getter().do();
      return schema.classes?.some((cls: any) => cls.class === this.className) || false;
    } catch (error) {
      return false;
    }
  }

  private async createSchema(): Promise<void> {
    const schema = {
      class: this.className,
      description: 'Personal memory storage for biometric-aware LLM interactions',
      vectorizer: 'none',
      properties: [
        {
          name: 'userId',
          dataType: ['text'],
          description: 'User identifier'
        },
        {
          name: 'sessionId',
          dataType: ['text'],
          description: 'Session identifier'
        },
        {
          name: 'content',
          dataType: ['text'],
          description: 'Interaction content (prompt or response)'
        },
        {
          name: 'interactionType',
          dataType: ['text'],
          description: 'Type of interaction: prompt, response, or context'
        },
        {
          name: 'cognitiveLoad',
          dataType: ['number'],
          description: 'Cognitive load level (0-1)'
        },
        {
          name: 'attentionLevel',
          dataType: ['number'],
          description: 'Attention level (0-1)'
        },
        {
          name: 'flowState',
          dataType: ['boolean'],
          description: 'Whether user was in flow state'
        },
        {
          name: 'neurodivergentPatterns',
          dataType: ['text[]'],
          description: 'Detected neurodivergent patterns'
        },
        {
          name: 'contextualTags',
          dataType: ['text[]'],
          description: 'Contextual tags for the interaction'
        },
        {
          name: 'timestamp',
          dataType: ['date'],
          description: 'Interaction timestamp'
        },
        {
          name: 'satisfactionScore',
          dataType: ['number'],
          description: 'User satisfaction score (optional)'
        },
        {
          name: 'completionTime',
          dataType: ['number'],
          description: 'Time to complete interaction in milliseconds (optional)'
        }
      ]
    };

    await this.client.schema.classCreator().withClass(schema).do();
  }

  private async storeMemoryEntry(memory: PersonalMemory): Promise<void> {
    await this.client.data
      .creator()
      .withClassName(this.className)
      .withProperties({
        userId: memory.userId,
        sessionId: memory.sessionId,
        content: memory.content,
        interactionType: memory.interactionType,
        cognitiveLoad: memory.cognitiveLoad,
        attentionLevel: memory.attentionLevel,
        flowState: memory.flowState,
        neurodivergentPatterns: memory.neurodivergentPatterns,
        contextualTags: memory.contextualTags,
        timestamp: memory.timestamp.toISOString(),
        satisfactionScore: memory.satisfactionScore,
        completionTime: memory.completionTime
      })
      .withVector(memory.embedding)
      .do();
  }

  private addCognitiveStateFiltering(query: any, cognitiveState: any): any {
    // Add cognitive load range filtering
    const cognitiveLoadRange = 0.2; // ±0.2 range
    query = query.withWhere({
      operator: 'And',
      operands: [
        {
          path: ['cognitiveLoad'],
          operator: 'GreaterThanEqual',
          valueNumber: Math.max(0, cognitiveState.cognitiveLoad - cognitiveLoadRange)
        },
        {
          path: ['cognitiveLoad'],
          operator: 'LessThanEqual',
          valueNumber: Math.min(1, cognitiveState.cognitiveLoad + cognitiveLoadRange)
        }
      ]
    });

    return query;
  }

  private formatMemoryResults(result: any): PersonalMemory[] {
    if (!result.data?.Get?.[this.className]) {
      return [];
    }

    return result.data.Get[this.className].map((item: any) => ({
      id: item.id || '',
      userId: item.userId,
      sessionId: item.sessionId,
      content: item.content,
      interactionType: item.interactionType,
      cognitiveLoad: item.cognitiveLoad,
      attentionLevel: item.attentionLevel,
      flowState: item.flowState,
      neurodivergentPatterns: item.neurodivergentPatterns || [],
      contextualTags: item.contextualTags || [],
      timestamp: new Date(item.timestamp),
      satisfactionScore: item.satisfactionScore,
      completionTime: item.completionTime
    }));
  }
}