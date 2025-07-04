export interface MemoryStats {
  used: number;
  total: number;
  percentage: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryConfig {
  thresholdPercentage: number;
  gcInterval: number;
  alertThreshold: number;
  maxHeapSize?: number;
}

export class MemoryManager {
  private memoryThreshold: number;
  private currentUsage: NodeJS.MemoryUsage;
  private monitoringInterval?: NodeJS.Timeout;
  private alertCallbacks: Array<(stats: MemoryStats) => void> = [];
  private gcCallbacks: Array<() => void> = [];
  
  constructor(private config: MemoryConfig) {
    this.memoryThreshold = config.thresholdPercentage;
    this.currentUsage = process.memoryUsage();
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateMemoryUsage();
      this.checkThresholds();
    }, this.config.gcInterval);
  }

  private updateMemoryUsage(): void {
    this.currentUsage = process.memoryUsage();
  }

  private checkThresholds(): void {
    const stats = this.getMemoryStats();
    
    // Check if memory usage exceeds threshold
    if (stats.percentage > this.memoryThreshold) {
      this.optimizeMemory();
    }

    // Check if memory usage exceeds alert threshold
    if (stats.percentage > this.config.alertThreshold) {
      this.triggerAlerts(stats);
    }
  }

  getMemoryUsage(): NodeJS.MemoryUsage {
    return { ...this.currentUsage };
  }

  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    const totalHeap = usage.heapTotal;
    const usedHeap = usage.heapUsed;
    const percentage = (usedHeap / totalHeap) * 100;

    return {
      used: usedHeap,
      total: totalHeap,
      percentage,
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    };
  }

  async optimizeMemory(): Promise<void> {
    console.log('Memory optimization triggered');
    
    // Trigger garbage collection callbacks
    this.gcCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in GC callback:', error);
      }
    });

    // Force garbage collection if exposed
    if (global.gc) {
      global.gc();
      console.log('Forced garbage collection completed');
    } else {
      console.warn('Garbage collection not exposed. Run with --expose-gc flag.');
    }

    // Update memory usage after optimization
    this.updateMemoryUsage();
    
    const newStats = this.getMemoryStats();
    console.log(`Memory optimization completed. New usage: ${newStats.percentage.toFixed(2)}%`);
  }

  private triggerAlerts(stats: MemoryStats): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in memory alert callback:', error);
      }
    });
  }

  // Register callbacks for different events
  onMemoryAlert(callback: (stats: MemoryStats) => void): void {
    this.alertCallbacks.push(callback);
  }

  onGarbageCollection(callback: () => void): void {
    this.gcCallbacks.push(callback);
  }

  // Manual memory management functions
  async forceGarbageCollection(): Promise<MemoryStats> {
    const beforeStats = this.getMemoryStats();
    
    if (global.gc) {
      global.gc();
    }
    
    // Give some time for GC to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.updateMemoryUsage();
    const afterStats = this.getMemoryStats();
    
    console.log(`Manual GC: ${beforeStats.percentage.toFixed(2)}% -> ${afterStats.percentage.toFixed(2)}%`);
    
    return afterStats;
  }

  // Memory leak detection
  detectMemoryLeaks(): {
    isLeaking: boolean;
    trend: 'increasing' | 'stable' | 'decreasing';
    recommendations: string[];
  } {
    const stats = this.getMemoryStats();
    const recommendations: string[] = [];
    
    // Simple heuristic: if memory usage is consistently high
    const isLeaking = stats.percentage > 85;
    
    if (isLeaking) {
      recommendations.push('Consider reducing cache sizes');
      recommendations.push('Check for unclosed connections');
      recommendations.push('Review event listener cleanup');
      recommendations.push('Monitor large object allocations');
    }

    if (stats.external > stats.heapUsed) {
      recommendations.push('High external memory usage detected');
      recommendations.push('Check for buffer leaks');
    }

    return {
      isLeaking,
      trend: 'stable', // Would need historical data for accurate trend
      recommendations
    };
  }

  // Resource cleanup utilities
  cleanupResources(): void {
    // Clear large objects from memory
    if (global.gc) {
      global.gc();
    }
    
    // Log cleanup completion
    console.log('Resource cleanup completed');
  }

  // Get formatted memory report
  getMemoryReport(): string {
    const stats = this.getMemoryStats();
    const leakDetection = this.detectMemoryLeaks();
    
    return `
Memory Report:
=============
Heap Used: ${(stats.heapUsed / 1024 / 1024).toFixed(2)} MB (${stats.percentage.toFixed(2)}%)
Heap Total: ${(stats.heapTotal / 1024 / 1024).toFixed(2)} MB
RSS: ${(stats.rss / 1024 / 1024).toFixed(2)} MB
External: ${(stats.external / 1024 / 1024).toFixed(2)} MB
Array Buffers: ${(stats.arrayBuffers / 1024 / 1024).toFixed(2)} MB

Memory Leak Detection:
=====================
Status: ${leakDetection.isLeaking ? 'POTENTIAL LEAK DETECTED' : 'Normal'}
Trend: ${leakDetection.trend}
Recommendations: ${leakDetection.recommendations.join(', ') || 'None'}
    `.trim();
  }

  // Cleanup and shutdown
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.alertCallbacks.length = 0;
    this.gcCallbacks.length = 0;
  }
}