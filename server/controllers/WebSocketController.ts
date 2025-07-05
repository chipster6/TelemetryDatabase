import { WebSocketServer, WebSocket } from 'ws';
import { IServiceContainer } from '../di/ServiceContainer';
import { TOKENS } from '../di/tokens';
import { Server } from 'http';
import { BiometricLLMBridge } from '../services/integration/BiometricLLMBridge.js';

export class WebSocketController {
  private wss!: WebSocketServer;
  private clients = new Set<WebSocket>();
  private biometricInterval?: NodeJS.Timeout;
  private llmBridge: BiometricLLMBridge;

  constructor(private container: IServiceContainer, httpServer: Server) {
    this.llmBridge = new BiometricLLMBridge();
    this.initializeWebSocketServer(httpServer);
    this.startBiometricDataGeneration();
  }

  private initializeWebSocketServer(httpServer: Server): void {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('Client connected to biometric stream');

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('Client disconnected from biometric stream');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
    });
  }

  private handleClientMessage(ws: WebSocket, data: any): void {
    // Handle different types of client messages
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      case 'subscribe':
        // Handle subscription to specific data streams
        this.handleSubscription(ws, data.channel);
        break;
      case 'unsubscribe':
        // Handle unsubscription
        this.handleUnsubscription(ws, data.channel);
        break;
      case 'llm_request':
        // Handle LLM request with biometric context
        this.handleLLMRequest(ws, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private handleSubscription(ws: WebSocket, channel: string): void {
    // Add client to specific channel subscriptions
    // For now, all clients get all biometric data
    ws.send(JSON.stringify({ 
      type: 'subscription_confirmed', 
      channel,
      timestamp: Date.now()
    }));
  }

  private handleUnsubscription(ws: WebSocket, channel: string): void {
    // Remove client from specific channel subscriptions
    ws.send(JSON.stringify({ 
      type: 'unsubscription_confirmed', 
      channel,
      timestamp: Date.now()
    }));
  }

  private async handleLLMRequest(ws: WebSocket, data: any): Promise<void> {
    try {
      console.log('Processing LLM request via WebSocket:', data.userId);
      
      // Extract request data
      const { userId, prompt, requestId } = data;
      
      if (!userId || !prompt) {
        ws.send(JSON.stringify({
          type: 'llm_error',
          requestId,
          error: 'Missing userId or prompt',
          timestamp: Date.now()
        }));
        return;
      }

      // Get latest biometric data for the user
      const biometricService = this.container.resolve(TOKENS.BiometricService);
      const latestBiometricData = await biometricService.getLatestBiometricData(userId);
      
      if (!latestBiometricData) {
        ws.send(JSON.stringify({
          type: 'llm_error',
          requestId,
          error: 'No biometric data available for user',
          timestamp: Date.now()
        }));
        return;
      }

      // Send acknowledgment
      ws.send(JSON.stringify({
        type: 'llm_request_received',
        requestId,
        userId,
        timestamp: Date.now()
      }));

      // Process LLM request with biometric context
      const response = await this.llmBridge.processLLMRequest(userId, prompt, latestBiometricData);
      
      // Send response back to client
      ws.send(JSON.stringify({
        type: 'llm_response',
        requestId,
        userId,
        response: response.response,
        metadata: response.metadata,
        biometricMetadata: response.biometricMetadata,
        timestamp: Date.now()
      }));

      // Broadcast LLM activity to all connected clients (optional)
      this.broadcastToClients({
        type: 'llm_activity',
        userId,
        activity: 'LLM request processed',
        cognitiveLoad: response.biometricMetadata?.cognitiveLoad,
        flowState: response.biometricMetadata?.flowState,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error processing LLM request:', error);
      ws.send(JSON.stringify({
        type: 'llm_error',
        requestId: data.requestId,
        error: 'Failed to process LLM request',
        timestamp: Date.now()
      }));
    }
  }

  private startBiometricDataGeneration(): void {
    // Start simulated biometric data generation using recursive setTimeout
    const generateData = async () => {
      try {
        const biometricService = this.container.resolve(TOKENS.BiometricService);
        const simulatedData = biometricService.generateRealisticBiometricData();
        const savedData = await biometricService.processBiometricReading(simulatedData);
        
        this.broadcastBiometricData({
          type: 'biometric_update',
          data: savedData,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error generating biometric data:', error);
      } finally {
        // Schedule next execution only after current one completes
        this.biometricInterval = setTimeout(generateData, 3000);
      }
    };
    
    // Start the first execution
    generateData();
  }

  broadcastBiometricData(data: any): void {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending message to client:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  broadcastToClients(data: any): void {
    this.broadcastBiometricData(data);
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  closeAllConnections(): void {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.clients.clear();
  }

  destroy(): void {
    if (this.biometricInterval) {
      clearTimeout(this.biometricInterval);
    }
    this.closeAllConnections();
    this.wss.close();
  }
}