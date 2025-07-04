import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'redis';
import { EventEmitter } from 'events';
import { BiometricDataPoint, ProcessingResult, RealtimeAnalytics, Alert } from '../BiometricPipelineService';

export interface StreamProcessorConfig {
  batchSize: number;
  batchInterval: number;
  windowSize: number;
  maxConcurrentProcessing: number;
}

export interface SlidingWindow {
  add(dataPoint: BiometricDataPoint): void;
  getAll(): BiometricDataPoint[];
  getRecent(duration: number): BiometricDataPoint[];
}

/**
 * Handles real-time streaming, batching, and sliding window management
 */
export class StreamProcessor extends EventEmitter {
  private config: StreamProcessorConfig;
  private buffer: BiometricDataPoint[] = [];
  private timer: NodeJS.Timeout | null = null;
  private slidingWindows: Map<string, SlidingWindow> = new Map();

  constructor(
    private redis: Redis.RedisClientType,
    private wsServer?: WebSocketServer,
    config: Partial<StreamProcessorConfig> = {}
  ) {
    super();
    
    this.config = {
      batchSize: 100,
      batchInterval: 1000, // 1 second
      windowSize: 300000, // 5 minutes
      maxConcurrentProcessing: 100,
      ...config
    };
    
    this.startBatchTimer();
  }

  /**
   * Add data point to batch processing queue
   */
  async addToBatch(dataPoint: BiometricDataPoint): Promise<void> {
    this.buffer.push(dataPoint);
    
    if (this.buffer.length >= this.config.batchSize) {
      await this.processBatch();
    }
  }

  /**
   * Add data point to sliding window for real-time analytics
   */
  addToWindow(dataPoint: BiometricDataPoint): SlidingWindow {
    let window = this.slidingWindows.get(dataPoint.userId);
    if (!window) {
      window = new SlidingWindowImpl(this.config.windowSize);
      this.slidingWindows.set(dataPoint.userId, window);
    }
    
    window.add(dataPoint);
    return window;
  }

  /**
   * Get sliding window for a user
   */
  getUserWindow(userId: string): SlidingWindow | undefined {
    return this.slidingWindows.get(userId);
  }

  /**
   * Queue data for later processing when system is overloaded
   */
  async queueForLaterProcessing(data: BiometricDataPoint): Promise<void> {
    const queueKey = `biometric_queue:${data.userId}`;
    await this.redis.lPush(queueKey, JSON.stringify(data));
    await this.redis.expire(queueKey, 3600); // 1 hour expiry
  }

  /**
   * Broadcast real-time updates via WebSocket
   */
  broadcastUpdate(
    dataPoint: BiometricDataPoint,
    analytics: RealtimeAnalytics,
    alerts: Alert[]
  ): void {
    if (!this.wsServer) return;
    
    const message = JSON.stringify({
      type: 'biometric_update',
      userId: dataPoint.userId,
      analytics,
      alerts,
      timestamp: Date.now()
    });
    
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast critical alerts via WebSocket
   */
  broadcastCriticalAlert(alert: Alert): void {
    if (!this.wsServer) return;
    
    const message = JSON.stringify({
      type: 'critical_alert',
      alert,
      timestamp: Date.now()
    });
    
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Process accumulated batch of data points
   */
  private async processBatch(): Promise<void> {
    const batch = this.buffer.splice(0, this.config.batchSize);
    if (batch.length === 0) return;
    
    try {
      // Generate biometric vectors for each data point
      const processedBatch = batch.map(dataPoint => ({
        ...dataPoint,
        vector: this.generateBiometricVector(dataPoint)
      }));
      
      this.emit('batchReady', {
        batch: processedBatch,
        size: batch.length,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-queue failed items
      this.buffer.unshift(...batch);
      this.emit('batchError', { error, batchSize: batch.length });
    }
  }

  /**
   * Generate semantic vector for Weaviate storage
   */
  private generateBiometricVector(dataPoint: BiometricDataPoint): number[] {
    return [
      dataPoint.heartRate / 100,
      dataPoint.hrv / 100,
      dataPoint.cognitiveLoad / 100,
      dataPoint.attentionLevel / 100,
      dataPoint.stressLevel / 100,
      dataPoint.skinTemperature / 40,
      Math.sin(dataPoint.timestamp / 86400000 * 2 * Math.PI), // Time of day
      Math.cos(dataPoint.timestamp / 86400000 * 2 * Math.PI)
    ];
  }

  /**
   * Start batch processing timer
   */
  private startBatchTimer(): void {
    this.timer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.processBatch().catch(console.error);
      }
    }, this.config.batchInterval);
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    // Process remaining items
    await this.processBatch();
    
    // Clear sliding windows
    this.slidingWindows.clear();
    
    this.removeAllListeners();
  }
}

/**
 * Implementation of sliding window for maintaining recent data
 */
class SlidingWindowImpl implements SlidingWindow {
  private data: BiometricDataPoint[] = [];
  
  constructor(private windowSize: number) {}
  
  add(dataPoint: BiometricDataPoint): void {
    this.data.push(dataPoint);
    
    // Remove old data outside window
    const cutoff = Date.now() - this.windowSize;
    this.data = this.data.filter(d => d.timestamp > cutoff);
  }
  
  getAll(): BiometricDataPoint[] {
    return [...this.data];
  }
  
  getRecent(duration: number): BiometricDataPoint[] {
    const cutoff = Date.now() - duration;
    return this.data.filter(d => d.timestamp > cutoff);
  }
}