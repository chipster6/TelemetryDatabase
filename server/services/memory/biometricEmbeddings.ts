import { logger } from '../../utils/logger.js';

export interface CognitiveState {
  cognitiveLoad: number;
  attentionLevel: number;
  flowState: boolean;
  activePatterns: string[];
  timestamp: Date;
}

export interface BiometricEmbeddingFeatures {
  cognitiveLoadWeight: number;
  attentionWeight: number;
  flowStateBoost: number;
  patternModifiers: number[];
  temporalDecay: number;
}

export class BiometricEmbeddings {
  private readonly embeddingDimension = 384; // Standard sentence transformer dimension
  private readonly cognitiveFeatureWeights = {
    cognitiveLoad: 0.3,
    attentionLevel: 0.3,
    flowState: 0.2,
    patterns: 0.2
  };

  private readonly neurodivergentModifiers = {
    'adhd': {
      attentionBoost: 1.2,
      focusVariability: 0.8,
      creativityBoost: 1.1
    },
    'autism': {
      detailFocus: 1.3,
      consistencyBoost: 1.2,
      patternRecognition: 1.4
    },
    'dyslexia': {
      visualProcessing: 0.9,
      auditoryBoost: 1.1,
      structurePreference: 1.2
    }
  };

  async generateBiometricEmbedding(
    text: string, 
    cognitiveState: CognitiveState
  ): Promise<number[]> {
    try {
      logger.debug('Generating biometric-enhanced embedding', {
        textLength: text.length,
        cognitiveLoad: cognitiveState.cognitiveLoad,
        flowState: cognitiveState.flowState
      });

      // Generate base semantic embedding
      const baseEmbedding = await this.generateSemanticEmbedding(text);
      
      // Extract biometric features
      const biometricFeatures = this.extractBiometricFeatures(cognitiveState);
      
      // Apply biometric enhancement
      const enhancedEmbedding = this.applyBiometricEnhancement(
        baseEmbedding, 
        biometricFeatures
      );

      // Apply neurodivergent pattern modifications
      const finalEmbedding = this.applyNeurodivergentModifications(
        enhancedEmbedding,
        cognitiveState.activePatterns
      );

      logger.debug('Biometric embedding generated', {
        dimension: finalEmbedding.length,
        cognitiveInfluence: biometricFeatures.cognitiveLoadWeight
      });

      return finalEmbedding;
    } catch (error) {
      logger.error('Failed to generate biometric embedding:', error);
      // Fallback to basic semantic embedding
      return this.generateSemanticEmbedding(text);
    }
  }

  private async generateSemanticEmbedding(text: string): Promise<number[]> {
    // In a real implementation, this would use a sentence transformer model
    // For now, we'll create a deterministic embedding based on text content
    const normalizedText = text.toLowerCase().trim();
    const words = normalizedText.split(/\s+/);
    
    // Create a simple hash-based embedding
    const embedding = new Array(this.embeddingDimension).fill(0);
    
    // Use multiple hash functions to distribute values
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash1 = this.simpleHash(word, 1);
      const hash2 = this.simpleHash(word, 2);
      const hash3 = this.simpleHash(word, 3);
      
      // Distribute word influence across multiple dimensions
      for (let dim = 0; dim < this.embeddingDimension; dim++) {
        const influence = Math.sin((hash1 + dim) * hash2) * 
                         Math.cos((hash2 + dim) * hash3) * 
                         (1.0 / Math.sqrt(words.length));
        embedding[dim] += influence;
      }
    }
    
    // Normalize the embedding
    return this.normalizeVector(embedding);
  }

  private extractBiometricFeatures(cognitiveState: CognitiveState): BiometricEmbeddingFeatures {
    // Calculate cognitive load influence (high load reduces complexity)
    const cognitiveLoadWeight = 1.0 - (cognitiveState.cognitiveLoad * 0.5);
    
    // Calculate attention influence (high attention increases focus)
    const attentionWeight = 0.5 + (cognitiveState.attentionLevel * 0.5);
    
    // Flow state provides significant boost to embedding quality
    const flowStateBoost = cognitiveState.flowState ? 1.2 : 1.0;
    
    // Calculate pattern-specific modifiers
    const patternModifiers = this.calculatePatternModifiers(cognitiveState.activePatterns);
    
    // Calculate temporal decay based on how recent the state is
    const timeDelta = Date.now() - cognitiveState.timestamp.getTime();
    const temporalDecay = Math.exp(-timeDelta / (1000 * 60 * 30)); // 30-minute half-life
    
    return {
      cognitiveLoadWeight,
      attentionWeight,
      flowStateBoost,
      patternModifiers,
      temporalDecay
    };
  }

  private applyBiometricEnhancement(
    baseEmbedding: number[],
    features: BiometricEmbeddingFeatures
  ): number[] {
    const enhanced = [...baseEmbedding];
    
    // Apply cognitive load modulation
    for (let i = 0; i < enhanced.length; i++) {
      // Cognitive load affects the prominence of features
      enhanced[i] *= features.cognitiveLoadWeight;
      
      // Attention level affects the sharpness of features
      enhanced[i] = this.applyAttentionSharpening(enhanced[i], features.attentionWeight);
      
      // Flow state provides overall boost
      enhanced[i] *= features.flowStateBoost;
      
      // Apply temporal decay
      enhanced[i] *= features.temporalDecay;
    }
    
    return this.normalizeVector(enhanced);
  }

  private applyNeurodivergentModifications(
    embedding: number[],
    patterns: string[]
  ): number[] {
    let modified = [...embedding];
    
    for (const pattern of patterns) {
      const modifiers = this.neurodivergentModifiers[pattern as keyof typeof this.neurodivergentModifiers];
      if (modifiers) {
        modified = this.applyPatternModifications(modified, modifiers);
      }
    }
    
    return this.normalizeVector(modified);
  }

  private calculatePatternModifiers(patterns: string[]): number[] {
    const modifiers = new Array(this.embeddingDimension).fill(1.0);
    
    for (const pattern of patterns) {
      const patternModifiers = this.neurodivergentModifiers[pattern as keyof typeof this.neurodivergentModifiers];
      if (patternModifiers) {
        // Apply pattern-specific modifications to different dimensions
        for (let i = 0; i < this.embeddingDimension; i++) {
          const dimType = i % 4; // Cycle through 4 types of dimensions
          
          switch (dimType) {
            case 0: // Attention-related dimensions
              modifiers[i] *= patternModifiers.attentionBoost || 1.0;
              break;
            case 1: // Detail-related dimensions
              modifiers[i] *= patternModifiers.detailFocus || 1.0;
              break;
            case 2: // Creativity-related dimensions
              modifiers[i] *= patternModifiers.creativityBoost || 1.0;
              break;
            case 3: // Pattern recognition dimensions
              modifiers[i] *= patternModifiers.patternRecognition || 1.0;
              break;
          }
        }
      }
    }
    
    return modifiers;
  }

  private applyPatternModifications(
    embedding: number[],
    modifiers: any
  ): number[] {
    const modified = [...embedding];
    
    // Apply different modifications to different regions of the embedding
    const regionSize = Math.floor(this.embeddingDimension / 4);
    
    // Region 1: Attention/Focus (first quarter)
    for (let i = 0; i < regionSize; i++) {
      modified[i] *= modifiers.attentionBoost || 1.0;
      modified[i] *= modifiers.focusVariability || 1.0;
    }
    
    // Region 2: Detail Processing (second quarter)
    for (let i = regionSize; i < regionSize * 2; i++) {
      modified[i] *= modifiers.detailFocus || 1.0;
      modified[i] *= modifiers.visualProcessing || 1.0;
    }
    
    // Region 3: Creativity/Flexibility (third quarter)
    for (let i = regionSize * 2; i < regionSize * 3; i++) {
      modified[i] *= modifiers.creativityBoost || 1.0;
      modified[i] *= modifiers.auditoryBoost || 1.0;
    }
    
    // Region 4: Pattern Recognition/Structure (fourth quarter)
    for (let i = regionSize * 3; i < this.embeddingDimension; i++) {
      modified[i] *= modifiers.patternRecognition || 1.0;
      modified[i] *= modifiers.consistencyBoost || 1.0;
      modified[i] *= modifiers.structurePreference || 1.0;
    }
    
    return modified;
  }

  private applyAttentionSharpening(value: number, attentionLevel: number): number {
    // Higher attention makes features more pronounced
    const sharpening = 1.0 + (attentionLevel - 0.5) * 0.3;
    return value * sharpening;
  }

  private simpleHash(str: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    
    return vector.map(val => val / magnitude);
  }

  // Method to calculate similarity between two biometric-enhanced embeddings
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.max(-1, Math.min(1, similarity)); // Clamp to [-1, 1]
  }

  // Method to enhance existing embeddings with new cognitive state
  async enhanceExistingEmbedding(
    baseEmbedding: number[],
    cognitiveState: CognitiveState
  ): Promise<number[]> {
    const biometricFeatures = this.extractBiometricFeatures(cognitiveState);
    const enhanced = this.applyBiometricEnhancement(baseEmbedding, biometricFeatures);
    return this.applyNeurodivergentModifications(enhanced, cognitiveState.activePatterns);
  }

  // Method to get embedding statistics for debugging
  getEmbeddingStats(embedding: number[]): {
    dimension: number;
    magnitude: number;
    mean: number;
    variance: number;
    sparsity: number;
  } {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
    const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
    const nonZeroCount = embedding.filter(val => Math.abs(val) > 1e-10).length;
    const sparsity = 1 - (nonZeroCount / embedding.length);
    
    return {
      dimension: embedding.length,
      magnitude,
      mean,
      variance,
      sparsity
    };
  }
}