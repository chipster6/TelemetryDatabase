// Enhanced Performance Optimization Service for Biometric Pipeline
// Implements connection pooling, memory management, and edge processing

import { EventEmitter } from 'events';
import { WeaviateClient } from 'weaviate-ts-client';
import Redis from 'redis';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { Transform, Readable, Writable } from 'stream';
import { BiometricDataPoint } from './BiometricPipelineService';

// ==================== Performance Types ====================

export interface PerformanceMetrics {
  // Throughput metrics
  requestsPerSecond: number;
  dataPointsProcessed: number;
  averageProcessingTime: number;
  
  // Resource metrics
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  
  // Connection metrics
  activeConnections: number;
  connectionPoolUtilization: number;
  failedConnections: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  cacheMisses: number;
  
  // Queue metrics
  queueSize: number;
  averageQueueWaitTime: number;
  processingBacklog: number;
  
  timestamp: number;
}

export interface EdgeProcessingResult {
  processed: boolean;
  cached: boolean;
  processingTime: number;
  memoryImpact: number;
  result?: any;
  error?: string;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
}

export interface StreamProcessingConfig {
  batchSize: number;
  flushInterval: number;
  maxConcurrency: number;
  backpressureThreshold: number;
}

// ==================== Performance Optimization Service ====================

export class BiometricPerformanceService extends EventEmitter {
  private connectionPool: WeaviateConnectionPool;
  private memoryManager: MemoryManager;
  private edgeProcessor: EdgeProcessor;
  private streamProcessor: StreamProcessor;
  private performanceMonitor: PerformanceMonitor;
  private loadBalancer: LoadBalancer;
  private cacheManager: AdvancedCacheManager;
  
  constructor(
    private redis: Redis.RedisClientType,
    private config: {
      connectionPool: ConnectionPoolConfig;
      streamProcessing: StreamProcessingConfig;
      edgeProcessing: boolean;
      memoryThreshold: number;
    }
  ) {
    super();
    
    this.connectionPool = new WeaviateConnectionPool(config.connectionPool);
    this.memoryManager = new MemoryManager(config.memoryThreshold);
    this.edgeProcessor = new EdgeProcessor();
    this.streamProcessor = new StreamProcessor(config.streamProcessing);
    this.performanceMonitor = new PerformanceMonitor();
    this.loadBalancer = new LoadBalancer();
    this.cacheManager = new AdvancedCacheManager(redis);
    
    this.setupPerformanceMonitoring();
    this.startHealthChecks();
  }
  
  /**
   * Process biometric data with performance optimizations
   */
  async processWithOptimization(
    data: BiometricDataPoint,
    options?: {
      priority?: 'high' | 'medium' | 'low';
      cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
      processingMode?: 'edge' | 'cloud' | 'hybrid';
    }
  ): Promise<EdgeProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Check system resources
      const resourceStatus = await this.checkSystemResources();
      if (!resourceStatus.canProcess) {
        return await this.handleResourceConstraints(data, options);
      }
      
      // Determine processing strategy
      const strategy = this.determineProcessingStrategy(data, options, resourceStatus);
      
      let result: any;
      
      switch (strategy.mode) {
        case 'edge':
          result = await this.processAtEdge(data, strategy);
          break;
        case 'cloud':
          result = await this.processInCloud(data, strategy);
          break;
        case 'hybrid':
          result = await this.processHybrid(data, strategy);
          break;
        default:
          result = await this.processInCloud(data, strategy);
      }
      
      const processingTime = performance.now() - startTime;
      
      // Update performance metrics
      this.performanceMonitor.recordProcessing(processingTime, strategy.mode);
      
      return {
        processed: true,
        cached: strategy.cached,
        processingTime,
        memoryImpact: this.calculateMemoryImpact(),
        result
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      this.performanceMonitor.recordError(error, processingTime);
      this.emit('processingError', { error, data, processingTime });
      
      return {
        processed: false,
        cached: false,
        processingTime,
        memoryImpact: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Process data stream with optimization
   */
  async processStream(
    dataStream: Readable,
    outputStream: Writable,
    options?: StreamProcessingConfig
  ): Promise<void> {
    const config = { ...this.config.streamProcessing, ...options };
    
    return new Promise((resolve, reject) => {
      const optimizedTransform = this.streamProcessor.createOptimizedTransform(config);
      
      dataStream
        .pipe(optimizedTransform)
        .pipe(outputStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }
  
  /**
   * Get real-time performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getCurrentMetrics();
  }
  
  /**
   * Optimize system resources
   */
  async optimizeResources(): Promise<void> {
    // Memory optimization
    await this.memoryManager.optimizeMemory();
    
    // Connection pool optimization
    await this.connectionPool.optimize();
    
    // Cache optimization
    await this.cacheManager.optimize();
    
    // Garbage collection
    if (global.gc) {
      global.gc();
    }
    
    this.emit('resourcesOptimized', {
      timestamp: Date.now(),
      metrics: this.getPerformanceMetrics()
    });
  }
  
  /**
   * Scale processing capacity
   */
  async scaleProcessing(direction: 'up' | 'down', factor: number): Promise<void> {
    if (direction === 'up') {
      await this.connectionPool.scaleUp(factor);
      await this.streamProcessor.scaleUp(factor);
    } else {
      await this.connectionPool.scaleDown(factor);
      await this.streamProcessor.scaleDown(factor);
    }
    
    this.emit('scalingCompleted', {
      direction,
      factor,
      timestamp: Date.now(),
      newCapacity: await this.getCurrentCapacity()
    });
  }
  
  // ==================== Private Methods ====================
  
  private async checkSystemResources(): Promise<{
    canProcess: boolean;
    memoryAvailable: number;
    cpuAvailable: number;
    connectionsAvailable: number;
  }> {
    const memoryStatus = this.memoryManager.checkMemoryStatus();
    const connectionStatus = this.connectionPool.getStatus();
    const cpuStatus = await this.getCPUStatus();
    
    return {
      canProcess: memoryStatus.available && connectionStatus.available && cpuStatus.available,
      memoryAvailable: memoryStatus.availablePercent,
      cpuAvailable: cpuStatus.availablePercent,
      connectionsAvailable: connectionStatus.availableConnections
    };
  }
  
  private determineProcessingStrategy(
    data: BiometricDataPoint,
    options: any,
    resourceStatus: any
  ): {
    mode: 'edge' | 'cloud' | 'hybrid';
    cached: boolean;
    priority: number;
  } {
    let mode: 'edge' | 'cloud' | 'hybrid' = 'cloud';
    let cached = false;
    let priority = 1;
    
    // Check cache first
    const cacheKey = this.generateCacheKey(data);
    cached = this.cacheManager.has(cacheKey);
    
    if (cached && options?.cacheStrategy !== 'minimal') {
      return { mode: 'edge', cached: true, priority: 3 };
    }
    
    // Determine mode based on data complexity and resources
    const complexity = this.calculateDataComplexity(data);
    
    if (options?.processingMode) {
      mode = options.processingMode;
    } else if (complexity < 0.3 && resourceStatus.memoryAvailable > 70) {
      mode = 'edge';
    } else if (complexity > 0.7 || resourceStatus.memoryAvailable < 30) {
      mode = 'cloud';
    } else {
      mode = 'hybrid';
    }
    
    // Set priority
    if (options?.priority === 'high') priority = 3;
    else if (options?.priority === 'medium') priority = 2;
    
    return { mode, cached, priority };
  }
  
  private async processAtEdge(data: BiometricDataPoint, strategy: any): Promise<any> {
    return await this.edgeProcessor.process(data, {
      useCache: strategy.cached,
      priority: strategy.priority
    });
  }
  
  private async processInCloud(data: BiometricDataPoint, strategy: any): Promise<any> {
    const connection = await this.connectionPool.acquire();
    
    try {
      // Process using cloud resources
      const result = await this.processWithConnection(connection, data);
      
      // Cache result if beneficial
      if (strategy.priority > 1) {
        const cacheKey = this.generateCacheKey(data);
        await this.cacheManager.set(cacheKey, result);
      }
      
      return result;
      
    } finally {
      this.connectionPool.release(connection);
    }
  }
  
  private async processHybrid(data: BiometricDataPoint, strategy: any): Promise<any> {
    // Try edge processing first, fallback to cloud
    try {
      const edgeResult = await this.edgeProcessor.process(data, {
        timeout: 1000, // 1 second timeout for edge
        priority: strategy.priority
      });
      
      return edgeResult;
      
    } catch (error) {
      // Fallback to cloud processing
      return await this.processInCloud(data, strategy);
    }
  }
  
  private async handleResourceConstraints(
    data: BiometricDataPoint,
    options: any
  ): Promise<EdgeProcessingResult> {
    // Queue for later processing
    await this.queueForLaterProcessing(data, options);
    
    return {
      processed: false,
      cached: false,
      processingTime: 0,
      memoryImpact: 0,
      error: 'System resources constrained, queued for later processing'
    };
  }
  
  private async queueForLaterProcessing(data: BiometricDataPoint, options: any): Promise<void> {
    const priority = options?.priority || 'medium';
    const queueKey = `processing_queue:${priority}`;
    
    await this.redis.lPush(queueKey, JSON.stringify({
      data,
      options,
      timestamp: Date.now()
    }));
  }
  
  private calculateDataComplexity(data: BiometricDataPoint): number {
    // Calculate complexity based on data richness and processing requirements
    let complexity = 0;
    
    // Base complexity
    complexity += 0.1;
    
    // Additional complexity for optional fields
    if (data.environmentalSound !== undefined) complexity += 0.1;
    if (data.lightLevel !== undefined) complexity += 0.1;
    if (data.temperature !== undefined) complexity += 0.1;
    if (data.contextId !== undefined) complexity += 0.1;
    if (data.metadata !== undefined) complexity += 0.2;
    
    // Complexity based on value ranges (extreme values need more processing)
    if (data.heartRate > 150 || data.heartRate < 50) complexity += 0.1;
    if (data.cognitiveLoad > 80) complexity += 0.1;
    if (data.stressLevel > 70) complexity += 0.1;
    
    return Math.min(1.0, complexity);
  }
  
  private generateCacheKey(data: BiometricDataPoint): string {
    // Generate cache key based on data characteristics
    const keyData = {
      userId: data.userId,
      heartRateRange: Math.floor(data.heartRate / 10) * 10,
      cognitiveLoadRange: Math.floor(data.cognitiveLoad / 10) * 10,
      contextId: data.contextId
    };
    
    return `biometric:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }
  
  private async processWithConnection(connection: WeaviateClient, data: BiometricDataPoint): Promise<any> {
    // Placeholder for actual processing logic
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate processing
    
    return {
      processed: true,
      timestamp: Date.now(),
      data: data
    };
  }
  
  private calculateMemoryImpact(): number {
    const currentMemory = process.memoryUsage();
    return currentMemory.heapUsed / 1024 / 1024; // MB
  }
  
  private async getCPUStatus(): Promise<{ available: boolean; availablePercent: number }> {
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;
    const availablePercent = Math.max(0, 100 - (totalUsage / 1000000)); // Convert microseconds to percent
    
    return {
      available: availablePercent > 20, // 20% threshold
      availablePercent
    };
  }
  
  private async getCurrentCapacity(): Promise<number> {
    const connectionCapacity = this.connectionPool.getCapacity();
    const processingCapacity = this.streamProcessor.getCapacity();
    
    return Math.min(connectionCapacity, processingCapacity);
  }
  
  private setupPerformanceMonitoring(): void {
    this.performanceMonitor.on('performanceAlert', (alert) => {
      this.emit('performanceAlert', alert);
      this.handlePerformanceAlert(alert);
    });
    
    this.performanceMonitor.on('resourceExhaustion', (resource) => {
      this.emit('resourceExhaustion', resource);
      this.handleResourceExhaustion(resource);
    });
  }
  
  private startHealthChecks(): void {
    setInterval(async () => {
      try {
        const metrics = this.getPerformanceMetrics();
        const healthStatus = this.assessSystemHealth(metrics);
        
        this.emit('healthCheck', { metrics, healthStatus, timestamp: Date.now() });
        
        if (healthStatus.needsOptimization) {
          await this.optimizeResources();
        }
        
        if (healthStatus.needsScaling) {
          await this.scaleProcessing(healthStatus.scalingDirection, healthStatus.scalingFactor);
        }
        
      } catch (error) {
        this.emit('healthCheckError', error);
      }
    }, 30000); // Every 30 seconds
  }
  
  private handlePerformanceAlert(alert: any): void {
    switch (alert.type) {
      case 'high_latency':
        this.optimizeResources();
        break;
      case 'memory_pressure':
        this.memoryManager.emergencyCleanup();
        break;
      case 'connection_exhaustion':
        this.connectionPool.scaleUp(1.5);
        break;
    }
  }
  
  private handleResourceExhaustion(resource: any): void {
    switch (resource.type) {
      case 'memory':
        this.memoryManager.forcedCleanup();
        break;
      case 'connections':
        this.connectionPool.emergencyScale();
        break;
      case 'cpu':
        this.streamProcessor.reduceLoad();
        break;
    }
  }
  
  private assessSystemHealth(metrics: PerformanceMetrics): {
    healthy: boolean;
    needsOptimization: boolean;
    needsScaling: boolean;
    scalingDirection?: 'up' | 'down';
    scalingFactor?: number;
  } {
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    const connectionUtilization = metrics.connectionPoolUtilization;
    const averageLatency = metrics.averageProcessingTime;
    
    const healthy = memoryUsagePercent < 80 && connectionUtilization < 90 && averageLatency < 1000;
    const needsOptimization = memoryUsagePercent > 70 || metrics.cacheHitRate < 50;
    const needsScaling = connectionUtilization > 85 || averageLatency > 2000;
    
    let scalingDirection: 'up' | 'down' | undefined;
    let scalingFactor: number | undefined;
    
    if (needsScaling) {
      if (connectionUtilization > 85 || averageLatency > 2000) {
        scalingDirection = 'up';
        scalingFactor = 1.5;
      } else if (connectionUtilization < 30 && averageLatency < 100) {
        scalingDirection = 'down';
        scalingFactor = 0.8;
      }
    }
    
    return {
      healthy,
      needsOptimization,
      needsScaling,
      scalingDirection,
      scalingFactor
    };
  }
  
  async shutdown(): Promise<void> {
    await this.connectionPool.shutdown();
    await this.streamProcessor.shutdown();
    await this.cacheManager.shutdown();
    this.memoryManager.shutdown();
    this.performanceMonitor.shutdown();
    this.removeAllListeners();
  }
}

// ==================== Supporting Classes ====================

/**
 * Weaviate Connection Pool for optimized database connections
 */
class WeaviateConnectionPool {
  private connections: WeaviateClient[] = [];
  private availableConnections: WeaviateClient[] = [];
  private activeConnections: Set<WeaviateClient> = new Set();
  private config: ConnectionPoolConfig;
  private isShuttingDown: boolean = false;
  
  constructor(config: ConnectionPoolConfig) {
    this.config = config;
    this.initializePool();
    this.startConnectionReaper();
  }
  
  private initializePool(): void {
    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = this.createConnection();
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }
  }
  
  private createConnection(): WeaviateClient {
    // In production, use actual Weaviate configuration
    return new WeaviateClient({
      scheme: 'http',
      host: 'localhost:8080'
    });
  }
  
  async acquire(): Promise<WeaviateClient> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }
    
    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMillis);
      
      const checkForConnection = () => {
        if (this.availableConnections.length > 0) {
          clearTimeout(timeout);
          const connection = this.availableConnections.pop()!;
          this.activeConnections.add(connection);
          resolve(connection);
        } else if (this.connections.length < this.config.maxConnections) {
          // Create new connection
          clearTimeout(timeout);
          const connection = this.createConnection();
          this.connections.push(connection);
          this.activeConnections.add(connection);
          resolve(connection);
        } else {
          // Wait and retry
          setTimeout(checkForConnection, 10);
        }
      };
      
      checkForConnection();
    });
  }
  
  release(connection: WeaviateClient): void {
    if (this.activeConnections.has(connection)) {
      this.activeConnections.delete(connection);
      this.availableConnections.push(connection);
    }
  }
  
  getStatus(): {
    available: boolean;
    availableConnections: number;
    totalConnections: number;
    utilization: number;
  } {
    const utilization = (this.activeConnections.size / this.connections.length) * 100;
    
    return {
      available: this.availableConnections.length > 0 || this.connections.length < this.config.maxConnections,
      availableConnections: this.availableConnections.length,
      totalConnections: this.connections.length,
      utilization
    };
  }
  
  getCapacity(): number {
    return this.config.maxConnections;
  }
  
  async optimize(): Promise<void> {
    // Remove idle connections beyond minimum
    const idleConnections = this.availableConnections.length;
    const excessConnections = Math.max(0, idleConnections - this.config.minConnections);
    
    for (let i = 0; i < excessConnections; i++) {
      const connection = this.availableConnections.pop();
      const index = this.connections.indexOf(connection!);
      if (index > -1) {
        this.connections.splice(index, 1);
      }
    }
  }
  
  async scaleUp(factor: number): Promise<void> {
    const targetConnections = Math.min(
      this.config.maxConnections,
      Math.ceil(this.connections.length * factor)
    );
    
    const connectionsToAdd = targetConnections - this.connections.length;
    
    for (let i = 0; i < connectionsToAdd; i++) {
      const connection = this.createConnection();
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }
  }
  
  async scaleDown(factor: number): Promise<void> {
    const targetConnections = Math.max(
      this.config.minConnections,
      Math.floor(this.connections.length * factor)
    );
    
    const connectionsToRemove = this.connections.length - targetConnections;
    
    for (let i = 0; i < connectionsToRemove && this.availableConnections.length > 0; i++) {
      const connection = this.availableConnections.pop();
      const index = this.connections.indexOf(connection!);
      if (index > -1) {
        this.connections.splice(index, 1);
      }
    }
  }
  
  async emergencyScale(): Promise<void> {
    // Double the pool size in emergency
    await this.scaleUp(2.0);
  }
  
  private startConnectionReaper(): void {
    setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapIntervalMillis);
  }
  
  private reapIdleConnections(): void {
    // Remove connections that have been idle too long
    // This is a simplified implementation
    const now = Date.now();
    // In production, track connection idle time and remove stale connections
  }
  
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Wait for active connections to be released
    while (this.activeConnections.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Close all connections
    this.connections.forEach(connection => {
      // In production, properly close connections
    });
    
    this.connections.clear();
    this.availableConnections.clear();
  }
}

/**
 * Memory Manager for optimal memory usage
 */
class MemoryManager {
  private memoryThreshold: number;
  private memoryCache: Map<string, { data: any; timestamp: number; size: number }> = new Map();
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB
  private gcInterval: NodeJS.Timeout | null = null;
  
  constructor(memoryThreshold: number) {
    this.memoryThreshold = memoryThreshold;
    this.startMemoryMonitoring();
  }
  
  checkMemoryStatus(): { available: boolean; availablePercent: number; usage: NodeJS.MemoryUsage } {
    const usage = process.memoryUsage();
    const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    return {
      available: usagePercent < this.memoryThreshold,
      availablePercent: 100 - usagePercent,
      usage
    };
  }
  
  async optimizeMemory(): Promise<void> {
    // Clear old cache entries
    this.cleanupCache();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Optimize internal data structures
    this.optimizeDataStructures();
  }
  
  emergencyCleanup(): void {
    // Clear all non-essential caches
    this.memoryCache.clear();
    
    // Force aggressive garbage collection
    if (global.gc) {
      global.gc();
      global.gc(); // Double GC for aggressive cleanup
    }
  }
  
  forcedCleanup(): void {
    this.emergencyCleanup();
    
    // Additional emergency measures
    // In production, might temporarily reject new requests
  }
  
  private startMemoryMonitoring(): void {
    this.gcInterval = setInterval(() => {
      const status = this.checkMemoryStatus();
      
      if (status.availablePercent < 20) {
        this.emergencyCleanup();
      } else if (status.availablePercent < 40) {
        this.optimizeMemory();
      }
    }, 10000); // Every 10 seconds
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  private optimizeDataStructures(): void {
    // Optimize internal data structures
    // This could involve compacting arrays, removing unused properties, etc.
  }
  
  shutdown(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    this.memoryCache.clear();
  }
}

/**
 * Edge Processor for local processing optimization
 */
class EdgeProcessor {
  private localCache: Map<string, { result: any; timestamp: number }> = new Map();
  private processingQueue: Array<{ data: any; resolve: Function; reject: Function }> = [];
  private maxQueueSize: number = 1000;
  private isProcessing: boolean = false;
  
  async process(data: BiometricDataPoint, options?: any): Promise<any> {
    // Check cache first
    const cacheKey = this.generateCacheKey(data);
    const cached = this.localCache.get(cacheKey);
    
    if (cached && options?.useCache !== false) {
      const age = Date.now() - cached.timestamp;
      if (age < 60000) { // 1 minute cache
        return cached.result;
      }
    }
    
    // Process locally
    const result = await this.processLocally(data, options);
    
    // Cache result
    this.localCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Maintain cache size
    if (this.localCache.size > 1000) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
    
    return result;
  }
  
  private async processLocally(data: BiometricDataPoint, options?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.processingQueue.length >= this.maxQueueSize) {
        reject(new Error('Processing queue full'));
        return;
      }
      
      this.processingQueue.push({ data, resolve, reject });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    
    while (this.processingQueue.length > 0) {
      const task = this.processingQueue.shift()!;
      
      try {
        // Simulate local processing
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms processing time
        
        const result = {
          processed: true,
          timestamp: Date.now(),
          data: task.data,
          processingMode: 'edge'
        };
        
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }
    
    this.isProcessing = false;
  }
  
  private generateCacheKey(data: BiometricDataPoint): string {
    return `edge:${data.userId}:${Math.floor(data.timestamp / 60000)}:${data.heartRate}:${data.cognitiveLoad}`;
  }
}

/**
 * Stream Processor for optimized data streaming
 */
class StreamProcessor {
  private config: StreamProcessingConfig;
  private activeStreams: number = 0;
  private maxConcurrency: number;
  
  constructor(config: StreamProcessingConfig) {
    this.config = config;
    this.maxConcurrency = config.maxConcurrency;
  }
  
  createOptimizedTransform(options?: StreamProcessingConfig): Transform {
    const config = { ...this.config, ...options };
    
    return new Transform({
      objectMode: true,
      highWaterMark: config.batchSize,
      transform(chunk: BiometricDataPoint, encoding, callback) {
        try {
          // Process data point
          const processed = this.processDataPoint(chunk);
          callback(null, processed);
        } catch (error) {
          callback(error);
        }
      }
    });
  }
  
  private processDataPoint(data: BiometricDataPoint): any {
    // Optimize data point processing
    return {
      ...data,
      processed: true,
      timestamp: Date.now()
    };
  }
  
  getCapacity(): number {
    return this.maxConcurrency;
  }
  
  async scaleUp(factor: number): Promise<void> {
    this.maxConcurrency = Math.ceil(this.maxConcurrency * factor);
  }
  
  async scaleDown(factor: number): Promise<void> {
    this.maxConcurrency = Math.max(1, Math.floor(this.maxConcurrency * factor));
  }
  
  reduceLoad(): void {
    this.maxConcurrency = Math.max(1, Math.floor(this.maxConcurrency * 0.5));
  }
  
  async shutdown(): Promise<void> {
    // Wait for active streams to complete
    while (this.activeStreams > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Performance Monitor for tracking system performance
 */
class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private processingTimes: number[] = [];
  private errorCount: number = 0;
  private startTime: number = Date.now();
  
  constructor() {
    super();
    
    this.metrics = {
      requestsPerSecond: 0,
      dataPointsProcessed: 0,
      averageProcessingTime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0,
      connectionPoolUtilization: 0,
      failedConnections: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      cacheMisses: 0,
      queueSize: 0,
      averageQueueWaitTime: 0,
      processingBacklog: 0,
      timestamp: Date.now()
    };
    
    this.startPerformanceTracking();
  }
  
  recordProcessing(processingTime: number, mode: string): void {
    this.processingTimes.push(processingTime);
    this.metrics.dataPointsProcessed++;
    
    // Keep only recent processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
    
    this.updateAverageProcessingTime();
    this.checkPerformanceThresholds();
  }
  
  recordError(error: Error, processingTime: number): void {
    this.errorCount++;
    
    if (processingTime > 5000) { // 5 seconds
      this.emit('performanceAlert', {
        type: 'high_latency',
        message: 'High processing latency detected',
        value: processingTime,
        threshold: 5000
      });
    }
  }
  
  getCurrentMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }
  
  private startPerformanceTracking(): void {
    setInterval(() => {
      this.updateMetrics();
      this.calculateRequestsPerSecond();
      this.checkResourceUsage();
    }, 1000); // Every second
  }
  
  private updateMetrics(): void {
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.cpuUsage = process.cpuUsage();
    this.metrics.timestamp = Date.now();
  }
  
  private updateAverageProcessingTime(): void {
    if (this.processingTimes.length > 0) {
      const sum = this.processingTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageProcessingTime = sum / this.processingTimes.length;
    }
  }
  
  private calculateRequestsPerSecond(): void {
    const uptime = (Date.now() - this.startTime) / 1000;
    this.metrics.requestsPerSecond = this.metrics.dataPointsProcessed / uptime;
  }
  
  private checkPerformanceThresholds(): void {
    if (this.metrics.averageProcessingTime > 2000) {
      this.emit('performanceAlert', {
        type: 'high_latency',
        message: 'Average processing time exceeded threshold',
        value: this.metrics.averageProcessingTime,
        threshold: 2000
      });
    }
  }
  
  private checkResourceUsage(): void {
    const memoryUsagePercent = (this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 90) {
      this.emit('resourceExhaustion', {
        type: 'memory',
        usage: memoryUsagePercent,
        threshold: 90
      });
    }
  }
  
  shutdown(): void {
    this.removeAllListeners();
  }
}

/**
 * Load Balancer for distributing processing load
 */
class LoadBalancer {
  private servers: Array<{ id: string; load: number; capacity: number }> = [];
  
  addServer(id: string, capacity: number): void {
    this.servers.push({ id, load: 0, capacity });
  }
  
  selectServer(): string | null {
    if (this.servers.length === 0) return null;
    
    // Select server with lowest load ratio
    const available = this.servers.filter(server => server.load < server.capacity);
    if (available.length === 0) return null;
    
    return available.reduce((min, server) => 
      (server.load / server.capacity) < (min.load / min.capacity) ? server : min
    ).id;
  }
  
  updateServerLoad(id: string, load: number): void {
    const server = this.servers.find(s => s.id === id);
    if (server) {
      server.load = load;
    }
  }
}

/**
 * Advanced Cache Manager
 */
class AdvancedCacheManager {
  private redis: Redis.RedisClientType;
  private localCache: Map<string, { data: any; expiry: number; accessCount: number }> = new Map();
  private maxLocalCacheSize: number = 10000;
  
  constructor(redis: Redis.RedisClientType) {
    this.redis = redis;
    this.startCacheOptimization();
  }
  
  async get(key: string): Promise<any> {
    // Check local cache first
    const local = this.localCache.get(key);
    if (local && Date.now() < local.expiry) {
      local.accessCount++;
      return local.data;
    }
    
    // Check Redis
    try {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        this.updateLocalCache(key, parsed, 300000); // 5 minutes
        return parsed;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }
    
    return null;
  }
  
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    // Set in Redis
    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
    
    // Set in local cache
    this.updateLocalCache(key, value, ttl * 1000);
  }
  
  has(key: string): boolean {
    const local = this.localCache.get(key);
    return local !== undefined && Date.now() < local.expiry;
  }
  
  private updateLocalCache(key: string, data: any, ttlMs: number): void {
    this.localCache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      accessCount: 1
    });
    
    // Evict if over size limit
    if (this.localCache.size > this.maxLocalCacheSize) {
      this.evictLeastUsed();
    }
  }
  
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let minAccessCount = Infinity;
    
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this.localCache.delete(leastUsedKey);
    }
  }
  
  async optimize(): Promise<void> {
    // Remove expired entries
    const now = Date.now();
    for (const [key, entry] of this.localCache.entries()) {
      if (now >= entry.expiry) {
        this.localCache.delete(key);
      }
    }
  }
  
  private startCacheOptimization(): void {
    setInterval(() => {
      this.optimize();
    }, 60000); // Every minute
  }
  
  async shutdown(): Promise<void> {
    this.localCache.clear();
  }
}

export default BiometricPerformanceService;