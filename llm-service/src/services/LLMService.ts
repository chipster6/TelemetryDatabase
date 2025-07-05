import { EventEmitter } from 'events';
import { TelemetryDatabaseClient } from './TelemetryDatabaseClient.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { SecureOllamaClient, OllamaSecurityConfig } from './SecureOllamaClient.js';
import { BiometricContext, LLMRequest, LLMResponse, TelemetryDatabaseConnection } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class LLMService extends EventEmitter {
  private telemetryClient: TelemetryDatabaseClient;
  private ollamaClient: OllamaClient | SecureOllamaClient;
  private isInitialized = false;
  private useSecureClient: boolean;

  constructor(telemetryConfig: TelemetryDatabaseConnection, ollamaConfig?: string | OllamaSecurityConfig) {
    super();
    this.telemetryClient = new TelemetryDatabaseClient(telemetryConfig);
    
    // Determine if we should use secure client based on config type
    if (typeof ollamaConfig === 'object' && ollamaConfig !== null) {
      this.useSecureClient = true;
      this.ollamaClient = new SecureOllamaClient(ollamaConfig);
      logger.info('LLMService using SecureOllamaClient with certificate pinning');
    } else {
      this.useSecureClient = false;
      this.ollamaClient = new OllamaClient(ollamaConfig as string);
      logger.warn('LLMService using standard OllamaClient - no certificate pinning');
    }
    
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing LLM Service...');
      
      // Initialize Ollama
      await this.ollamaClient.initialize();
      
      // Connect to TelemetryDatabase WebSocket
      this.telemetryClient.connectWebSocket();
      
      this.isInitialized = true;
      logger.info('LLM Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize LLM Service:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Subscribe to biometric events from TelemetryDatabase
    this.telemetryClient.subscribe('biometric_update', this.handleBiometricUpdate.bind(this));
    this.telemetryClient.subscribe('llm_request', this.handleLLMRequest.bind(this));
    
    // Handle connection events
    this.telemetryClient.subscribe('connected', () => {
      logger.info('Connected to TelemetryDatabase');
      this.emit('telemetry_connected');
    });
  }

  private async handleBiometricUpdate(data: any): Promise<void> {
    try {
      logger.debug('Received biometric update:', data);
      // Process biometric updates for real-time adaptations
      // This could be used for dynamic model switching based on cognitive load
      this.emit('biometric_update', data);
    } catch (error) {
      logger.error('Error handling biometric update:', error);
    }
  }

  private async handleLLMRequest(data: LLMRequest): Promise<void> {
    try {
      logger.info('Processing LLM request', { userId: data.userId });
      const response = await this.generateWithBiometricContext(data.prompt, data.userId);
      this.emit('llm_response', { userId: data.userId, response });
    } catch (error) {
      logger.error('Error handling LLM request:', error);
      this.emit('llm_error', { userId: data.userId, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async generateWithBiometricContext(prompt: string, userId: string): Promise<LLMResponse> {
    if (!this.isInitialized) {
      throw new Error('LLM Service not initialized');
    }

    try {
      // Get biometric context from TelemetryDatabase
      const biometricContext = await this.telemetryClient.getLLMContext(userId);
      
      logger.info('Generating with biometric context', {
        userId,
        cognitiveLoad: biometricContext.metadata.cognitiveLoad,
        flowState: biometricContext.metadata.flowState,
        temperature: biometricContext.temperature
      });

      // Adapt prompt based on cognitive state
      const adaptedPrompt = this.adaptPromptForCognition(prompt, biometricContext);
      
      // Generate response with biometric-informed parameters
      const generationResult = await this.ollamaClient.generate(adaptedPrompt, {
        model: 'mistral:7b-instruct-q4',
        temperature: biometricContext.temperature,
        maxTokens: biometricContext.maxTokens,
        systemPrompt: biometricContext.systemPrompt
      });

      const response: LLMResponse = {
        response: generationResult.response,
        metadata: {
          model: 'mistral:7b-instruct-q4',
          temperature: biometricContext.temperature,
          tokensUsed: generationResult.tokensUsed,
          cognitiveAdaptations: this.getCognitiveAdaptations(biometricContext)
        }
      };

      // Store interaction in personal memory
      await this.telemetryClient.storeMemory({
        userId,
        prompt,
        response: response.response,
        timestamp: new Date()
      });

      logger.info('Generated response successfully', { 
        userId, 
        tokensUsed: generationResult.tokensUsed,
        adaptations: response.metadata.cognitiveAdaptations
      });

      return response;
    } catch (error) {
      logger.error('Failed to generate with biometric context:', error);
      throw error;
    }
  }

  private adaptPromptForCognition(prompt: string, context: BiometricContext): string {
    let adaptedPrompt = prompt;

    if (context.metadata.shouldSimplify) {
      adaptedPrompt = `Please provide a clear, concise response. ${adaptedPrompt}`;
    }

    if (context.metadata.flowState) {
      adaptedPrompt = `The user is in a focused flow state. Provide a detailed, comprehensive response. ${adaptedPrompt}`;
    }

    if (context.metadata.cognitiveLoad > 80) {
      adaptedPrompt = `Please keep your response brief and easy to understand. ${adaptedPrompt}`;
    }

    return adaptedPrompt;
  }

  private getCognitiveAdaptations(context: BiometricContext): string[] {
    const adaptations: string[] = [];

    if (context.metadata.shouldSimplify) {
      adaptations.push('simplified_response');
    }
    
    if (context.metadata.flowState) {
      adaptations.push('enhanced_detail');
    }
    
    if (context.temperature < 0.5) {
      adaptations.push('focused_output');
    }
    
    if (context.maxTokens < 1000) {
      adaptations.push('shortened_response');
    }

    return adaptations;
  }

  async generateStream(prompt: string, userId: string, onToken: (token: string) => void): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('LLM Service not initialized');
    }

    try {
      const biometricContext = await this.telemetryClient.getLLMContext(userId);
      const adaptedPrompt = this.adaptPromptForCognition(prompt, biometricContext);

      const response = await this.ollamaClient.generateStream(adaptedPrompt, {
        model: 'mistral:7b-instruct-q4',
        temperature: biometricContext.temperature,
        maxTokens: biometricContext.maxTokens,
        systemPrompt: biometricContext.systemPrompt,
        onToken
      });

      // Store the complete interaction
      await this.telemetryClient.storeMemory({
        userId,
        prompt,
        response,
        timestamp: new Date()
      });

      return response;
    } catch (error) {
      logger.error('Failed to generate streaming response:', error);
      throw error;
    }
  }

  getModelStatus(): any {
    const baseStatus = {
      initialized: this.isInitialized,
      loadedModels: this.ollamaClient.getLoadedModels(),
      telemetryConnected: this.telemetryClient.listenerCount('connected') > 0,
      secureConnection: this.useSecureClient
    };

    // Add security stats if using secure client
    if (this.useSecureClient && this.ollamaClient instanceof SecureOllamaClient) {
      return {
        ...baseStatus,
        connectionStats: this.ollamaClient.getConnectionStats(),
        securityConfig: this.ollamaClient.getSecurityConfig()
      };
    }

    return baseStatus;
  }

  async updateCertificatePins(fingerprints: string[]): Promise<void> {
    if (!this.useSecureClient || !(this.ollamaClient instanceof SecureOllamaClient)) {
      throw new Error('Certificate pinning only available with SecureOllamaClient');
    }

    logger.info('Updating Ollama certificate pins', {
      newPinCount: fingerprints.length,
      fingerprints: fingerprints
    });

    this.ollamaClient.updatePinnedCertificates(fingerprints);
    
    // Test the connection with new pins
    const connectionTest = await this.ollamaClient.testSecureConnection();
    if (!connectionTest) {
      logger.error('Certificate pin update failed - connection test failed');
      throw new Error('Certificate pin update failed - unable to establish secure connection');
    }

    logger.info('Certificate pins updated successfully');
  }

  async testSecureConnection(): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> {
    if (!this.useSecureClient || !(this.ollamaClient instanceof SecureOllamaClient)) {
      return {
        success: false,
        error: 'Secure connection testing only available with SecureOllamaClient'
      };
    }

    try {
      const success = await this.ollamaClient.testSecureConnection();
      const stats = this.ollamaClient.getConnectionStats();
      
      return {
        success,
        stats
      };
    } catch (error) {
      logger.error('Secure connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getSecurityStatus(): {
    certificatePinningEnabled: boolean;
    connectionStats?: any;
    securityConfig?: any;
  } {
    if (!this.useSecureClient || !(this.ollamaClient instanceof SecureOllamaClient)) {
      return {
        certificatePinningEnabled: false
      };
    }

    return {
      certificatePinningEnabled: true,
      connectionStats: this.ollamaClient.getConnectionStats(),
      securityConfig: this.ollamaClient.getSecurityConfig()
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down LLM Service...');
    
    // Close secure client if using it
    if (this.useSecureClient && this.ollamaClient instanceof SecureOllamaClient) {
      await this.ollamaClient.close();
    }
    
    this.telemetryClient.disconnect();
    this.isInitialized = false;
    this.emit('shutdown');
  }
}