export interface BiometricContext {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  metadata: {
    flowState: boolean;
    cognitiveLoad: number;
    shouldSimplify: boolean;
    attentionLevel?: number;
    neurodivergentPatterns?: string[];
  };
}

export interface CognitiveState {
  cognitiveLoad: number;
  attentionLevel: number;
  flowState: boolean;
  activePatterns: string[];
  timestamp: Date;
}

export interface LLMRequest {
  userId: string;
  prompt: string;
  biometricContext?: BiometricContext;
}

export interface LLMResponse {
  response: string;
  metadata: {
    model: string;
    temperature: number;
    tokensUsed: number;
    cognitiveAdaptations: string[];
  };
}

export interface ModelConfig {
  name: string;
  path: string;
  loaded: boolean;
  quantization: string;
  parameters: string;
}

export interface TelemetryDatabaseConnection {
  baseURL: string;
  wsURL: string;
  apiKey?: string;
}