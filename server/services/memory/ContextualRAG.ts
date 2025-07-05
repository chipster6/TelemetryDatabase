import { logger } from '../../utils/logger.js';
import { PersonalMemoryService, PersonalMemory, MemoryQuery } from './PersonalMemoryService.js';
import { BiometricEmbeddings, CognitiveState } from './biometricEmbeddings.js';

export interface RAGContext {
  userId: string;
  query: string;
  currentCognitiveState: CognitiveState;
  contextWindow: number;
  relevanceThreshold: number;
  diversityFactor: number;
}

export interface RAGResponse {
  relevantMemories: PersonalMemory[];
  contextualPrompt: string;
  cognitiveAdaptations: string[];
  memoryInsights: {
    totalMemoriesFound: number;
    averageRelevance: number;
    cognitivePatternMatches: string[];
    temporalSpread: number;
  };
}

export interface MemoryCluster {
  memories: PersonalMemory[];
  centralTopic: string;
  relevanceScore: number;
  cognitiveStateMatch: number;
}

export class ContextualRAG {
  private memoryService: PersonalMemoryService;
  private embeddingService: BiometricEmbeddings;

  constructor(memoryService: PersonalMemoryService) {
    this.memoryService = memoryService;
    this.embeddingService = new BiometricEmbeddings();
  }

  async retrieveContextualMemories(context: RAGContext): Promise<RAGResponse> {
    try {
      logger.debug('Retrieving contextual memories for RAG', {
        userId: context.userId,
        query: context.query.substring(0, 50) + '...',
        cognitiveLoad: context.currentCognitiveState.cognitiveLoad
      });

      // Build memory query with cognitive state filtering
      const memoryQuery: MemoryQuery = {
        userId: context.userId,
        query: context.query,
        cognitiveState: context.currentCognitiveState,
        limit: context.contextWindow * 2, // Get more to filter later
        relevanceThreshold: context.relevanceThreshold
      };

      // Retrieve relevant memories
      const rawMemories = await this.memoryService.retrieveRelevant(memoryQuery);

      // Apply cognitive state filtering and ranking
      const filteredMemories = await this.applyCognitiveFiltering(
        rawMemories,
        context.currentCognitiveState
      );

      // Cluster memories by topic and cognitive state
      const memoryClusters = await this.clusterMemories(
        filteredMemories,
        context.currentCognitiveState
      );

      // Select diverse, relevant memories
      const selectedMemories = this.selectDiverseMemories(
        memoryClusters,
        context.contextWindow,
        context.diversityFactor
      );

      // Generate contextual prompt
      const contextualPrompt = await this.generateContextualPrompt(
        selectedMemories,
        context.query,
        context.currentCognitiveState
      );

      // Extract cognitive adaptations
      const cognitiveAdaptations = this.extractCognitiveAdaptations(
        selectedMemories,
        context.currentCognitiveState
      );

      // Calculate memory insights
      const memoryInsights = this.calculateMemoryInsights(
        rawMemories,
        selectedMemories,
        context.currentCognitiveState
      );

      const ragResponse: RAGResponse = {
        relevantMemories: selectedMemories,
        contextualPrompt,
        cognitiveAdaptations,
        memoryInsights
      };

      logger.debug('Contextual RAG retrieval completed', {
        userId: context.userId,
        memoriesSelected: selectedMemories.length,
        clusters: memoryClusters.length,
        avgRelevance: memoryInsights.averageRelevance
      });

      return ragResponse;
    } catch (error) {
      logger.error('Failed to retrieve contextual memories:', error);
      throw new Error('Failed to perform contextual RAG retrieval');
    }
  }

  private async applyCognitiveFiltering(
    memories: PersonalMemory[],
    currentCognitiveState: CognitiveState
  ): Promise<PersonalMemory[]> {
    const filtered: PersonalMemory[] = [];
    const cognitiveLoadTolerance = 0.3;
    const attentionTolerance = 0.4;

    for (const memory of memories) {
      // Filter by cognitive load similarity
      const cognitiveLoadDiff = Math.abs(memory.cognitiveLoad - currentCognitiveState.cognitiveLoad);
      if (cognitiveLoadDiff > cognitiveLoadTolerance) {
        continue;
      }

      // Filter by attention level compatibility
      const attentionDiff = Math.abs(memory.attentionLevel - currentCognitiveState.attentionLevel);
      if (attentionDiff > attentionTolerance) {
        continue;
      }

      // Boost memories from similar flow states
      if (memory.flowState === currentCognitiveState.flowState) {
        // Add flow state boost by duplicating high-quality flow memories
        if (memory.flowState && memory.satisfactionScore && memory.satisfactionScore > 0.7) {
          filtered.push(memory);
        }
      }

      // Check neurodivergent pattern overlap
      const patternOverlap = memory.neurodivergentPatterns.filter(
        pattern => currentCognitiveState.activePatterns.includes(pattern)
      );

      if (patternOverlap.length > 0 || memory.neurodivergentPatterns.length === 0) {
        filtered.push(memory);
      }
    }

    return filtered;
  }

  private async clusterMemories(
    memories: PersonalMemory[],
    cognitiveState: CognitiveState
  ): Promise<MemoryCluster[]> {
    const clusters: MemoryCluster[] = [];
    const clusterThreshold = 0.6;

    // Group memories by topic similarity and cognitive compatibility
    for (const memory of memories) {
      let assignedToCluster = false;

      for (const cluster of clusters) {
        // Calculate similarity to cluster center
        const similarity = await this.calculateMemoryClusterSimilarity(
          memory,
          cluster.memories,
          cognitiveState
        );

        if (similarity > clusterThreshold) {
          cluster.memories.push(memory);
          cluster.relevanceScore = (cluster.relevanceScore + similarity) / 2;
          assignedToCluster = true;
          break;
        }
      }

      if (!assignedToCluster) {
        // Create new cluster
        clusters.push({
          memories: [memory],
          centralTopic: this.extractCentralTopic(memory.content),
          relevanceScore: 0.8, // Initial high relevance for new clusters
          cognitiveStateMatch: this.calculateCognitiveStateMatch(memory, cognitiveState)
        });
      }
    }

    // Sort clusters by relevance and cognitive state match
    clusters.sort((a, b) => {
      const scoreA = a.relevanceScore * 0.6 + a.cognitiveStateMatch * 0.4;
      const scoreB = b.relevanceScore * 0.6 + b.cognitiveStateMatch * 0.4;
      return scoreB - scoreA;
    });

    return clusters;
  }

  private selectDiverseMemories(
    clusters: MemoryCluster[],
    maxMemories: number,
    diversityFactor: number
  ): PersonalMemory[] {
    const selected: PersonalMemory[] = [];
    const memoriesPerCluster = Math.max(1, Math.floor(maxMemories / clusters.length));

    // Select memories from each cluster based on diversity factor
    for (const cluster of clusters) {
      const clusterMemories = cluster.memories
        .sort((a, b) => (b.satisfactionScore || 0.5) - (a.satisfactionScore || 0.5))
        .slice(0, memoriesPerCluster);

      selected.push(...clusterMemories);

      if (selected.length >= maxMemories) {
        break;
      }
    }

    // Apply diversity filtering to avoid too similar memories
    const diverseMemories = this.applyDiversityFiltering(
      selected.slice(0, maxMemories),
      diversityFactor
    );

    return diverseMemories;
  }

  private async generateContextualPrompt(
    memories: PersonalMemory[],
    query: string,
    cognitiveState: CognitiveState
  ): Promise<string> {
    let prompt = `Based on your previous interactions and current cognitive state, here's relevant context:\n\n`;

    // Add cognitive state context
    prompt += `Current cognitive state: `;
    if (cognitiveState.flowState) {
      prompt += `You're in a flow state with high focus. `;
    }
    if (cognitiveState.cognitiveLoad > 0.7) {
      prompt += `You're experiencing high cognitive load, so prefer simplified responses. `;
    }
    if (cognitiveState.attentionLevel < 0.4) {
      prompt += `Your attention is limited, so focus on key points. `;
    }
    if (cognitiveState.activePatterns.length > 0) {
      prompt += `Active neurodivergent patterns: ${cognitiveState.activePatterns.join(', ')}. `;
    }
    prompt += `\n\n`;

    // Add relevant memories grouped by type
    const promptMemories = memories.filter(m => m.interactionType === 'prompt').slice(0, 3);
    const responseMemories = memories.filter(m => m.interactionType === 'response').slice(0, 3);

    if (promptMemories.length > 0) {
      prompt += `Previous similar questions you've asked:\n`;
      for (const memory of promptMemories) {
        prompt += `- "${memory.content.substring(0, 100)}..."\n`;
      }
      prompt += `\n`;
    }

    if (responseMemories.length > 0) {
      prompt += `Previous relevant responses that worked well for you:\n`;
      for (const memory of responseMemories) {
        const satisfaction = memory.satisfactionScore ? ` (satisfaction: ${memory.satisfactionScore})` : '';
        prompt += `- "${memory.content.substring(0, 150)}..."${satisfaction}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Current question: ${query}\n\n`;
    prompt += `Please provide a response that builds on this context and adapts to my current cognitive state.`;

    return prompt;
  }

  private extractCognitiveAdaptations(
    memories: PersonalMemory[],
    currentCognitiveState: CognitiveState
  ): string[] {
    const adaptations: string[] = [];

    // Analyze patterns from successful past interactions
    const successfulMemories = memories.filter(m => 
      m.satisfactionScore && m.satisfactionScore > 0.7
    );

    if (successfulMemories.length > 0) {
      const avgCognitiveLoad = successfulMemories.reduce(
        (sum, m) => sum + m.cognitiveLoad, 0
      ) / successfulMemories.length;

      if (currentCognitiveState.cognitiveLoad > avgCognitiveLoad + 0.2) {
        adaptations.push('Simplify response based on past successful low-cognitive-load interactions');
      }

      const flowStateMemories = successfulMemories.filter(m => m.flowState);
      if (flowStateMemories.length > 0 && currentCognitiveState.flowState) {
        adaptations.push('Provide detailed, comprehensive response to support flow state');
      }
    }

    // Add pattern-specific adaptations
    for (const pattern of currentCognitiveState.activePatterns) {
      const patternMemories = memories.filter(m => 
        m.neurodivergentPatterns.includes(pattern)
      );

      if (patternMemories.length > 0) {
        switch (pattern) {
          case 'adhd':
            adaptations.push('Use structured, bullet-point format based on ADHD preference history');
            break;
          case 'autism':
            adaptations.push('Provide literal, detailed explanations based on autism interaction patterns');
            break;
          case 'dyslexia':
            adaptations.push('Use clear, simple language structure based on dyslexia-friendly interactions');
            break;
        }
      }
    }

    return adaptations;
  }

  private calculateMemoryInsights(
    rawMemories: PersonalMemory[],
    selectedMemories: PersonalMemory[],
    cognitiveState: CognitiveState
  ): RAGResponse['memoryInsights'] {
    const totalMemoriesFound = rawMemories.length;
    
    // Calculate average relevance (mock calculation)
    const averageRelevance = selectedMemories.length > 0 
      ? selectedMemories.reduce((sum, m) => sum + (m.satisfactionScore || 0.5), 0) / selectedMemories.length
      : 0;

    // Find cognitive pattern matches
    const cognitivePatternMatches = Array.from(new Set(
      selectedMemories.flatMap(m => 
        m.neurodivergentPatterns.filter(p => 
          cognitiveState.activePatterns.includes(p)
        )
      )
    ));

    // Calculate temporal spread (how far back the memories go)
    const timestamps = selectedMemories.map(m => m.timestamp.getTime());
    const temporalSpread = timestamps.length > 1 
      ? (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24) // Days
      : 0;

    return {
      totalMemoriesFound,
      averageRelevance,
      cognitivePatternMatches,
      temporalSpread
    };
  }

  private async calculateMemoryClusterSimilarity(
    memory: PersonalMemory,
    clusterMemories: PersonalMemory[],
    cognitiveState: CognitiveState
  ): Promise<number> {
    // Simple content similarity (in real implementation, use embeddings)
    const memoryWords = memory.content.toLowerCase().split(/\s+/);
    const clusterWords = clusterMemories
      .map(m => m.content.toLowerCase())
      .join(' ')
      .split(/\s+/);

    const commonWords = memoryWords.filter(word => clusterWords.includes(word));
    const contentSimilarity = commonWords.length / Math.max(memoryWords.length, 1);

    // Cognitive state similarity
    const cognitiveStateSimilarity = clusterMemories.reduce((sum, m) => {
      return sum + this.calculateCognitiveStateMatch(m, cognitiveState);
    }, 0) / Math.max(clusterMemories.length, 1);

    return (contentSimilarity * 0.6) + (cognitiveStateSimilarity * 0.4);
  }

  private calculateCognitiveStateMatch(
    memory: PersonalMemory,
    cognitiveState: CognitiveState
  ): number {
    const cognitiveLoadMatch = 1 - Math.abs(memory.cognitiveLoad - cognitiveState.cognitiveLoad);
    const attentionMatch = 1 - Math.abs(memory.attentionLevel - cognitiveState.attentionLevel);
    const flowStateMatch = memory.flowState === cognitiveState.flowState ? 1 : 0.5;
    
    const patternOverlap = memory.neurodivergentPatterns.filter(
      pattern => cognitiveState.activePatterns.includes(pattern)
    ).length;
    const maxPatterns = Math.max(
      memory.neurodivergentPatterns.length,
      cognitiveState.activePatterns.length,
      1
    );
    const patternMatch = patternOverlap / maxPatterns;

    return (cognitiveLoadMatch * 0.3) + 
           (attentionMatch * 0.3) + 
           (flowStateMatch * 0.2) + 
           (patternMatch * 0.2);
  }

  private extractCentralTopic(content: string): string {
    // Simple topic extraction (in real implementation, use NLP)
    const words = content.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'a', 'an']);
    
    const significantWords = words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 3);
    
    return significantWords.join(' ') || 'general';
  }

  private applyDiversityFiltering(
    memories: PersonalMemory[],
    diversityFactor: number
  ): PersonalMemory[] {
    if (diversityFactor <= 0) return memories;

    const diverse: PersonalMemory[] = [];
    const similarityThreshold = 1 - diversityFactor;

    for (const memory of memories) {
      let isTooSimilar = false;

      for (const existing of diverse) {
        // Simple content similarity check
        const similarity = this.calculateContentSimilarity(memory.content, existing.content);
        if (similarity > similarityThreshold) {
          isTooSimilar = true;
          break;
        }
      }

      if (!isTooSimilar) {
        diverse.push(memory);
      }
    }

    return diverse;
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    
    return totalUniqueWords > 0 ? commonWords.length / totalUniqueWords : 0;
  }
}