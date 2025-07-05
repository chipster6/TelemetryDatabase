import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { BiometricPromptAdapter } from './BiometricPromptAdapter.js';
import { CognitiveStateMapper } from './CognitiveStateMapper.js';

export interface BiometricData {
  userId: string;
  heartRate: number;
  heartRateVariability: number;
  skinConductance: number;
  brainwaveAlpha: number;
  brainwaveBeta: number;
  brainwaveTheta: number;
  brainwaveGamma: number;
  timestamp: Date;
}

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

export interface LLMRequest {
  userId: string;
  prompt: string;
  biometricContext?: BiometricContext;
}

export class BiometricLLMBridge {
  private promptAdapter: BiometricPromptAdapter;
  private cognitiveMapper: CognitiveStateMapper;
  private llmServiceUrl: string;

  constructor(llmServiceUrl: string = 'http://llm-service:3001') {
    this.llmServiceUrl = llmServiceUrl;
    this.promptAdapter = new BiometricPromptAdapter();
    this.cognitiveMapper = new CognitiveStateMapper();
  }

  async prepareLLMContext(
    userId: string, 
    prompt: string, 
    biometricData: BiometricData
  ): Promise<LLMRequest> {
    try {
      logger.info(`Preparing LLM context for user ${userId}`);

      // Map biometric data to cognitive state
      const cognitiveState = this.cognitiveMapper.mapBiometricsToCognitive(biometricData);
      
      // Adapt prompt based on cognitive state
      const adaptedPrompt = await this.promptAdapter.adaptPrompt(prompt, cognitiveState);
      
      // Generate biometric context for LLM
      const biometricContext = await this.generateBiometricContext(cognitiveState);

      const llmRequest: LLMRequest = {
        userId,
        prompt: adaptedPrompt,
        biometricContext
      };

      logger.debug('Generated LLM request with biometric context', {
        userId,
        cognitiveLoad: cognitiveState.cognitiveLoad,
        flowState: cognitiveState.flowState,
        adaptedPromptLength: adaptedPrompt.length
      });

      return llmRequest;
    } catch (error) {
      logger.error('Failed to prepare LLM context:', error);
      throw new Error('Failed to prepare biometric-aware LLM context');
    }
  }

  async sendToLLMService(llmRequest: LLMRequest): Promise<any> {
    try {
      logger.info(`Sending request to LLM service for user ${llmRequest.userId}`);

      const response = await axios.post(`${this.llmServiceUrl}/api/generate`, llmRequest, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      logger.debug('LLM service response received', {
        userId: llmRequest.userId,
        responseLength: response.data.response?.length || 0
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to communicate with LLM service:', error);
      throw new Error('Failed to send request to LLM service');
    }
  }

  private async generateBiometricContext(cognitiveState: any): Promise<BiometricContext> {
    // Generate system prompt based on cognitive state
    const systemPrompt = this.promptAdapter.generateSystemPrompt(cognitiveState);
    
    // Calculate temperature and token limits based on cognitive load
    const temperature = this.cognitiveMapper.calculateTemperature(cognitiveState);
    const maxTokens = this.cognitiveMapper.calculateTokenLimit(cognitiveState);

    return {
      systemPrompt,
      temperature,
      maxTokens,
      metadata: {
        flowState: cognitiveState.flowState,
        cognitiveLoad: cognitiveState.cognitiveLoad,
        shouldSimplify: cognitiveState.cognitiveLoad > 0.7,
        attentionLevel: cognitiveState.attentionLevel,
        neurodivergentPatterns: cognitiveState.activePatterns
      }
    };
  }

  async processLLMRequest(
    userId: string,
    prompt: string,
    biometricData: BiometricData
  ): Promise<any> {
    try {
      // Prepare biometric-aware context
      const llmRequest = await this.prepareLLMContext(userId, prompt, biometricData);
      
      // Send to LLM service
      const response = await this.sendToLLMService(llmRequest);
      
      return {
        ...response,
        biometricMetadata: llmRequest.biometricContext?.metadata
      };
    } catch (error) {
      logger.error('Failed to process LLM request:', error);
      throw error;
    }
  }
}