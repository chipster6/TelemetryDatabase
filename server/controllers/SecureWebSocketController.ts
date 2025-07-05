import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { IServiceContainer } from '../di/ServiceContainer';
import { TOKENS } from '../di/tokens';
import { Server } from 'http';
import { BiometricLLMBridge } from '../services/integration/BiometricLLMBridge.js';
import { SecureWebSocketValidator, WebSocketMessage } from '../middleware/SecureWebSocketValidator.js';
import { logger } from '../utils/Logger.js';
import { AuditLogger, AuditEventType } from '../services/AuditLogger.js';

export class SecureWebSocketController {
  private wss!: WebSocketServer;
  private clients = new Map<WebSocket, { 
    userId?: string; 
    subscriptions: Set<string>; 
    lastPing: number;
    authenticated: boolean;
  }>();
  private biometricInterval?: NodeJS.Timeout;
  private llmBridge: BiometricLLMBridge;
  private validator: SecureWebSocketValidator;
  private auditLogger: AuditLogger;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private container: IServiceContainer, 
    httpServer: Server,
    auditLogger: AuditLogger
  ) {
    this.llmBridge = new BiometricLLMBridge();
    this.auditLogger = auditLogger;
    
    // Initialize secure validator
    this.validator = new SecureWebSocketValidator({
      maxMessageSize: 64 * 1024, // 64KB
      maxMessagesPerMinute: 60,
      allowedMessageTypes: ['ping', 'auth', 'subscribe', 'unsubscribe', 'llm_request'],
      requireAuthentication: true,
      enableContentValidation: true,
      sessionTimeout: 30 * 60 * 1000 // 30 minutes
    });

    this.initializeWebSocketServer(httpServer);
    this.startBiometricDataGeneration();
    this.startHeartbeat();
  }

  private initializeWebSocketServer(httpServer: Server): void {
    this.wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws',
      verifyClient: async (info) => {
        try {
          return await this.validator.validateConnection(info.req, info.req);
        } catch (error) {
          logger.error('Error during WebSocket verification:', error);
          return false;
        }
      }
    });
    
    this.wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      await this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const clientInfo = {
      userId: undefined,
      subscriptions: new Set<string>(),
      lastPing: Date.now(),
      authenticated: false
    };
    
    this.clients.set(ws, clientInfo);

    // Log connection
    await this.auditLogger.logEvent({
      eventType: AuditEventType.AUTHENTICATION,
      action: 'websocket_connection',
      resource: 'websocket',
      sourceIp: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      success: true,
      risk_level: 'low',
      metadata: {
        path: request.url,
        origin: request.headers.origin
      }
    });

    logger.info('Secure WebSocket client connected', {
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent']
    });

    // Send welcome message with security info
    this.sendSecureMessage(ws, {
      type: 'connection_established',
      data: {
        requiresAuth: true,
        maxMessageSize: 64 * 1024,
        allowedMessageTypes: ['ping', 'auth', 'subscribe', 'unsubscribe', 'llm_request']
      }
    });

    ws.on('close', async (code, reason) => {
      await this.handleDisconnection(ws, code, reason.toString());
    });

    ws.on('error', async (error) => {
      logger.error('WebSocket client error:', error);
      await this.handleError(ws, error);
    });

    ws.on('message', async (rawMessage) => {
      await this.handleMessage(ws, rawMessage);
    });

    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.lastPing = Date.now();
      }
    });
  }

  private async handleMessage(ws: WebSocket, rawMessage: Buffer | string): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      ws.close(1011, 'Invalid session');
      return;
    }

    try {
      // Validate message using secure validator
      const validation = await this.validator.validateMessage(ws, rawMessage);
      
      if (!validation.valid) {
        // Log security violation
        await this.auditLogger.logSecurityViolation({
          userId: client.userId,
          violationType: 'invalid_websocket_message',
          description: validation.error || 'Message validation failed',
          sourceIp: this.getClientIp(ws),
          blocked: true,
          metadata: {
            messageSize: Buffer.isBuffer(rawMessage) ? rawMessage.length : rawMessage.length,
            shouldBlock: validation.shouldBlock
          }
        });

        // Send error response
        this.sendSecureMessage(ws, {
          type: 'error',
          data: {
            code: 'VALIDATION_FAILED',
            message: 'Message validation failed'
          }
        });

        // Close connection if severe violation
        if (validation.shouldBlock) {
          logger.warn('Closing WebSocket connection due to security violation');
          ws.close(1008, 'Security violation');
        }
        return;
      }

      const message = validation.message!;
      
      // Process valid message
      await this.processSecureMessage(ws, message);

    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
      
      await this.auditLogger.logSecurityViolation({
        userId: client.userId,
        violationType: 'websocket_processing_error',
        description: 'Error processing WebSocket message',
        sourceIp: this.getClientIp(ws),
        blocked: false,
        metadata: { error: error.message }
      });

      this.sendSecureMessage(ws, {
        type: 'error',
        data: {
          code: 'PROCESSING_ERROR',
          message: 'Message processing failed'
        }
      });
    }
  }

  private async processSecureMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    const session = this.validator.getSession(ws);
    
    switch (message.type) {
      case 'ping':
        await this.handlePing(ws, message);
        break;
        
      case 'auth':
        await this.handleAuthentication(ws, message);
        break;
        
      case 'subscribe':
        await this.handleSubscription(ws, message);
        break;
        
      case 'unsubscribe':
        await this.handleUnsubscription(ws, message);
        break;
        
      case 'llm_request':
        await this.handleSecureLLMRequest(ws, message);
        break;
        
      default:
        logger.warn('Unknown secure message type', { type: message.type });
    }
  }

  private async handlePing(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    this.sendSecureMessage(ws, {
      type: 'pong',
      requestId: message.requestId,
      data: { timestamp: Date.now() }
    });
  }

  private async handleAuthentication(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const { token, userId } = message.data || {};
      
      if (!token || !userId) {
        throw new Error('Missing authentication credentials');
      }

      // Validate token (implement your token validation logic here)
      const isValid = await this.validateAuthToken(token, userId);
      
      if (!isValid) {
        throw new Error('Invalid authentication credentials');
      }

      // Authenticate session
      const authenticated = await this.validator.authenticateSession(ws, userId, token);
      
      if (authenticated) {
        client.authenticated = true;
        client.userId = userId;

        await this.auditLogger.logEvent({
          userId: userId,
          eventType: AuditEventType.AUTHENTICATION,
          action: 'websocket_auth_success',
          resource: 'websocket',
          sourceIp: this.getClientIp(ws),
          success: true,
          risk_level: 'low'
        });

        this.sendSecureMessage(ws, {
          type: 'auth_success',
          requestId: message.requestId,
          data: { userId, authenticated: true }
        });

        logger.info('WebSocket client authenticated', { userId });
      } else {
        throw new Error('Authentication failed');
      }

    } catch (error) {
      await this.auditLogger.logEvent({
        userId: message.data?.userId,
        eventType: AuditEventType.AUTHENTICATION,
        action: 'websocket_auth_failed',
        resource: 'websocket',
        sourceIp: this.getClientIp(ws),
        success: false,
        risk_level: 'medium',
        metadata: { error: error.message }
      });

      this.sendSecureMessage(ws, {
        type: 'auth_error',
        requestId: message.requestId,
        data: { message: 'Authentication failed' }
      });
    }
  }

  private async handleSubscription(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client || !client.authenticated) {
      this.sendSecureMessage(ws, {
        type: 'error',
        requestId: message.requestId,
        data: { message: 'Authentication required' }
      });
      return;
    }

    const { channel } = message.data || {};
    
    if (!channel || typeof channel !== 'string') {
      this.sendSecureMessage(ws, {
        type: 'error',
        requestId: message.requestId,
        data: { message: 'Invalid channel' }
      });
      return;
    }

    // Validate subscription permissions
    if (!this.canSubscribeToChannel(client.userId!, channel)) {
      await this.auditLogger.logSecurityViolation({
        userId: client.userId,
        violationType: 'unauthorized_subscription',
        description: `Attempted to subscribe to unauthorized channel: ${channel}`,
        sourceIp: this.getClientIp(ws),
        blocked: true
      });

      this.sendSecureMessage(ws, {
        type: 'error',
        requestId: message.requestId,
        data: { message: 'Unauthorized channel access' }
      });
      return;
    }

    client.subscriptions.add(channel);
    
    this.sendSecureMessage(ws, {
      type: 'subscription_confirmed',
      requestId: message.requestId,
      data: { channel, timestamp: Date.now() }
    });

    logger.info('Client subscribed to channel', { 
      userId: client.userId, 
      channel 
    });
  }

  private async handleUnsubscription(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    const { channel } = message.data || {};
    
    if (channel) {
      client.subscriptions.delete(channel);
    }
    
    this.sendSecureMessage(ws, {
      type: 'unsubscription_confirmed',
      requestId: message.requestId,
      data: { channel, timestamp: Date.now() }
    });
  }

  private async handleSecureLLMRequest(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client || !client.authenticated) {
      this.sendSecureMessage(ws, {
        type: 'error',
        requestId: message.requestId,
        data: { message: 'Authentication required' }
      });
      return;
    }

    const startTime = Date.now();

    try {
      const { userId, prompt, stream = false } = message.data || {};
      
      if (!userId || !prompt) {
        throw new Error('Missing required parameters');
      }

      // Verify user ownership
      if (userId !== client.userId) {
        await this.auditLogger.logSecurityViolation({
          userId: client.userId,
          violationType: 'user_id_mismatch',
          description: 'Client attempted to generate for different user',
          sourceIp: this.getClientIp(ws),
          blocked: true
        });
        
        throw new Error('Unauthorized user access');
      }

      // Get biometric service
      const biometricService = this.container.resolve(TOKENS.BiometricService);
      const latestBiometricData = await biometricService.getLatestBiometricData(userId);
      
      if (!latestBiometricData) {
        throw new Error('No biometric data available');
      }

      // Send acknowledgment
      this.sendSecureMessage(ws, {
        type: 'llm_request_received',
        requestId: message.requestId,
        data: { userId, timestamp: Date.now() }
      });

      // Process LLM request with biometric context
      const response = await this.llmBridge.processLLMRequest(userId, prompt, latestBiometricData);
      
      // Send response
      this.sendSecureMessage(ws, {
        type: 'llm_response',
        requestId: message.requestId,
        data: {
          userId,
          response: response.response,
          metadata: response.metadata,
          biometricMetadata: response.biometricMetadata,
          timestamp: Date.now()
        }
      });

      // Audit log the generation
      await this.auditLogger.logLLMGeneration({
        userId,
        prompt,
        response: response.response,
        model: response.metadata?.model || 'unknown',
        tokensUsed: response.metadata?.tokensUsed || 0,
        cognitiveAdaptations: response.metadata?.cognitiveAdaptations || [],
        sourceIp: this.getClientIp(ws),
        processingTimeMs: Date.now() - startTime
      });

      logger.info('Secure LLM request processed via WebSocket', { 
        userId, 
        processingTime: Date.now() - startTime 
      });

    } catch (error) {
      logger.error('Error processing secure LLM request:', error);
      
      this.sendSecureMessage(ws, {
        type: 'llm_error',
        requestId: message.requestId,
        data: { message: 'Failed to process LLM request' }
      });
    }
  }

  private async handleDisconnection(ws: WebSocket, code: number, reason: string): Promise<void> {
    const client = this.clients.get(ws);
    
    if (client?.userId) {
      await this.auditLogger.logEvent({
        userId: client.userId,
        eventType: AuditEventType.AUTHENTICATION,
        action: 'websocket_disconnect',
        resource: 'websocket',
        sourceIp: this.getClientIp(ws),
        success: true,
        risk_level: 'low',
        metadata: { code, reason }
      });
    }

    this.validator.closeSession(ws);
    this.clients.delete(ws);
    
    logger.info('Secure WebSocket client disconnected', { 
      userId: client?.userId,
      code, 
      reason 
    });
  }

  private async handleError(ws: WebSocket, error: Error): Promise<void> {
    const client = this.clients.get(ws);
    
    logger.error('WebSocket client error:', error);
    
    await this.auditLogger.logEvent({
      userId: client?.userId,
      eventType: AuditEventType.SECURITY_VIOLATION,
      action: 'websocket_error',
      resource: 'websocket',
      sourceIp: this.getClientIp(ws),
      success: false,
      risk_level: 'medium',
      metadata: { error: error.message }
    });
  }

  private sendSecureMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now()
        });
        ws.send(messageStr);
      } catch (error) {
        logger.error('Error sending secure WebSocket message:', error);
      }
    }
  }

  private async validateAuthToken(token: string, userId: string): Promise<boolean> {
    // Implement your token validation logic here
    // This could involve JWT verification, database lookup, etc.
    
    // For now, basic validation
    return token.length >= 10 && userId.length >= 1;
  }

  private canSubscribeToChannel(userId: string, channel: string): boolean {
    // Implement channel access control
    const allowedChannels = [
      'biometric_updates',
      'analytics',
      'personal_insights',
      `user_${userId}` // User-specific channels
    ];
    
    return allowedChannels.includes(channel) || channel.startsWith(`user_${userId}_`);
  }

  private getClientIp(wsOrRequest: WebSocket | IncomingMessage): string {
    if ('socket' in wsOrRequest) {
      // IncomingMessage
      return wsOrRequest.socket.remoteAddress || 
             wsOrRequest.connection?.remoteAddress ||
             wsOrRequest.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
             'unknown';
    } else {
      // WebSocket - get from upgrade request
      return (wsOrRequest as any)._socket?.remoteAddress || 'unknown';
    }
  }

  private startBiometricDataGeneration(): void {
    const generateData = async () => {
      try {
        const biometricService = this.container.resolve(TOKENS.BiometricService);
        const simulatedData = biometricService.generateRealisticBiometricData();
        const savedData = await biometricService.processBiometricReading(simulatedData);
        
        this.broadcastSecureBiometricData({
          type: 'biometric_update',
          data: savedData,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Error generating biometric data:', error);
      } finally {
        this.biometricInterval = setTimeout(generateData, 3000);
      }
    };
    
    generateData();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleConnections: WebSocket[] = [];

      this.clients.forEach((client, ws) => {
        if (now - client.lastPing > 60000) { // 1 minute
          staleConnections.push(ws);
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });

      // Close stale connections
      staleConnections.forEach(ws => {
        logger.info('Closing stale WebSocket connection');
        ws.close(1000, 'Heartbeat timeout');
      });
    }, 30000); // Check every 30 seconds
  }

  broadcastSecureBiometricData(data: any): void {
    this.clients.forEach((client, ws) => {
      if (client.authenticated && 
          client.subscriptions.has('biometric_updates') &&
          ws.readyState === WebSocket.OPEN) {
        this.sendSecureMessage(ws, data);
      }
    });
  }

  broadcastToAuthorizedClients(data: any, requiredChannel?: string): void {
    this.clients.forEach((client, ws) => {
      if (client.authenticated && 
          (!requiredChannel || client.subscriptions.has(requiredChannel)) &&
          ws.readyState === WebSocket.OPEN) {
        this.sendSecureMessage(ws, data);
      }
    });
  }

  getSecureStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    validatorStats: any;
  } {
    const authenticatedCount = Array.from(this.clients.values())
      .filter(client => client.authenticated).length;

    return {
      totalConnections: this.clients.size,
      authenticatedConnections: authenticatedCount,
      validatorStats: this.validator.getStats()
    };
  }

  async destroy(): Promise<void> {
    if (this.biometricInterval) {
      clearTimeout(this.biometricInterval);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'Server shutdown');
      }
    });
    
    this.clients.clear();
    
    // Close WebSocket server
    this.wss.close();
    
    // Clean up validator
    await this.validator.close();
  }
}