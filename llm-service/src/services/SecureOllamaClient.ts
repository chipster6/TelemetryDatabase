import { Ollama } from 'ollama';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { ModelConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface OllamaSecurityConfig {
  host: string;
  pinnedCertificates: string[]; // SHA-256 fingerprints
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
  verifyHostname: boolean;
  timeout: number;
  retries: number;
}

export interface SecureConnectionStats {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  pinnedCertificateValidations: number;
  lastConnectionTime: Date | null;
  certificateErrors: number;
}

export class SecureOllamaClient {
  private client: Ollama;
  private config: OllamaSecurityConfig;
  private loadedModels: Map<string, ModelConfig> = new Map();
  private connectionStats: SecureConnectionStats;
  private httpsAgent: https.Agent;

  constructor(config: Partial<OllamaSecurityConfig> = {}) {
    this.config = {
      host: 'https://localhost:11434',
      pinnedCertificates: [],
      verifyHostname: true,
      timeout: 30000,
      retries: 3,
      ...config
    };

    this.connectionStats = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      pinnedCertificateValidations: 0,
      lastConnectionTime: null,
      certificateErrors: 0
    };

    // Create secure HTTPS agent with certificate pinning
    this.httpsAgent = this.createSecureAgent();

    // Initialize Ollama client with secure agent
    this.client = new Ollama({ 
      host: this.config.host,
      fetch: this.createSecureFetch()
    });

    logger.info('SecureOllamaClient initialized with certificate pinning', {
      host: this.config.host,
      pinnedCertificates: this.config.pinnedCertificates.length,
      verifyHostname: this.config.verifyHostname
    });
  }

  private createSecureAgent(): https.Agent {
    const agentOptions: https.AgentOptions = {
      // Enable certificate pinning
      checkServerIdentity: (hostname: string, cert: any) => {
        return this.verifyCertificatePinning(hostname, cert);
      },
      // Load custom CA if provided
      ca: this.config.caCertPath ? fs.readFileSync(this.config.caCertPath) : undefined,
      // Client certificate authentication if provided
      cert: this.config.clientCertPath ? fs.readFileSync(this.config.clientCertPath) : undefined,
      key: this.config.clientKeyPath ? fs.readFileSync(this.config.clientKeyPath) : undefined,
      // Security settings
      rejectUnauthorized: true,
      secureProtocol: 'TLSv1_3_method', // Force TLS 1.3
      ciphers: [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-AES128-GCM-SHA256'
      ].join(':'),
      honorCipherOrder: true,
      // Connection limits
      maxSockets: 10,
      timeout: this.config.timeout
    };

    return new https.Agent(agentOptions);
  }

  private verifyCertificatePinning(hostname: string, cert: any): Error | undefined {
    try {
      this.connectionStats.pinnedCertificateValidations++;

      // Standard hostname verification first
      if (this.config.verifyHostname) {
        const standardCheck = https.globalAgent.options.checkServerIdentity?.(hostname, cert);
        if (standardCheck) {
          this.connectionStats.certificateErrors++;
          logger.error('Standard certificate verification failed', {
            hostname,
            error: standardCheck.message
          });
          return standardCheck;
        }
      }

      // Certificate pinning verification
      if (this.config.pinnedCertificates.length > 0) {
        const certFingerprint = this.getCertificateFingerprint(cert);
        
        if (!this.config.pinnedCertificates.includes(certFingerprint)) {
          this.connectionStats.certificateErrors++;
          const error = new Error(`Certificate pinning failed. Expected one of: ${this.config.pinnedCertificates.join(', ')}, Got: ${certFingerprint}`);
          
          logger.error('Certificate pinning verification failed', {
            hostname,
            expectedFingerprints: this.config.pinnedCertificates,
            actualFingerprint: certFingerprint,
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.valid_from,
            validTo: cert.valid_to
          });
          
          return error;
        }

        logger.debug('Certificate pinning verification successful', {
          hostname,
          fingerprint: certFingerprint,
          subject: cert.subject?.CN
        });
      }

      // Additional certificate validation
      this.validateCertificateDetails(cert);

      return undefined; // Success
    } catch (error) {
      this.connectionStats.certificateErrors++;
      logger.error('Certificate validation error:', error);
      return error instanceof Error ? error : new Error('Certificate validation failed');
    }
  }

  private getCertificateFingerprint(cert: any): string {
    // Calculate SHA-256 fingerprint
    const der = cert.raw || cert.pubkey;
    return crypto.createHash('sha256').update(der).digest('hex').toUpperCase();
  }

  private validateCertificateDetails(cert: any): void {
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    // Check certificate validity period
    if (now < validFrom || now > validTo) {
      throw new Error(`Certificate is not valid. Valid from ${validFrom} to ${validTo}, current time: ${now}`);
    }

    // Check certificate chain
    if (!cert.issuer || !cert.subject) {
      throw new Error('Certificate missing required issuer or subject information');
    }

    // Warn about certificates expiring soon (30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (validTo < thirtyDaysFromNow) {
      logger.warn('Certificate expiring soon', {
        subject: cert.subject?.CN,
        expiresAt: validTo,
        daysRemaining: Math.ceil((validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      });
    }
  }

  private createSecureFetch(): typeof fetch {
    // Return a custom fetch function that uses our secure agent
    return async (url: string | URL | Request, init?: RequestInit) => {
      this.connectionStats.totalConnections++;
      
      try {
        // For Node.js environments, we need to handle HTTPS requests specially
        if (typeof url === 'string' && url.startsWith('https://')) {
          // Use our secure agent for HTTPS requests
          const response = await this.makeSecureRequest(url, init);
          this.connectionStats.successfulConnections++;
          this.connectionStats.lastConnectionTime = new Date();
          return response;
        }
        
        // Fallback to standard fetch for non-HTTPS requests
        const response = await fetch(url, init);
        this.connectionStats.successfulConnections++;
        this.connectionStats.lastConnectionTime = new Date();
        return response;
      } catch (error) {
        this.connectionStats.failedConnections++;
        logger.error('Secure fetch failed:', error);
        throw error;
      }
    };
  }

  private async makeSecureRequest(url: string, init?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: init?.method || 'GET',
        headers: init?.headers as any,
        agent: this.httpsAgent,
        timeout: this.config.timeout
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          // Create a Response-like object
          const response = {
            ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: new Map(Object.entries(res.headers || {})),
            json: async () => JSON.parse(data),
            text: async () => data,
            blob: async () => new Blob([data]),
            arrayBuffer: async () => new ArrayBuffer(data.length)
          } as any as Response;
          
          resolve(response);
        });
      });

      req.on('error', (error) => {
        logger.error('HTTPS request error:', error);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (init?.body) {
        req.write(init.body);
      }

      req.end();
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing secure Ollama connection');
      
      // Test secure connection
      await this.client.list();
      logger.info('Secure connection to Ollama established successfully');
      
      // Load default model
      await this.loadModel('mistral:7b-instruct-q4');
    } catch (error) {
      logger.error('Failed to initialize secure Ollama connection:', error);
      throw error;
    }
  }

  async loadModel(modelName: string): Promise<void> {
    try {
      logger.info(`Loading model securely: ${modelName}`);
      
      // Pull model if not exists
      const models = await this.client.list();
      const modelExists = models.models.some(m => m.name === modelName);
      
      if (!modelExists) {
        logger.info(`Pulling model securely: ${modelName}`);
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
      logger.info(`Model loaded securely: ${modelName}`);
    } catch (error) {
      logger.error(`Failed to load model securely ${modelName}:`, error);
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
      logger.error('Secure generation failed:', error);
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
      logger.error('Secure streaming generation failed:', error);
      throw error;
    }
  }

  updatePinnedCertificates(fingerprints: string[]): void {
    this.config.pinnedCertificates = fingerprints;
    
    // Recreate the HTTPS agent with new pinned certificates
    this.httpsAgent = this.createSecureAgent();
    
    logger.info('Certificate pins updated', {
      count: fingerprints.length,
      fingerprints: fingerprints
    });
  }

  getConnectionStats(): SecureConnectionStats {
    return { ...this.connectionStats };
  }

  getSecurityConfig(): Omit<OllamaSecurityConfig, 'pinnedCertificates'> & { pinnedCertificateCount: number } {
    return {
      host: this.config.host,
      pinnedCertificateCount: this.config.pinnedCertificates.length,
      verifyHostname: this.config.verifyHostname,
      timeout: this.config.timeout,
      retries: this.config.retries,
      caCertPath: this.config.caCertPath,
      clientCertPath: this.config.clientCertPath,
      clientKeyPath: this.config.clientKeyPath
    };
  }

  getLoadedModels(): ModelConfig[] {
    return Array.from(this.loadedModels.values());
  }

  isModelLoaded(modelName: string): boolean {
    return this.loadedModels.has(modelName) && this.loadedModels.get(modelName)?.loaded === true;
  }

  async unloadModel(modelName: string): Promise<void> {
    try {
      this.loadedModels.delete(modelName);
      logger.info(`Model unloaded: ${modelName}`);
    } catch (error) {
      logger.error(`Failed to unload model ${modelName}:`, error);
      throw error;
    }
  }

  async testSecureConnection(): Promise<boolean> {
    try {
      logger.info('Testing secure Ollama connection');
      
      const startTime = Date.now();
      await this.client.list();
      const duration = Date.now() - startTime;
      
      logger.info('Secure connection test successful', {
        duration,
        pinnedCertificates: this.config.pinnedCertificates.length,
        stats: this.connectionStats
      });
      
      return true;
    } catch (error) {
      logger.error('Secure connection test failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    // Clean up connections
    this.httpsAgent.destroy();
    logger.info('Secure Ollama client closed');
  }
}