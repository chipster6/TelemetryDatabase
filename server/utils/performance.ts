/**
 * Performance monitoring utilities
 */

export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  private static metrics = new Map<string, number[]>();

  static startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  static endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) {
      console.warn(`Timer ${label} was not started`);
      return 0;
    }
    
    const duration = Date.now() - start;
    this.timers.delete(label);
    
    // Store metric for analysis
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
    
    // Keep only last 100 measurements
    if (this.metrics.get(label)!.length > 100) {
      this.metrics.get(label)!.shift();
    }
    
    return duration;
  }

  static getMetrics(label: string): {
    count: number;
    average: number;
    min: number;
    max: number;
  } | null {
    const measurements = this.metrics.get(label);
    if (!measurements || measurements.length === 0) return null;
    
    return {
      count: measurements.length,
      average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements)
    };
  }

  static getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const label of Array.from(this.metrics.keys())) {
      result[label] = this.getMetrics(label);
    }
    return result;
  }
}

/**
 * Async rate limiter
 */
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    
    // Remove expired requests
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
}