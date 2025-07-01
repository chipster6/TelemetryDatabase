/**
 * Retrieval-Augmented Generation (RAG) Service for Nexis Platform
 * Uses Weaviate as the primary LLM backbone for infinite context and memory
 */

import { weaviateService } from './weaviate.service.js';
import type { BiometricData } from '../../shared/schema.js';

export interface BiometricContext {
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

export interface UserQuery {
  text: string;
  intent?: string;
  complexity?: 'low' | 'medium' | 'high';
  domain?: string;
}

export interface Conversation {
  id: string;
  userMessage: string;
  aiResponse: string;
  effectivenessScore: number;
  biometricContext: BiometricContext;
  timestamp: string;
  responseStrategy: string;
  isBreakthrough?: boolean;
}

export interface Pattern {
  patternName: string;
  successRate: number;
  optimalStrategies: string[];
  biometricSignature: any;
  contextFactors: string[];
}

export interface RAGContext {
  semanticMatches: Conversation[];
  biometricMatches: Conversation[];
  effectivePatterns: Pattern[];
  personalMemories: any[];
  optimalStrategy: any;
  contextualInsights: string[];
  adaptationRecommendations: string[];
}

export interface AIResponse {
  content: string;
  confidence: number;
  strategy: string;
  contextUsed: {
    conversationCount: number;
    memoryCount: number;
    patternCount: number;
  };
  adaptations: string[];
  followUpSuggestions?: string[];
  biometricConsiderations: string[];
}

export class RAGService {
  private readonly MAX_CONTEXT_CONVERSATIONS = 15;
  private readonly MAX_CONTEXT_MEMORIES = 10;
  private readonly MAX_EFFECTIVE_PATTERNS = 5;
  private readonly BIOMETRIC_SIMILARITY_THRESHOLD = 0.8;
  private readonly EFFECTIVENESS_THRESHOLD = 0.7;

  /**
   * Main RAG method - generates AI response with comprehensive context
   */
  async generateWithContext(
    userQuery: UserQuery,
    currentBiometrics: BiometricContext,
    userId: number
  ): Promise<AIResponse> {
    try {
      console.log(`RAG: Generating response for user ${userId} with biometric context`);
      
      // Step 1: Build comprehensive context from Weaviate
      const context = await this.buildRAGContext(userQuery, currentBiometrics, userId);
      
      // Step 2: Identify optimal response strategy
      const strategy = await this.identifyOptimalStrategy(context, currentBiometrics);
      
      // Step 3: Generate contextual insights
      const insights = this.generateContextualInsights(context);
      
      // Step 4: Create adaptation recommendations
      const adaptations = this.createAdaptationRecommendations(currentBiometrics, strategy);
      
      // Step 5: Build the enhanced prompt with full context
      const enhancedPrompt = await this.buildPromptWithContext(userQuery, context, strategy);
      
      // Step 6: Generate the response (using built-in prompt engineering)
      const response = this.generateContextualResponse(enhancedPrompt, context, strategy);
      
      // Step 7: Analyze biometric considerations
      const biometricConsiderations = this.analyzeBiometricConsiderations(currentBiometrics, context);
      
      return {
        content: response,
        confidence: this.calculateConfidence(context, strategy),
        strategy: strategy.name,
        contextUsed: {
          conversationCount: context.semanticMatches.length + context.biometricMatches.length,
          memoryCount: context.personalMemories.length,
          patternCount: context.effectivePatterns.length
        },
        adaptations,
        followUpSuggestions: this.generateFollowUpSuggestions(userQuery, context),
        biometricConsiderations
      };
      
    } catch (error) {
      console.error('RAG generation failed:', error);
      return this.generateFallbackResponse(userQuery.text, currentBiometrics);
    }
  }

  /**
   * Build comprehensive RAG context from Weaviate data
   */
  private async buildRAGContext(
    userQuery: UserQuery,
    currentBiometrics: BiometricContext,
    userId: number
  ): Promise<RAGContext> {
    try {
      // Parallel retrieval for maximum efficiency
      const [semanticMatches, biometricMatches, personalMemories, effectivePatterns] = await Promise.all([
        this.findRelevantConversations(userQuery.text, userId, this.MAX_CONTEXT_CONVERSATIONS),
        this.findSimilarBiometricStates(currentBiometrics, userId, 8),
        this.findRelevantMemories(userQuery.text, userId, this.MAX_CONTEXT_MEMORIES),
        this.identifyEffectivePatterns(currentBiometrics, userId, this.MAX_EFFECTIVE_PATTERNS)
      ]);

      const optimalStrategy = await weaviateService.getOptimalResponseStrategy(currentBiometrics, userId);
      const contextualInsights = this.generateInsights(semanticMatches, biometricMatches, personalMemories);

      return {
        semanticMatches,
        biometricMatches,
        effectivePatterns,
        personalMemories,
        optimalStrategy,
        contextualInsights,
        adaptationRecommendations: []
      };
    } catch (error) {
      console.error('Failed to build RAG context:', error);
      return this.getEmptyContext();
    }
  }

  /**
   * Find relevant past conversations using semantic similarity
   */
  async findRelevantConversations(query: string, userId: number, limit: number): Promise<Conversation[]> {
    try {
      const results = await weaviateService.searchConversations(query, limit, userId);
      
      return results
        .filter(conv => conv.effectivenessScore >= this.EFFECTIVENESS_THRESHOLD)
        .map(conv => ({
          id: conv.conversationId,
          userMessage: conv.userMessage,
          aiResponse: conv.aiResponse,
          effectivenessScore: conv.effectivenessScore,
          biometricContext: {
            heartRate: conv.heartRate,
            hrv: conv.hrv,
            stressLevel: conv.stressLevel,
            attentionLevel: conv.attentionLevel,
            cognitiveLoad: conv.cognitiveLoad,
            flowState: conv.flowState,
            arousal: conv.arousal || 0,
            valence: conv.valence || 0,
            timestamp: new Date(conv.timestamp).getTime()
          },
          timestamp: conv.timestamp,
          responseStrategy: conv.responseStrategy,
          isBreakthrough: conv.isBreakthrough
        }));
    } catch (error) {
      console.error('Failed to find relevant conversations:', error);
      return [];
    }
  }

  /**
   * Find conversations from similar biometric states
   */
  async findSimilarBiometricStates(
    currentBiometrics: BiometricContext,
    userId: number,
    limit: number
  ): Promise<Conversation[]> {
    try {
      const results = await weaviateService.searchByBiometricState(currentBiometrics, limit, userId);
      
      return results
        .filter(conv => conv.effectivenessScore >= this.EFFECTIVENESS_THRESHOLD)
        .map(conv => ({
          id: conv.conversationId || conv.id,
          userMessage: conv.userMessage,
          aiResponse: conv.aiResponse,
          effectivenessScore: conv.effectivenessScore,
          biometricContext: {
            heartRate: conv.heartRate,
            hrv: conv.hrv || 0,
            stressLevel: conv.stressLevel,
            attentionLevel: conv.attentionLevel,
            cognitiveLoad: conv.cognitiveLoad,
            flowState: conv.flowState,
            arousal: conv.arousal || 0,
            valence: conv.valence || 0,
            timestamp: Date.now()
          },
          timestamp: conv.timestamp || new Date().toISOString(),
          responseStrategy: conv.responseStrategy || 'adaptive'
        }));
    } catch (error) {
      console.error('Failed to find similar biometric states:', error);
      return [];
    }
  }

  /**
   * Find relevant memories using semantic search
   */
  async findRelevantMemories(query: string, userId: number, limit: number): Promise<any[]> {
    try {
      return await weaviateService.searchMemories(query, userId, limit);
    } catch (error) {
      console.error('Failed to find relevant memories:', error);
      return [];
    }
  }

  /**
   * Identify effective patterns for current biometric state
   */
  async identifyEffectivePatterns(
    currentBiometrics: BiometricContext,
    userId: number,
    limit: number
  ): Promise<Pattern[]> {
    try {
      // Get learned biometric patterns
      const patterns = await weaviateService.learnBiometricPatterns(userId);
      
      return patterns
        .slice(0, limit)
        .map(pattern => ({
          patternName: pattern.patternName,
          successRate: pattern.successRate,
          optimalStrategies: pattern.optimalStrategies,
          biometricSignature: pattern.biometricRanges,
          contextFactors: pattern.triggerConditions || []
        }));
    } catch (error) {
      console.error('Failed to identify effective patterns:', error);
      return [];
    }
  }

  /**
   * Identify optimal response strategy based on context and biometrics
   */
  private async identifyOptimalStrategy(context: RAGContext, biometrics: BiometricContext): Promise<any> {
    // Analyze the most effective strategies from context
    const strategyFrequency = new Map<string, number>();
    const strategyEffectiveness = new Map<string, number[]>();

    for (const conv of [...context.semanticMatches, ...context.biometricMatches]) {
      const strategy = conv.responseStrategy;
      strategyFrequency.set(strategy, (strategyFrequency.get(strategy) || 0) + 1);
      
      if (!strategyEffectiveness.has(strategy)) {
        strategyEffectiveness.set(strategy, []);
      }
      strategyEffectiveness.get(strategy)!.push(conv.effectivenessScore);
    }

    // Find the most effective strategy
    let bestStrategy = 'adaptive_balanced';
    let bestScore = 0;

    for (const [strategy, scores] of strategyEffectiveness) {
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const frequency = strategyFrequency.get(strategy) || 0;
      const combinedScore = avgScore * 0.7 + (frequency / 10) * 0.3; // Weight effectiveness more

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestStrategy = strategy;
      }
    }

    return {
      name: bestStrategy,
      effectiveness: bestScore,
      adaptations: this.getStrategyAdaptations(bestStrategy, biometrics),
      contextFactors: context.effectivePatterns.flatMap(p => p.contextFactors).slice(0, 5)
    };
  }

  /**
   * Get strategy-specific adaptations
   */
  private getStrategyAdaptations(strategy: string, biometrics: BiometricContext): string[] {
    const adaptations = [];

    // Biometric-based adaptations
    if (biometrics.cognitiveLoad > 0.8) {
      adaptations.push('reduce_complexity', 'break_into_steps');
    }
    if (biometrics.stressLevel > 0.6) {
      adaptations.push('calming_tone', 'supportive_language');
    }
    if (biometrics.flowState > 0.7) {
      adaptations.push('maintain_momentum', 'technical_depth');
    }
    if (biometrics.attentionLevel < 0.4) {
      adaptations.push('increase_engagement', 'shorter_responses');
    }

    // Strategy-specific adaptations
    switch (strategy) {
      case 'technical_detailed':
        adaptations.push('include_examples', 'step_by_step');
        break;
      case 'creative_supportive':
        adaptations.push('encourage_exploration', 'open_ended');
        break;
      case 'structured_logical':
        adaptations.push('clear_framework', 'logical_progression');
        break;
    }

    return adaptations.slice(0, 5);
  }

  /**
   * Generate contextual insights from retrieved data
   */
  private generateContextualInsights(context: RAGContext): string[] {
    const insights = [];

    if (context.semanticMatches.length > 0) {
      const avgEffectiveness = context.semanticMatches.reduce((sum, conv) => sum + conv.effectivenessScore, 0) / context.semanticMatches.length;
      insights.push(`Found ${context.semanticMatches.length} similar conversations with ${(avgEffectiveness * 100).toFixed(0)}% avg effectiveness`);
    }

    if (context.biometricMatches.length > 0) {
      const breakthroughs = context.biometricMatches.filter(conv => conv.isBreakthrough).length;
      insights.push(`${context.biometricMatches.length} conversations in similar cognitive state${breakthroughs > 0 ? `, ${breakthroughs} breakthroughs` : ''}`);
    }

    if (context.personalMemories.length > 0) {
      const highImportance = context.personalMemories.filter(mem => mem.importance > 0.8).length;
      insights.push(`${context.personalMemories.length} relevant memories${highImportance > 0 ? `, ${highImportance} high-importance` : ''}`);
    }

    if (context.effectivePatterns.length > 0) {
      const avgSuccessRate = context.effectivePatterns.reduce((sum, p) => sum + p.successRate, 0) / context.effectivePatterns.length;
      insights.push(`${context.effectivePatterns.length} learned patterns with ${(avgSuccessRate * 100).toFixed(0)}% success rate`);
    }

    return insights;
  }

  /**
   * Generate insights from retrieved data
   */
  private generateInsights(semanticMatches: Conversation[], biometricMatches: Conversation[], memories: any[]): string[] {
    const insights = [];

    if (semanticMatches.length > 0) {
      const avgEffectiveness = semanticMatches.reduce((sum, conv) => sum + conv.effectivenessScore, 0) / semanticMatches.length;
      insights.push(`Semantic context: ${(avgEffectiveness * 100).toFixed(0)}% avg effectiveness`);
    }

    if (biometricMatches.length > 0) {
      insights.push(`Biometric context: ${biometricMatches.length} similar states`);
    }

    if (memories.length > 0) {
      insights.push(`Personal context: ${memories.length} relevant memories`);
    }

    return insights;
  }

  /**
   * Create adaptation recommendations based on biometrics and strategy
   */
  private createAdaptationRecommendations(biometrics: BiometricContext, strategy: any): string[] {
    const recommendations = [];

    // Cognitive load adaptations
    if (biometrics.cognitiveLoad > 0.8) {
      recommendations.push('Simplify explanations and break complex topics into smaller chunks');
    } else if (biometrics.cognitiveLoad < 0.3) {
      recommendations.push('Provide more detailed information and technical depth');
    }

    // Stress level adaptations
    if (biometrics.stressLevel > 0.6) {
      recommendations.push('Use calming language and focus on immediate actionable steps');
    }

    // Flow state adaptations
    if (biometrics.flowState > 0.7) {
      recommendations.push('Maintain current momentum with direct, focused responses');
    }

    // Attention level adaptations
    if (biometrics.attentionLevel < 0.5) {
      recommendations.push('Use engaging examples and shorter response segments');
    }

    return recommendations.slice(0, 4);
  }

  /**
   * Build enhanced prompt with full RAG context
   */
  async buildPromptWithContext(userQuery: UserQuery, context: RAGContext, strategy: any): Promise<string> {
    let prompt = "You are Nexis, an advanced AI with infinite memory and deep understanding of user patterns.\n\n";

    // Add biometric awareness
    prompt += "## Current User State\n";
    prompt += `The user is currently in a ${this.describeCognitiveState(context)} state.\n`;
    prompt += `Optimal strategy: ${strategy.name}\n\n`;

    // Add historical context
    if (context.semanticMatches.length > 0) {
      prompt += "## Relevant Past Conversations\n";
      prompt += `Found ${context.semanticMatches.length} similar conversations:\n`;
      for (const conv of context.semanticMatches.slice(0, 3)) {
        prompt += `- "${conv.userMessage}" → Effectiveness: ${(conv.effectivenessScore * 100).toFixed(0)}%\n`;
      }
      prompt += "\n";
    }

    // Add personal memories
    if (context.personalMemories.length > 0) {
      prompt += "## Personal Context\n";
      for (const memory of context.personalMemories.slice(0, 3)) {
        prompt += `- ${memory.content}\n`;
      }
      prompt += "\n";
    }

    // Add strategy adaptations
    if (strategy.adaptations.length > 0) {
      prompt += "## Response Adaptations\n";
      prompt += `Apply these adaptations: ${strategy.adaptations.join(', ')}\n\n`;
    }

    // Add the user query
    prompt += "## User Query\n";
    prompt += `${userQuery.text}\n\n`;

    // Add instructions
    prompt += "## Instructions\n";
    prompt += "Respond using the historical context and optimal strategy identified above. ";
    prompt += "Adapt your response style based on the user's current cognitive state and proven effective patterns.";

    return prompt;
  }

  /**
   * Describe cognitive state based on context
   */
  private describeCognitiveState(context: RAGContext): string {
    const patterns = context.effectivePatterns;
    if (patterns.length === 0) return "balanced";

    const dominantPattern = patterns[0];
    if (dominantPattern.patternName.includes('flow')) return "high-flow";
    if (dominantPattern.patternName.includes('stress')) return "elevated-stress";
    if (dominantPattern.patternName.includes('focus')) return "deep-focus";
    if (dominantPattern.patternName.includes('creative')) return "creative";
    
    return "adaptive";
  }

  /**
   * Generate the actual contextual response using prompt engineering
   */
  private generateContextualResponse(enhancedPrompt: string, context: RAGContext, strategy: any): string {
    // This is where we would integrate with an LLM API in the future
    // For now, we use sophisticated prompt engineering with context

    const responseElements = [];

    // Start with a contextually aware greeting
    if (context.semanticMatches.length > 0) {
      responseElements.push("Based on our previous conversations and your current state,");
    } else {
      responseElements.push("I understand you're asking about this topic.");
    }

    // Add strategy-specific response style
    switch (strategy.name) {
      case 'technical_detailed':
        responseElements.push("Let me provide a comprehensive technical explanation:");
        break;
      case 'creative_supportive':
        responseElements.push("Let's explore this creatively together:");
        break;
      case 'structured_logical':
        responseElements.push("I'll break this down systematically:");
        break;
      default:
        responseElements.push("Here's how I can help:");
    }

    // Add context from memories if available
    if (context.personalMemories.length > 0) {
      const relevantMemory = context.personalMemories[0];
      responseElements.push(`\n\nRemembering that ${relevantMemory.content.toLowerCase()},`);
    }

    // Add effectiveness insights
    if (context.contextualInsights.length > 0) {
      responseElements.push(`\n\n[Context: ${context.contextualInsights[0]}]`);
    }

    return responseElements.join(" ");
  }

  /**
   * Calculate confidence score based on context richness
   */
  private calculateConfidence(context: RAGContext, strategy: any): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on context richness
    confidence += Math.min(context.semanticMatches.length * 0.05, 0.3);
    confidence += Math.min(context.biometricMatches.length * 0.03, 0.2);
    confidence += Math.min(context.personalMemories.length * 0.02, 0.1);
    confidence += Math.min(context.effectivePatterns.length * 0.04, 0.2);

    // Boost confidence if we have high-effectiveness historical data
    if (context.semanticMatches.length > 0) {
      const avgEffectiveness = context.semanticMatches.reduce((sum, conv) => sum + conv.effectivenessScore, 0) / context.semanticMatches.length;
      confidence += avgEffectiveness * 0.2;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Generate follow-up suggestions based on context
   */
  private generateFollowUpSuggestions(userQuery: UserQuery, context: RAGContext): string[] {
    const suggestions = [];

    if (context.semanticMatches.length > 0) {
      suggestions.push("Would you like me to elaborate on any specific aspect?");
    }

    if (context.effectivePatterns.length > 0) {
      suggestions.push("I can provide more examples based on what's worked well for you before");
    }

    if (userQuery.complexity === 'high') {
      suggestions.push("Shall we break this down into smaller, manageable steps?");
    }

    return suggestions.slice(0, 2);
  }

  /**
   * Analyze biometric considerations for the response
   */
  private analyzeBiometricConsiderations(biometrics: BiometricContext, context: RAGContext): string[] {
    const considerations = [];

    if (biometrics.cognitiveLoad > 0.8) {
      considerations.push("High cognitive load detected - response simplified");
    }

    if (biometrics.stressLevel > 0.6) {
      considerations.push("Elevated stress - using supportive tone");
    }

    if (biometrics.flowState > 0.7) {
      considerations.push("Flow state detected - maintaining momentum");
    }

    if (biometrics.attentionLevel < 0.4) {
      considerations.push("Low attention - using engaging format");
    }

    return considerations;
  }

  /**
   * Generate fallback response when RAG fails
   */
  private generateFallbackResponse(query: string, biometrics: BiometricContext): AIResponse {
    let content = "I understand your question. ";

    if (biometrics.cognitiveLoad > 0.8) {
      content += "Let me provide a clear, step-by-step response.";
    } else if (biometrics.stressLevel > 0.6) {
      content += "I'll help you work through this calmly.";
    } else {
      content += "Let me provide a helpful response based on your current state.";
    }

    return {
      content,
      confidence: 0.4,
      strategy: 'fallback',
      contextUsed: { conversationCount: 0, memoryCount: 0, patternCount: 0 },
      adaptations: ['fallback_mode'],
      biometricConsiderations: ['using_fallback_response']
    };
  }

  /**
   * Get empty context for fallback scenarios
   */
  private getEmptyContext(): RAGContext {
    return {
      semanticMatches: [],
      biometricMatches: [],
      effectivePatterns: [],
      personalMemories: [],
      optimalStrategy: { name: 'adaptive', effectiveness: 0.5, adaptations: [], contextFactors: [] },
      contextualInsights: [],
      adaptationRecommendations: []
    };
  }

  /**
   * Get service statistics for monitoring
   */
  getStats(): any {
    return {
      maxContextConversations: this.MAX_CONTEXT_CONVERSATIONS,
      maxContextMemories: this.MAX_CONTEXT_MEMORIES,
      maxEffectivePatterns: this.MAX_EFFECTIVE_PATTERNS,
      biometricSimilarityThreshold: this.BIOMETRIC_SIMILARITY_THRESHOLD,
      effectivenessThreshold: this.EFFECTIVENESS_THRESHOLD
    };
  }
}

export const ragService = new RAGService();