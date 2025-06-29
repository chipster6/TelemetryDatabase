import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "sk-placeholder"
});

export interface BiometricContext {
  heartRate?: number;
  hrv?: number;
  stressLevel?: number;
  attentionLevel?: number;
  cognitiveLoad?: number;
  environmentalFactors?: {
    soundLevel?: number;
    temperature?: number;
    lightLevel?: number;
  };
}

export interface PromptRequest {
  systemPrompt: string;
  userInput: string;
  temperature?: number;
  maxTokens?: number;
  biometricContext?: BiometricContext;
}

export interface PromptResponse {
  content: string;
  responseTime: number;
  biometricAdaptations?: string[];
  cognitiveComplexityScore?: number;
}

export class OpenAIService {
  async generateResponse(request: PromptRequest): Promise<PromptResponse> {
    const startTime = Date.now();
    
    try {
      // Adapt system prompt based on biometric context
      const adaptedSystemPrompt = this.adaptPromptToBiometrics(
        request.systemPrompt, 
        request.biometricContext
      );

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: adaptedSystemPrompt },
          { role: "user", content: request.userInput }
        ],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
      });

      const responseTime = Date.now() - startTime;
      const content = response.choices[0].message.content || "";

      return {
        content,
        responseTime,
        biometricAdaptations: this.getBiometricAdaptations(request.biometricContext),
        cognitiveComplexityScore: this.calculateCognitiveComplexity(content)
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  private adaptPromptToBiometrics(systemPrompt: string, context?: BiometricContext): string {
    if (!context) return systemPrompt;

    let adaptations: string[] = [];

    // Stress level adaptations
    if (context.stressLevel !== undefined) {
      if (context.stressLevel > 70) {
        adaptations.push("Keep responses calm and reassuring. Use simple, clear language.");
      } else if (context.stressLevel < 30) {
        adaptations.push("Feel free to be more creative and detailed in your responses.");
      }
    }

    // Attention level adaptations
    if (context.attentionLevel !== undefined) {
      if (context.attentionLevel < 50) {
        adaptations.push("Keep responses concise and well-structured with clear bullet points.");
      } else if (context.attentionLevel > 80) {
        adaptations.push("You can provide more comprehensive and detailed responses.");
      }
    }

    // Cognitive load adaptations
    if (context.cognitiveLoad !== undefined) {
      if (context.cognitiveLoad > 70) {
        adaptations.push("Simplify complex concepts and avoid jargon.");
      }
    }

    // HRV adaptations (indicates recovery state)
    if (context.hrv !== undefined) {
      if (context.hrv > 45) {
        adaptations.push("The user is in an optimal cognitive state for complex tasks.");
      } else if (context.hrv < 30) {
        adaptations.push("The user may be fatigued - keep responses supportive and encouraging.");
      }
    }

    if (adaptations.length > 0) {
      return `${systemPrompt}\n\nBiometric Context Adaptations:\n${adaptations.join('\n')}`;
    }

    return systemPrompt;
  }

  private getBiometricAdaptations(context?: BiometricContext): string[] {
    if (!context) return [];

    const adaptations: string[] = [];

    if (context.stressLevel !== undefined && context.stressLevel > 70) {
      adaptations.push("Adapted for high stress state");
    }

    if (context.attentionLevel !== undefined && context.attentionLevel < 50) {
      adaptations.push("Optimized for limited attention");
    }

    if (context.cognitiveLoad !== undefined && context.cognitiveLoad > 70) {
      adaptations.push("Simplified for cognitive load");
    }

    if (context.hrv !== undefined && context.hrv > 45) {
      adaptations.push("Enhanced for optimal HRV state");
    }

    return adaptations;
  }

  private calculateCognitiveComplexity(content: string): number {
    // Simple heuristic for cognitive complexity
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const complexWords = words.filter(w => w.length > 6).length;
    const complexWordsRatio = complexWords / words.length;

    // Score from 0-100 based on sentence length and complex word usage
    const lengthScore = Math.min(avgWordsPerSentence / 20 * 50, 50);
    const complexityScore = complexWordsRatio * 50;

    return Math.round(lengthScore + complexityScore);
  }

  async analyzeSentiment(text: string): Promise<{
    rating: number;
    confidence: number;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis expert. Analyze the sentiment of the text and provide a rating from 1 to 5 stars and a confidence score between 0 and 1. Respond with JSON in this format: { 'rating': number, 'confidence': number }"
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        rating: Math.max(1, Math.min(5, Math.round(result.rating || 3))),
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return { rating: 3, confidence: 0.5 };
    }
  }
}

export const openaiService = new OpenAIService();
