import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BiometricContext, LLMRequest, TelemetryDatabaseConnection } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class TelemetryDatabaseClient extends EventEmitter {
  private httpClient: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private config: TelemetryDatabaseConnection;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: TelemetryDatabaseConnection) {
    super();
    this.config = config;
    
    this.httpClient = axios.create({
      baseURL: config.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });

    this.setupHttpInterceptors();
  }

  private setupHttpInterceptors(): void {
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('TelemetryDatabase HTTP error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        throw error;
      }
    );
  }

  async getLLMContext(userId: string): Promise<BiometricContext> {
    try {
      const response = await this.httpClient.post('/api/llm/prepare-context', { userId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get LLM context:', error);
      // Fallback context for resilience
      return {
        systemPrompt: 'You are a helpful AI assistant.',
        temperature: 0.7,
        maxTokens: 2000,
        metadata: {
          flowState: false,
          cognitiveLoad: 50,
          shouldSimplify: false
        }
      };
    }
  }

  async storeMemory(interaction: {
    userId: string;
    prompt: string;
    response: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.httpClient.post('/api/memory/store', interaction);
      logger.info('Memory stored successfully', { userId: interaction.userId });
    } catch (error) {
      logger.error('Failed to store memory:', error);
      // Non-blocking - continue operation even if memory storage fails
    }
  }

  connectWebSocket(): void {
    if (this.wsClient) return;

    try {
      this.wsClient = new WebSocket(this.config.wsURL);
      
      this.wsClient.on('open', () => {
        logger.info('Connected to TelemetryDatabase WebSocket');
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.wsClient.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit(message.type, message.data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });

      this.wsClient.on('close', () => {
        logger.warn('TelemetryDatabase WebSocket disconnected');
        this.wsClient = null;
        this.scheduleReconnect();
      });

      this.wsClient.on('error', (error) => {
        logger.error('TelemetryDatabase WebSocket error:', error);
      });

    } catch (error) {
      logger.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max WebSocket reconnection attempts reached');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    this.reconnectAttempts++;

    logger.info(`Scheduling WebSocket reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connectWebSocket(), delay);
  }

  subscribe(eventType: string, callback: (data: any) => void): void {
    this.on(eventType, callback);
  }

  unsubscribe(eventType: string, callback: (data: any) => void): void {
    this.off(eventType, callback);
  }

  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }
}