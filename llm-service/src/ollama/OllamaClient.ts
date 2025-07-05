import { Ollama } from 'ollama';
import { ModelConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class OllamaClient {
  private client: Ollama;
  private loadedModels: Map<string, ModelConfig> = new Map();

  constructor(host: string = 'http://localhost:11434') {
    this.client = new Ollama({ host });
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      await this.client.list();
      logger.info('Connected to Ollama successfully');
      
      // Load default model
      await this.loadModel('mistral:7b-instruct-q4');
    } catch (error) {
      logger.error('Failed to initialize Ollama:', error);
      throw error;
    }
  }

  async loadModel(modelName: string): Promise<void> {
    try {
      logger.info(`Loading model: ${modelName}`);
      
      // Pull model if not exists
      const models = await this.client.list();
      const modelExists = models.models.some(m => m.name === modelName);
      
      if (!modelExists) {
        logger.info(`Pulling model: ${modelName}`);
        await this.client.pull({ model: modelName });
      }

      // Test generation to ensure model is loaded
      await this.client.generate({
        model: modelName,
        prompt: 'Hello',
        options: { num_predict: 1 }
      });

      const modelConfig: ModelConfig = {
        name: modelName,
        path: modelName,
        loaded: true,
        quantization: modelName.includes('q4') ? 'Q4' : 'Unknown',
        parameters: '7B'
      };

      this.loadedModels.set(modelName, modelConfig);
      logger.info(`Model loaded successfully: ${modelName}`);
    } catch (error) {
      logger.error(`Failed to load model ${modelName}:`, error);
      throw error;
    }
  }

  async generate(prompt: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}): Promise<{ response: string; tokensUsed: number }> {
    const {
      model = 'mistral:7b-instruct-q4',
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt
    } = options;

    try {
      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`
        : prompt;

      const response = await this.client.generate({
        model,
        prompt: fullPrompt,
        options: {
          temperature,
          num_predict: maxTokens,
          top_p: 0.9,
          repeat_penalty: 1.1
        }
      });

      return {
        response: response.response.trim(),
        tokensUsed: response.eval_count || 0
      };
    } catch (error) {
      logger.error('Generation failed:', error);
      throw error;
    }
  }

  async generateStream(prompt: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    onToken?: (token: string) => void;
  } = {}): Promise<string> {
    const {
      model = 'mistral:7b-instruct-q4',
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt,
      onToken
    } = options;

    try {
      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`
        : prompt;

      let fullResponse = '';

      const stream = await this.client.generate({
        model,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature,
          num_predict: maxTokens,
          top_p: 0.9,
          repeat_penalty: 1.1
        }
      });

      for await (const chunk of stream) {
        if (chunk.response) {
          fullResponse += chunk.response;
          onToken?.(chunk.response);
        }
      }

      return fullResponse.trim();
    } catch (error) {
      logger.error('Streaming generation failed:', error);
      throw error;
    }
  }

  getLoadedModels(): ModelConfig[] {
    return Array.from(this.loadedModels.values());
  }

  isModelLoaded(modelName: string): boolean {
    return this.loadedModels.has(modelName) && this.loadedModels.get(modelName)?.loaded === true;
  }

  async unloadModel(modelName: string): Promise<void> {
    try {
      // Ollama doesn't have explicit unload, but we can remove from our tracking
      this.loadedModels.delete(modelName);
      logger.info(`Model unloaded: ${modelName}`);
    } catch (error) {
      logger.error(`Failed to unload model ${modelName}:`, error);
      throw error;
    }
  }
}