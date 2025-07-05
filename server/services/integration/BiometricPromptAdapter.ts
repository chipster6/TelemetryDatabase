import { logger } from '../../utils/logger.js';

export interface CognitiveState {
  cognitiveLoad: number;
  attentionLevel: number;
  flowState: boolean;
  activePatterns: string[];
  timestamp: Date;
}

export class BiometricPromptAdapter {
  private readonly neurodivergentPatterns = {
    'adhd': {
      highCognitive: 'Break down complex information into smaller, digestible chunks. Use bullet points and clear structure.',
      lowAttention: 'Provide concise, focused responses. Minimize distractions and highlight key points.',
      flowState: 'Maintain current momentum. Provide detailed information that supports deep focus.'
    },
    'autism': {
      highCognitive: 'Use literal, precise language. Avoid metaphors and provide concrete examples.',
      lowAttention: 'Reduce sensory overload in responses. Use clear, direct communication.',
      flowState: 'Respect the special interest focus. Provide deep, detailed information in the area of interest.'
    },
    'dyslexia': {
      highCognitive: 'Use simple sentence structures. Organize information clearly with headers and sections.',
      lowAttention: 'Minimize text density. Use visual aids and clear formatting when possible.',
      flowState: 'Support continued reading with well-structured, easy-to-follow content.'
    }
  };

  async adaptPrompt(originalPrompt: string, cognitiveState: CognitiveState): Promise<string> {
    try {
      logger.debug('Adapting prompt based on cognitive state', {
        cognitiveLoad: cognitiveState.cognitiveLoad,
        attentionLevel: cognitiveState.attentionLevel,
        flowState: cognitiveState.flowState,
        patterns: cognitiveState.activePatterns
      });

      let adaptedPrompt = originalPrompt;

      // Apply cognitive load adaptations
      if (cognitiveState.cognitiveLoad > 0.7) {
        adaptedPrompt = this.simplifyForHighCognitiveLoad(adaptedPrompt);
      }

      // Apply attention level adaptations
      if (cognitiveState.attentionLevel < 0.4) {
        adaptedPrompt = this.enhanceForLowAttention(adaptedPrompt);
      }

      // Apply flow state adaptations
      if (cognitiveState.flowState) {
        adaptedPrompt = this.enhanceForFlowState(adaptedPrompt);
      }

      // Apply neurodivergent pattern adaptations
      for (const pattern of cognitiveState.activePatterns) {
        adaptedPrompt = this.applyNeurodivergentAdaptation(adaptedPrompt, pattern, cognitiveState);
      }

      logger.debug('Prompt adaptation completed', {
        originalLength: originalPrompt.length,
        adaptedLength: adaptedPrompt.length
      });

      return adaptedPrompt;
    } catch (error) {
      logger.error('Failed to adapt prompt:', error);
      return originalPrompt; // Fallback to original
    }
  }

  generateSystemPrompt(cognitiveState: CognitiveState): string {
    let systemPrompt = 'You are a helpful AI assistant that adapts responses based on the user\'s current cognitive state.';

    // Base cognitive adaptations
    if (cognitiveState.cognitiveLoad > 0.7) {
      systemPrompt += ' The user is experiencing high cognitive load. Provide clear, concise responses with simple language and well-organized structure.';
    }

    if (cognitiveState.attentionLevel < 0.4) {
      systemPrompt += ' The user has low attention capacity. Keep responses focused and highlight the most important information.';
    }

    if (cognitiveState.flowState) {
      systemPrompt += ' The user is in a flow state. Provide detailed, comprehensive information that supports their current focus.';
    }

    // Neurodivergent adaptations
    for (const pattern of cognitiveState.activePatterns) {
      systemPrompt += this.getNeurodivergentSystemPrompt(pattern, cognitiveState);
    }

    systemPrompt += ' Always be supportive and understanding of different cognitive needs and processing styles.';

    return systemPrompt;
  }

  private simplifyForHighCognitiveLoad(prompt: string): string {
    // Add instruction for simplified response
    const simplificationInstruction = '\n\nPlease provide a clear, simplified response that minimizes cognitive overhead. Use bullet points and break down complex concepts into smaller parts.';
    return prompt + simplificationInstruction;
  }

  private enhanceForLowAttention(prompt: string): string {
    // Add instruction for focused response
    const focusInstruction = '\n\nPlease provide a concise, focused response. Highlight the most important points and avoid unnecessary details.';
    return prompt + focusInstruction;
  }

  private enhanceForFlowState(prompt: string): string {
    // Add instruction to support deep engagement
    const flowInstruction = '\n\nThe user is in a flow state. Please provide a comprehensive, detailed response that supports continued deep engagement with the topic.';
    return prompt + flowInstruction;
  }

  private applyNeurodivergentAdaptation(prompt: string, pattern: string, cognitiveState: CognitiveState): string {
    const adaptations = this.neurodivergentPatterns[pattern as keyof typeof this.neurodivergentPatterns];
    if (!adaptations) return prompt;

    let instruction = '';

    if (cognitiveState.cognitiveLoad > 0.7 && adaptations.highCognitive) {
      instruction += `\n\nCognitive adaptation: ${adaptations.highCognitive}`;
    }

    if (cognitiveState.attentionLevel < 0.4 && adaptations.lowAttention) {
      instruction += `\n\nAttention adaptation: ${adaptations.lowAttention}`;
    }

    if (cognitiveState.flowState && adaptations.flowState) {
      instruction += `\n\nFlow state adaptation: ${adaptations.flowState}`;
    }

    return prompt + instruction;
  }

  private getNeurodivergentSystemPrompt(pattern: string, cognitiveState: CognitiveState): string {
    switch (pattern) {
      case 'adhd':
        return ' The user has ADHD. Structure your responses clearly with headers and bullet points. Be concise but thorough.';
      case 'autism':
        return ' The user is autistic. Use literal, precise language. Avoid metaphors and provide concrete examples.';
      case 'dyslexia':
        return ' The user has dyslexia. Use simple sentence structures and organize information clearly.';
      default:
        return '';
    }
  }

  // Method to analyze and detect potential neurodivergent patterns from biometric data
  detectNeurodivergentPatterns(biometricData: any): string[] {
    const patterns: string[] = [];

    // ADHD indicators: high variability in attention metrics
    if (this.isHighVariability(biometricData.heartRateVariability) && 
        biometricData.brainwaveBeta > biometricData.brainwaveAlpha * 1.5) {
      patterns.push('adhd');
    }

    // Autism indicators: specific brainwave patterns and consistent responses
    if (biometricData.brainwaveGamma > 0.6 && 
        this.isLowVariability(biometricData.skinConductance)) {
      patterns.push('autism');
    }

    // Dyslexia indicators: specific attention and processing patterns
    if (biometricData.brainwaveTheta > biometricData.brainwaveAlpha &&
        this.isHighVariability(biometricData.heartRate)) {
      patterns.push('dyslexia');
    }

    return patterns;
  }

  private isHighVariability(value: number): boolean {
    return value > 0.7; // Threshold for high variability
  }

  private isLowVariability(value: number): boolean {
    return value < 0.3; // Threshold for low variability
  }
}