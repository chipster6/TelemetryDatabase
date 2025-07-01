/**
 * Weaviate Schema Definition for Nexis Platform
 * Complete schema for biometric-aware AI conversations with infinite memory
 */

export interface WeaviateClassDefinition {
  class: string;
  description: string;
  vectorizer: string;
  moduleConfig?: any;
  properties: WeaviateProperty[];
}

export interface WeaviateProperty {
  name: string;
  dataType: string[];
  description: string;
  moduleConfig?: any;
  indexFilterable?: boolean;
  indexSearchable?: boolean;
}

/**
 * Complete Weaviate schema for Nexis platform
 */
export const nexisWeaviateSchema: WeaviateClassDefinition[] = [
  {
    class: "NexisConversation",
    description: "Primary conversation storage with complete biometric and environmental context",
    vectorizer: "text2vec-transformers",
    moduleConfig: {
      "text2vec-transformers": {
        poolingStrategy: "masked_mean"
      }
    },
    properties: [
      // Core conversation data
      { name: "conversationId", dataType: ["string"], description: "Unique conversation identifier", indexFilterable: true },
      { name: "userId", dataType: ["int"], description: "User identifier", indexFilterable: true },
      { name: "sessionId", dataType: ["string"], description: "Session identifier", indexFilterable: true },
      { name: "timestamp", dataType: ["date"], description: "Conversation timestamp", indexFilterable: true },
      { name: "userMessage", dataType: ["text"], description: "User's input message", indexSearchable: true },
      { name: "aiResponse", dataType: ["text"], description: "AI's response", indexSearchable: true },
      { name: "conversationContext", dataType: ["text"], description: "Full conversation history", indexSearchable: true },
      { name: "conversationType", dataType: ["string"], description: "Type of conversation (casual, technical, creative, etc.)", indexFilterable: true },
      
      // Effectiveness and learning
      { name: "effectivenessScore", dataType: ["number"], description: "Response effectiveness (0-1)", indexFilterable: true },
      { name: "userSatisfaction", dataType: ["number"], description: "User satisfaction rating (0-1)", indexFilterable: true },
      { name: "responseStrategy", dataType: ["string"], description: "Strategy used for response", indexFilterable: true },
      { name: "isBreakthrough", dataType: ["boolean"], description: "Marked as breakthrough moment", indexFilterable: true },
      { name: "cognitiveBreakthrough", dataType: ["boolean"], description: "Cognitive breakthrough achieved", indexFilterable: true },
      { name: "difficultyLevel", dataType: ["number"], description: "Conversation difficulty (1-10)", indexFilterable: true },
      
      // Biometric state snapshot
      { name: "heartRate", dataType: ["number"], description: "Heart rate during conversation", indexFilterable: true },
      { name: "hrv", dataType: ["number"], description: "Heart rate variability", indexFilterable: true },
      { name: "stressLevel", dataType: ["number"], description: "Stress level (0-1)", indexFilterable: true },
      { name: "attentionLevel", dataType: ["number"], description: "Attention level (0-1)", indexFilterable: true },
      { name: "cognitiveLoad", dataType: ["number"], description: "Cognitive load (0-1)", indexFilterable: true },
      { name: "flowState", dataType: ["number"], description: "Flow state indicator (0-1)", indexFilterable: true },
      { name: "arousal", dataType: ["number"], description: "Arousal level (0-1)", indexFilterable: true },
      { name: "valence", dataType: ["number"], description: "Emotional valence (-1 to 1)", indexFilterable: true },
      { name: "biometricTimestamp", dataType: ["date"], description: "When biometrics were captured", indexFilterable: true },
      
      // Neurodivergent markers
      { name: "hyperfocusState", dataType: ["boolean"], description: "In hyperfocus state", indexFilterable: true },
      { name: "contextSwitches", dataType: ["int"], description: "Number of context switches", indexFilterable: true },
      { name: "sensoryLoad", dataType: ["number"], description: "Sensory processing load (0-1)", indexFilterable: true },
      { name: "executiveFunction", dataType: ["number"], description: "Executive function level (0-1)", indexFilterable: true },
      { name: "workingMemoryLoad", dataType: ["number"], description: "Working memory usage (0-1)", indexFilterable: true },
      { name: "attentionRegulation", dataType: ["number"], description: "Attention regulation ability (0-1)", indexFilterable: true },
      
      // Environmental context
      { name: "timeOfDay", dataType: ["string"], description: "Time category (morning, afternoon, evening, night)", indexFilterable: true },
      { name: "dayOfWeek", dataType: ["string"], description: "Day of the week", indexFilterable: true },
      { name: "location", dataType: ["string"], description: "Location context", indexFilterable: true },
      { name: "soundLevel", dataType: ["number"], description: "Environmental sound level (dB)", indexFilterable: true },
      { name: "lightLevel", dataType: ["number"], description: "Environmental light level (lux)", indexFilterable: true },
      { name: "temperature", dataType: ["number"], description: "Environmental temperature (°C)", indexFilterable: true },
      { name: "humidity", dataType: ["number"], description: "Environmental humidity (%)", indexFilterable: true },
      { name: "airQuality", dataType: ["number"], description: "Air quality index", indexFilterable: true },
      
      // Learning and adaptation
      { name: "learningGoals", dataType: ["string[]"], description: "Identified learning objectives", indexFilterable: true },
      { name: "skillAreas", dataType: ["string[]"], description: "Skill areas addressed", indexFilterable: true },
      { name: "knowledgeDomains", dataType: ["string[]"], description: "Knowledge domains involved", indexFilterable: true },
      { name: "adaptationNeeded", dataType: ["boolean"], description: "Required adaptation in response", indexFilterable: true },
      { name: "followUpRequired", dataType: ["boolean"], description: "Follow-up conversation needed", indexFilterable: true }
    ]
  },
  
  {
    class: "NexisMemoryNode",
    description: "Individual memory and knowledge nodes for personalized AI",
    vectorizer: "text2vec-transformers",
    properties: [
      { name: "memoryId", dataType: ["string"], description: "Unique memory identifier", indexFilterable: true },
      { name: "userId", dataType: ["int"], description: "User identifier", indexFilterable: true },
      { name: "content", dataType: ["text"], description: "Memory content", indexSearchable: true },
      { name: "memoryType", dataType: ["string"], description: "Type of memory (fact, experience, preference, skill, insight, pattern)", indexFilterable: true },
      { name: "importance", dataType: ["number"], description: "Memory importance (0-1)", indexFilterable: true },
      { name: "confidenceLevel", dataType: ["number"], description: "Confidence in memory accuracy (0-1)", indexFilterable: true },
      { name: "emotionalValence", dataType: ["number"], description: "Emotional association (-1 to 1)", indexFilterable: true },
      { name: "emotionalIntensity", dataType: ["number"], description: "Emotional intensity (0-1)", indexFilterable: true },
      
      // Temporal aspects
      { name: "createdAt", dataType: ["date"], description: "When memory was formed", indexFilterable: true },
      { name: "lastAccessed", dataType: ["date"], description: "Last access time", indexFilterable: true },
      { name: "lastReinforced", dataType: ["date"], description: "Last reinforcement", indexFilterable: true },
      { name: "accessCount", dataType: ["int"], description: "Access frequency", indexFilterable: true },
      { name: "reinforcementCount", dataType: ["int"], description: "Reinforcement frequency", indexFilterable: true },
      
      // Contextual information
      { name: "relatedTopics", dataType: ["string[]"], description: "Related topics/tags", indexFilterable: true },
      { name: "associatedSkills", dataType: ["string[]"], description: "Associated skills", indexFilterable: true },
      { name: "sourceConversations", dataType: ["string[]"], description: "Source conversation IDs", indexFilterable: true },
      { name: "knowledgeDomain", dataType: ["string"], description: "Primary knowledge domain", indexFilterable: true },
      
      // Memory strength and retrieval
      { name: "retrievalStrength", dataType: ["number"], description: "How easily retrieved (0-1)", indexFilterable: true },
      { name: "decayRate", dataType: ["number"], description: "Memory decay rate", indexFilterable: true },
      { name: "consolidationLevel", dataType: ["number"], description: "Consolidation level (0-1)", indexFilterable: true }
    ]
  },
  
  {
    class: "NexisBiometricPattern",
    description: "Learned patterns for optimal responses based on biometric states",
    vectorizer: "text2vec-transformers",
    properties: [
      { name: "patternId", dataType: ["string"], description: "Unique pattern identifier", indexFilterable: true },
      { name: "patternName", dataType: ["string"], description: "Human-readable pattern name", indexFilterable: true },
      { name: "description", dataType: ["text"], description: "Pattern description", indexSearchable: true },
      
      // Biometric signature ranges
      { name: "heartRateMin", dataType: ["number"], description: "Minimum heart rate", indexFilterable: true },
      { name: "heartRateMax", dataType: ["number"], description: "Maximum heart rate", indexFilterable: true },
      { name: "hrvMin", dataType: ["number"], description: "Minimum HRV", indexFilterable: true },
      { name: "hrvMax", dataType: ["number"], description: "Maximum HRV", indexFilterable: true },
      { name: "stressMin", dataType: ["number"], description: "Minimum stress level", indexFilterable: true },
      { name: "stressMax", dataType: ["number"], description: "Maximum stress level", indexFilterable: true },
      { name: "attentionMin", dataType: ["number"], description: "Minimum attention level", indexFilterable: true },
      { name: "attentionMax", dataType: ["number"], description: "Maximum attention level", indexFilterable: true },
      { name: "cognitiveLoadMin", dataType: ["number"], description: "Minimum cognitive load", indexFilterable: true },
      { name: "cognitiveLoadMax", dataType: ["number"], description: "Maximum cognitive load", indexFilterable: true },
      { name: "flowStateMin", dataType: ["number"], description: "Minimum flow state", indexFilterable: true },
      { name: "flowStateMax", dataType: ["number"], description: "Maximum flow state", indexFilterable: true },
      
      // Pattern effectiveness
      { name: "successRate", dataType: ["number"], description: "Pattern success rate (0-1)", indexFilterable: true },
      { name: "averageEffectiveness", dataType: ["number"], description: "Average effectiveness (0-1)", indexFilterable: true },
      { name: "sampleSize", dataType: ["int"], description: "Number of samples", indexFilterable: true },
      { name: "confidenceInterval", dataType: ["number"], description: "Statistical confidence (0-1)", indexFilterable: true },
      
      // Optimal strategies
      { name: "optimalStrategies", dataType: ["string[]"], description: "Best response strategies", indexFilterable: true },
      { name: "avoidStrategies", dataType: ["string[]"], description: "Strategies to avoid", indexFilterable: true },
      { name: "communicationStyle", dataType: ["string"], description: "Optimal communication style", indexFilterable: true },
      { name: "informationDensity", dataType: ["string"], description: "Optimal information density", indexFilterable: true },
      { name: "responseLength", dataType: ["string"], description: "Optimal response length", indexFilterable: true },
      { name: "interactionPace", dataType: ["string"], description: "Optimal interaction pace", indexFilterable: true },
      
      // Learning metadata
      { name: "learnedFrom", dataType: ["int"], description: "Number of learning conversations", indexFilterable: true },
      { name: "lastUpdated", dataType: ["date"], description: "Last pattern update", indexFilterable: true },
      { name: "createdAt", dataType: ["date"], description: "Pattern creation date", indexFilterable: true },
      { name: "validationScore", dataType: ["number"], description: "Cross-validation score (0-1)", indexFilterable: true }
    ]
  },
  
  {
    class: "NexisPromptTemplate",
    description: "Effective prompts with their performance data and optimal usage contexts",
    vectorizer: "text2vec-transformers",
    properties: [
      { name: "templateId", dataType: ["string"], description: "Unique template identifier", indexFilterable: true },
      { name: "name", dataType: ["string"], description: "Template name", indexFilterable: true },
      { name: "description", dataType: ["text"], description: "Template description", indexSearchable: true },
      { name: "category", dataType: ["string"], description: "Template category", indexFilterable: true },
      { name: "subcategory", dataType: ["string"], description: "Template subcategory", indexFilterable: true },
      
      // Template content
      { name: "systemPrompt", dataType: ["text"], description: "System prompt template", indexSearchable: true },
      { name: "userPromptTemplate", dataType: ["text"], description: "User prompt template", indexSearchable: true },
      { name: "variables", dataType: ["string[]"], description: "Template variables", indexFilterable: true },
      { name: "examples", dataType: ["text[]"], description: "Usage examples" },
      
      // Performance metrics
      { name: "overallEffectiveness", dataType: ["number"], description: "Overall effectiveness (0-1)", indexFilterable: true },
      { name: "usageCount", dataType: ["int"], description: "Times used", indexFilterable: true },
      { name: "successCount", dataType: ["int"], description: "Successful uses", indexFilterable: true },
      { name: "averageUserSatisfaction", dataType: ["number"], description: "Average user satisfaction (0-1)", indexFilterable: true },
      
      // Optimal contexts
      { name: "optimalCognitiveLoad", dataType: ["string"], description: "Optimal cognitive load range", indexFilterable: true },
      { name: "optimalStressLevel", dataType: ["string"], description: "Optimal stress level range", indexFilterable: true },
      { name: "optimalAttentionLevel", dataType: ["string"], description: "Optimal attention level range", indexFilterable: true },
      { name: "optimalFlowState", dataType: ["string"], description: "Optimal flow state range", indexFilterable: true },
      
      // Metadata
      { name: "createdBy", dataType: ["string"], description: "Creator identifier", indexFilterable: true },
      { name: "createdAt", dataType: ["date"], description: "Creation timestamp", indexFilterable: true },
      { name: "lastUpdated", dataType: ["date"], description: "Last update", indexFilterable: true },
      { name: "version", dataType: ["string"], description: "Template version", indexFilterable: true },
      { name: "tags", dataType: ["string[]"], description: "Searchable tags", indexFilterable: true }
    ]
  }
];

/**
 * Initialize Weaviate schema
 */
export async function initializeWeaviateSchema(weaviateClient: any): Promise<void> {
  console.log('Initializing comprehensive Weaviate schema for Nexis platform...');
  
  try {
    // Check if schema classes already exist
    const existingSchema = await weaviateClient.schema.getter().do();
    const existingClasses = existingSchema.classes?.map((c: any) => c.class) || [];
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const classDefinition of nexisWeaviateSchema) {
      try {
        if (existingClasses.includes(classDefinition.class)) {
          console.log(`✓ Weaviate class ${classDefinition.class} already exists`);
          skippedCount++;
          continue;
        }
        
        await weaviateClient.schema.classCreator()
          .withClass(classDefinition)
          .do();
        
        console.log(`✓ Created Weaviate class: ${classDefinition.class}`);
        createdCount++;
        
        // Small delay to avoid overwhelming Weaviate
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`✗ Failed to create class ${classDefinition.class}:`, error);
        // Continue with other classes
      }
    }
    
    console.log(`Weaviate schema initialization complete. Created: ${createdCount}, Skipped: ${skippedCount}`);
    
  } catch (error) {
    console.error('Failed to initialize Weaviate schema:', error);
    throw error;
  }
}

/**
 * Get schema statistics
 */
export async function getSchemaStats(weaviateClient: any): Promise<any> {
  try {
    const schema = await weaviateClient.schema.getter().do();
    const classes = schema.classes || [];
    
    const stats = {
      totalClasses: classes.length,
      nexisClasses: 0,
      totalProperties: 0,
      vectorizers: {} as Record<string, number>,
      classDetails: [] as any[]
    };
    
    for (const weaviateClass of classes) {
      if (weaviateClass.class.startsWith('Nexis')) {
        stats.nexisClasses++;
      }
      
      const propertyCount = weaviateClass.properties?.length || 0;
      stats.totalProperties += propertyCount;
      
      const vectorizer = weaviateClass.vectorizer || 'none';
      stats.vectorizers[vectorizer] = (stats.vectorizers[vectorizer] || 0) + 1;
      
      stats.classDetails.push({
        name: weaviateClass.class,
        properties: propertyCount,
        vectorizer: vectorizer,
        description: weaviateClass.description
      });
    }
    
    return stats;
    
  } catch (error) {
    console.error('Failed to get schema stats:', error);
    return { error: error.message };
  }
}

export default {
  nexisWeaviateSchema,
  initializeWeaviateSchema,
  getSchemaStats
};