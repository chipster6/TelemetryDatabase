import type { WeaviateClient } from 'weaviate-client';

export interface SchemaChange {
  action: 'add' | 'modify' | 'delete';
  className: string;
  property?: {
    name: string;
    dataType: string[];
    description?: string;
  };
  vectorizer?: string;
  description?: string;
}

export interface SchemaInfo {
  className: string;
  description: string;
  properties: SchemaProperty[];
  vectorizer: string;
  exists: boolean;
}

export interface SchemaProperty {
  name: string;
  dataType: string[];
  description?: string;
}

export class SchemaManager {
  constructor(private client: WeaviateClient) {}

  async initializeSchema(): Promise<void> {
    try {
      // Define the conversation schema for biometric context
      const conversationSchema = {
        class: 'Conversation',
        description: 'Stores conversations with full biometric and neurodivergent context',
        vectorizer: 'text2vec-openai',
        properties: [
          // Core conversation properties
          {
            name: 'conversationId',
            dataType: ['text'],
            description: 'Unique conversation identifier'
          },
          {
            name: 'userId',
            dataType: ['int'],
            description: 'User identifier'
          },
          {
            name: 'sessionId',
            dataType: ['text'],
            description: 'Session identifier'
          },
          {
            name: 'timestamp',
            dataType: ['text'],
            description: 'Conversation timestamp'
          },
          {
            name: 'userMessage',
            dataType: ['text'],
            description: 'User input message'
          },
          {
            name: 'aiResponse',
            dataType: ['text'],
            description: 'AI response content'
          },
          {
            name: 'conversationContext',
            dataType: ['text'],
            description: 'Conversation context'
          },
          {
            name: 'conversationType',
            dataType: ['text'],
            description: 'Type of conversation'
          },
          
          // Effectiveness and learning
          {
            name: 'effectivenessScore',
            dataType: ['number'],
            description: 'Conversation effectiveness score'
          },
          {
            name: 'userSatisfaction',
            dataType: ['number'],
            description: 'User satisfaction rating'
          },
          {
            name: 'responseStrategy',
            dataType: ['text'],
            description: 'Response strategy used'
          },
          {
            name: 'isBreakthrough',
            dataType: ['boolean'],
            description: 'Whether this was a breakthrough moment'
          },
          
          // Biometric data
          {
            name: 'heartRate',
            dataType: ['number'],
            description: 'Heart rate during conversation'
          },
          {
            name: 'hrv',
            dataType: ['number'],
            description: 'Heart rate variability'
          },
          {
            name: 'stressLevel',
            dataType: ['number'],
            description: 'Stress level measurement'
          },
          {
            name: 'attentionLevel',
            dataType: ['number'],
            description: 'Attention level measurement'
          },
          {
            name: 'cognitiveLoad',
            dataType: ['number'],
            description: 'Cognitive load measurement'
          },
          {
            name: 'flowState',
            dataType: ['number'],
            description: 'Flow state measurement'
          },
          {
            name: 'arousal',
            dataType: ['number'],
            description: 'Arousal level'
          },
          {
            name: 'valence',
            dataType: ['number'],
            description: 'Emotional valence'
          },
          
          // Neurodivergent markers
          {
            name: 'hyperfocusState',
            dataType: ['boolean'],
            description: 'Whether user was in hyperfocus state'
          },
          {
            name: 'contextSwitches',
            dataType: ['int'],
            description: 'Number of context switches'
          },
          {
            name: 'sensoryLoad',
            dataType: ['number'],
            description: 'Sensory processing load'
          },
          {
            name: 'executiveFunction',
            dataType: ['number'],
            description: 'Executive function measurement'
          },
          {
            name: 'workingMemoryLoad',
            dataType: ['number'],
            description: 'Working memory load'
          },
          {
            name: 'attentionRegulation',
            dataType: ['number'],
            description: 'Attention regulation measurement'
          },
          
          // Environmental context
          {
            name: 'timeOfDay',
            dataType: ['text'],
            description: 'Time of day'
          },
          {
            name: 'dayOfWeek',
            dataType: ['text'],
            description: 'Day of the week'
          },
          {
            name: 'location',
            dataType: ['text'],
            description: 'User location'
          },
          {
            name: 'soundLevel',
            dataType: ['number'],
            description: 'Environmental sound level'
          },
          {
            name: 'lightLevel',
            dataType: ['number'],
            description: 'Environmental light level'
          },
          {
            name: 'temperature',
            dataType: ['number'],
            description: 'Environmental temperature'
          },
          {
            name: 'humidity',
            dataType: ['number'],
            description: 'Environmental humidity'
          },
          {
            name: 'airQuality',
            dataType: ['number'],
            description: 'Air quality measurement'
          }
        ]
      };

      // Define memory schema
      const memorySchema = {
        class: 'Memory',
        description: 'Stores user memories with biometric formation context',
        vectorizer: 'text2vec-openai',
        properties: [
          {
            name: 'memoryId',
            dataType: ['text'],
            description: 'Unique memory identifier'
          },
          {
            name: 'userId',
            dataType: ['int'],
            description: 'User identifier'
          },
          {
            name: 'content',
            dataType: ['text'],
            description: 'Memory content'
          },
          {
            name: 'memoryType',
            dataType: ['text'],
            description: 'Type of memory (fact, experience, preference, skill, insight, pattern)'
          },
          {
            name: 'importance',
            dataType: ['number'],
            description: 'Memory importance score'
          },
          {
            name: 'confidenceLevel',
            dataType: ['number'],
            description: 'Confidence in memory accuracy'
          },
          {
            name: 'emotionalValence',
            dataType: ['number'],
            description: 'Emotional valence of memory'
          },
          {
            name: 'emotionalIntensity',
            dataType: ['number'],
            description: 'Emotional intensity of memory'
          },
          {
            name: 'retrievalStrength',
            dataType: ['number'],
            description: 'Memory retrieval strength'
          },
          {
            name: 'relatedTopics',
            dataType: ['text[]'],
            description: 'Related topics'
          },
          {
            name: 'associatedSkills',
            dataType: ['text[]'],
            description: 'Associated skills'
          },
          {
            name: 'createdAt',
            dataType: ['text'],
            description: 'Memory creation timestamp'
          }
        ]
      };

      // Define biometric pattern schema
      const patternSchema = {
        class: 'BiometricPattern',
        description: 'Stores biometric patterns and optimal strategies',
        vectorizer: 'text2vec-openai',
        properties: [
          {
            name: 'patternId',
            dataType: ['text'],
            description: 'Unique pattern identifier'
          },
          {
            name: 'patternName',
            dataType: ['text'],
            description: 'Pattern name'
          },
          {
            name: 'description',
            dataType: ['text'],
            description: 'Pattern description'
          },
          {
            name: 'heartRateMin',
            dataType: ['number'],
            description: 'Minimum heart rate'
          },
          {
            name: 'heartRateMax',
            dataType: ['number'],
            description: 'Maximum heart rate'
          },
          {
            name: 'stressLevelMin',
            dataType: ['number'],
            description: 'Minimum stress level'
          },
          {
            name: 'stressLevelMax',
            dataType: ['number'],
            description: 'Maximum stress level'
          },
          {
            name: 'optimalStrategies',
            dataType: ['text[]'],
            description: 'Optimal strategies for this pattern'
          },
          {
            name: 'avoidStrategies',
            dataType: ['text[]'],
            description: 'Strategies to avoid'
          },
          {
            name: 'successRate',
            dataType: ['number'],
            description: 'Pattern success rate'
          },
          {
            name: 'sampleSize',
            dataType: ['int'],
            description: 'Number of samples'
          },
          {
            name: 'lastUpdated',
            dataType: ['text'],
            description: 'Last update timestamp'
          }
        ]
      };

      // Create schemas
      await this.createSchemaIfNotExists(conversationSchema);
      await this.createSchemaIfNotExists(memorySchema);
      await this.createSchemaIfNotExists(patternSchema);

      console.log('✓ Weaviate schemas initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Weaviate schemas:', error);
      throw error;
    }
  }

  private async createSchemaIfNotExists(schema: any): Promise<void> {
    try {
      // Check if schema exists
      const exists = await this.schemaExists(schema.class);
      
      if (!exists) {
        await this.client.schema.classCreator().withClass(schema).do();
        console.log(`✓ Created Weaviate schema: ${schema.class}`);
      } else {
        console.log(`✓ Weaviate schema already exists: ${schema.class}`);
      }
    } catch (error) {
      console.error(`Failed to create schema ${schema.class}:`, error);
      throw error;
    }
  }

  async schemaExists(className: string): Promise<boolean> {
    try {
      const schema = await this.client.schema.getter().do();
      return schema.classes.some((cls: any) => cls.class === className);
    } catch (error) {
      console.error(`Error checking if schema exists for ${className}:`, error);
      return false;
    }
  }

  async getSchemaInfo(className: string): Promise<SchemaInfo | null> {
    try {
      const schema = await this.client.schema.getter().do();
      const classSchema = schema.classes.find((cls: any) => cls.class === className);
      
      if (!classSchema) {
        return null;
      }

      return {
        className: classSchema.class,
        description: classSchema.description || '',
        properties: classSchema.properties || [],
        vectorizer: classSchema.vectorizer || '',
        exists: true
      };
    } catch (error) {
      console.error(`Error getting schema info for ${className}:`, error);
      return null;
    }
  }

  async updateSchema(changes: SchemaChange[]): Promise<void> {
    for (const change of changes) {
      try {
        switch (change.action) {
          case 'add':
            if (change.property) {
              await this.client.schema
                .propertyCreator()
                .withClassName(change.className)
                .withProperty(change.property)
                .do();
              console.log(`✓ Added property ${change.property.name} to ${change.className}`);
            }
            break;
          
          case 'delete':
            if (change.property) {
              // Note: Weaviate doesn't support property deletion, only class deletion
              console.warn(`Property deletion not supported in Weaviate: ${change.property.name}`);
            } else {
              await this.client.schema.classDeleter().withClassName(change.className).do();
              console.log(`✓ Deleted class ${change.className}`);
            }
            break;
          
          case 'modify':
            console.warn(`Property modification not directly supported in Weaviate`);
            break;
        }
      } catch (error) {
        console.error(`Failed to apply schema change:`, error);
        throw error;
      }
    }
  }

  async listClasses(): Promise<string[]> {
    try {
      const schema = await this.client.schema.getter().do();
      return schema.classes.map((cls: any) => cls.class);
    } catch (error) {
      console.error('Error listing schema classes:', error);
      return [];
    }
  }

  async deleteClass(className: string): Promise<void> {
    try {
      await this.client.schema.classDeleter().withClassName(className).do();
      console.log(`✓ Deleted Weaviate class: ${className}`);
    } catch (error) {
      console.error(`Failed to delete class ${className}:`, error);
      throw error;
    }
  }
}