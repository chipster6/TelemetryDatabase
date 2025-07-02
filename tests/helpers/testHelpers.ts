// Test Helpers and Utilities for Biometric Pipeline Testing

import { vi } from 'vitest';
import { BiometricDataPoint } from '../../server/services/BiometricPipelineService';

// ==================== Mock Data Generators ====================

/**
 * Creates mock biometric data for testing
 */
export function createMockBiometricData(overrides?: Partial<BiometricDataPoint>): BiometricDataPoint {
  const baseData: BiometricDataPoint = {
    timestamp: Date.now(),
    userId: 'test-user-' + Math.random().toString(36).substr(2, 9),
    sessionId: 'session-' + Math.random().toString(36).substr(2, 9),
    heartRate: 70 + Math.random() * 20, // 70-90 bpm
    hrv: 30 + Math.random() * 40, // 30-70 ms
    hrvVariability: 5 + Math.random() * 10, // 5-15 ms
    skinTemperature: 32 + Math.random() * 5, // 32-37°C
    cognitiveLoad: 30 + Math.random() * 40, // 30-70%
    attentionLevel: 40 + Math.random() * 40, // 40-80%
    stressLevel: 20 + Math.random() * 40, // 20-60%
    environmentalSound: 40 + Math.random() * 30, // 40-70 dB
    lightLevel: 200 + Math.random() * 600, // 200-800 lux
    temperature: 20 + Math.random() * 8, // 20-28°C
    contextId: 'context-' + Math.floor(Math.random() * 5),
    respiratoryRate: 12 + Math.random() * 8, // 12-20 breaths/min
    oxygenSaturation: 95 + Math.random() * 5, // 95-100%
    deviceId: 'device-' + Math.random().toString(36).substr(2, 6),
    metadata: {
      testData: true,
      generatedAt: new Date().toISOString()
    }
  };

  return { ...baseData, ...overrides };
}

/**
 * Creates a sequence of biometric data points for testing patterns
 */
export function createBiometricSequence(
  count: number,
  intervalMs: number = 60000,
  pattern?: 'hyperfocus' | 'stress' | 'fatigue' | 'normal'
): BiometricDataPoint[] {
  const baseTime = Date.now();
  const userId = 'test-user-sequence';
  const sessionId = 'session-sequence';

  return Array.from({ length: count }, (_, index) => {
    const timestamp = baseTime + (index * intervalMs);
    
    let dataPoint = createMockBiometricData({
      timestamp,
      userId,
      sessionId
    });

    // Apply pattern-specific modifications
    switch (pattern) {
      case 'hyperfocus':
        dataPoint = {
          ...dataPoint,
          attentionLevel: 85 + Math.random() * 10, // Very high attention
          cognitiveLoad: 70 + Math.random() * 15, // High cognitive load
          stressLevel: 20 + Math.random() * 20, // Low to moderate stress
          hrvVariability: 5 + Math.random() * 5 // Low HRV variability
        };
        break;

      case 'stress':
        dataPoint = {
          ...dataPoint,
          stressLevel: 70 + Math.random() * 25, // High stress
          heartRate: 85 + Math.random() * 20, // Elevated heart rate
          attentionLevel: 30 + Math.random() * 30, // Variable attention
          cognitiveLoad: 60 + Math.random() * 35 // High cognitive load
        };
        break;

      case 'fatigue':
        dataPoint = {
          ...dataPoint,
          attentionLevel: 20 + Math.random() * 30, // Low attention
          cognitiveLoad: 80 + Math.random() * 15, // High cognitive load
          stressLevel: 40 + Math.random() * 30, // Moderate stress
          heartRate: 60 + Math.random() * 15 // Lower heart rate
        };
        break;

      default:
        // Normal pattern - use base values
        break;
    }

    return dataPoint;
  });
}

/**
 * Creates mock analytics data
 */
export function createMockAnalytics(userId: string) {
  return {
    cognitiveLoad: {
      current: 65,
      average: 58,
      trend: 'increasing' as const,
      sustainabilityScore: 0.75,
      recommendation: 'Consider a short break in the next 15 minutes'
    },
    attentionTrend: {
      current: 72,
      trend: 'stable' as const,
      stability: 0.8,
      focusQuality: 0.85,
      distractionEvents: 2
    },
    stressAnalysis: {
      currentLevel: 45,
      pattern: 'episodic' as const,
      triggers: ['task_switching', 'environmental_noise'],
      recoveryTime: 300000,
      recommendations: ['Take deep breaths', 'Adjust environment']
    },
    optimalState: {
      isOptimal: true,
      flowScore: 0.82,
      productivityScore: 0.78,
      limitingFactors: ['occasional_distractions'],
      optimizationSuggestions: ['Use noise-cancelling headphones']
    },
    predictions: {
      cognitiveLoad: 68,
      attentionLevel: 70,
      stressLevel: 50,
      confidence: 0.85,
      timeframe: '15min'
    },
    recommendations: [
      {
        type: 'environment' as const,
        priority: 'medium' as const,
        message: 'Optimize lighting for better focus',
        actions: ['adjust_lighting', 'reduce_glare']
      }
    ],
    timestamp: Date.now()
  };
}

/**
 * Creates mock neurodivergent patterns
 */
export function createMockNDPatterns(userId: string) {
  return {
    hyperfocus: [
      {
        startTime: Date.now() - 3600000,
        endTime: Date.now() - 1800000,
        duration: 1800000,
        avgAttention: 88,
        avgCognitiveLoad: 75,
        productivity: 85,
        trigger: 'task_engagement',
        context: 'coding',
        recoveryTime: 600000,
        qualityScore: 90
      }
    ],
    contextSwitching: {
      switchCount: 8,
      hourlyRate: 4,
      avgTimeBetweenSwitches: 900000,
      pattern: 'normal' as const,
      optimalSwitchingWindows: [9, 14, 16],
      switchingEfficiency: 0.75,
      cognitiveeCost: 15
    },
    sensoryProcessing: {
      overloadEvents: 2,
      avgRecoveryTime: 300000,
      triggerThresholds: {
        sound: 75,
        light: 800,
        temperature: 26,
        motion: 50
      },
      adaptationStrategies: ['noise_reduction', 'lighting_adjustment'],
      sensorySeekingBehaviors: ['fidgeting', 'music_seeking'],
      processingSensitivity: 0.7
    },
    executiveFunction: {
      avgCognitiveLoad: 65,
      peakLoadDuration: 45,
      taskCompletionRate: 0.85,
      workingMemoryLoad: 70,
      planningEfficiency: 0.8,
      inhibitionControl: 0.75,
      cognitiveFlexibility: 0.82,
      processingSpeed: 0.88
    },
    attentionVariability: {
      avgAttention: 68,
      variability: 25,
      sustainedAttentionDuration: 2700000,
      distractibilityScore: 35,
      optimalAttentionPeriods: [9, 14, 16],
      attentionCycles: [
        {
          peakTime: Date.now() - 3600000,
          duration: 1800000,
          intensity: 85,
          efficiency: 0.9
        }
      ],
      vigilanceDecrement: 15
    },
    stimRegulation: {
      stimSeekingBehavior: 0.6,
      stimAvoidanceBehavior: 0.3,
      optimalStimulationLevel: 65,
      stimRegulationStrategies: ['movement', 'music', 'tactile'],
      sensoryPreferences: ['low_light', 'background_noise'],
      alertnessCorrelation: 0.8
    },
    timePerception: {
      timeEstimationAccuracy: 0.7,
      hyperfocusTimeDistortion: 1.5,
      taskDurationPrediction: 0.65,
      timeBlindnessEvents: 3,
      temporalProcessingDelay: 150,
      circadianAlignmentScore: 0.8
    },
    energyManagement: {
      energyLevels: [65, 70, 85, 90, 75, 60, 45],
      peakEnergyWindows: [9, 14, 20],
      energyDepletionRate: 12,
      recoveryPatterns: ['rest_breaks', 'context_switching'],
      spoonTheoryScore: 75,
      burnoutRiskFactors: ['chronic_stress']
    },
    timestamp: Date.now(),
    userId
  };
}

// ==================== Mock Service Factories ====================

/**
 * Creates a mock Weaviate client
 */
export function createMockWeaviateClient() {
  return {
    batch: {
      objectsBatcher: vi.fn().mockReturnValue({
        withObjects: vi.fn().mockReturnThis(),
        do: vi.fn().mockResolvedValue({ successful: true })
      })
    },
    data: {
      creator: vi.fn().mockReturnValue({
        withClassName: vi.fn().mockReturnThis(),
        withProperties: vi.fn().mockReturnThis(),
        do: vi.fn().mockResolvedValue({ id: 'mock-id' })
      })
    },
    graphql: {
      get: vi.fn().mockReturnValue({
        withClassName: vi.fn().mockReturnThis(),
        withWhere: vi.fn().mockReturnThis(),
        withFields: vi.fn().mockReturnThis(),
        do: vi.fn().mockResolvedValue({
          data: {
            Get: {
              NexisBiometricPattern: []
            }
          }
        })
      })
    }
  };
}

/**
 * Creates a mock Redis client
 */
export function createMockRedisClient() {
  const mockData = new Map<string, string>();
  
  return {
    get: vi.fn().mockImplementation((key: string) => 
      Promise.resolve(mockData.get(key) || null)
    ),
    set: vi.fn().mockImplementation((key: string, value: string) => {
      mockData.set(key, value);
      return Promise.resolve('OK');
    }),
    setEx: vi.fn().mockImplementation((key: string, ttl: number, value: string) => {
      mockData.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn().mockImplementation((key: string) => {
      const existed = mockData.has(key);
      mockData.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    keys: vi.fn().mockImplementation((pattern: string) => {
      const keys = Array.from(mockData.keys());
      // Simple pattern matching
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Promise.resolve(keys.filter(key => regex.test(key)));
      }
      return Promise.resolve(keys.filter(key => key === pattern));
    }),
    lPush: vi.fn().mockResolvedValue(1),
    rPop: vi.fn().mockResolvedValue(null),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockImplementation((key: string) => 
      Promise.resolve(mockData.has(key) ? 1 : 0)
    )
  };
}

/**
 * Creates a mock WebSocket server
 */
export function createMockWebSocketServer() {
  const clients = new Set();
  
  return {
    clients,
    on: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
    send: vi.fn()
  };
}

/**
 * Creates a mock WebSocket client
 */
export function createMockWebSocketClient() {
  return {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    emit: vi.fn()
  };
}

// ==================== Test Data Validation ====================

/**
 * Validates that biometric data is within expected ranges
 */
export function validateBiometricData(data: BiometricDataPoint): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.heartRate < 30 || data.heartRate > 250) {
    errors.push('Heart rate out of range');
  }

  if (data.cognitiveLoad < 0 || data.cognitiveLoad > 100) {
    errors.push('Cognitive load out of range');
  }

  if (data.attentionLevel < 0 || data.attentionLevel > 100) {
    errors.push('Attention level out of range');
  }

  if (data.stressLevel < 0 || data.stressLevel > 100) {
    errors.push('Stress level out of range');
  }

  if (data.skinTemperature && (data.skinTemperature < 25 || data.skinTemperature > 45)) {
    errors.push('Skin temperature out of range');
  }

  if (!data.userId || !data.sessionId) {
    errors.push('Missing required user or session ID');
  }

  if (!data.timestamp || data.timestamp <= 0) {
    errors.push('Invalid timestamp');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates test data with specific characteristics for edge cases
 */
export function createEdgeCaseData(caseType: 'extreme_high' | 'extreme_low' | 'invalid' | 'missing_fields'): any {
  const baseData = createMockBiometricData();

  switch (caseType) {
    case 'extreme_high':
      return {
        ...baseData,
        heartRate: 240,
        cognitiveLoad: 98,
        attentionLevel: 99,
        stressLevel: 95,
        skinTemperature: 42
      };

    case 'extreme_low':
      return {
        ...baseData,
        heartRate: 35,
        cognitiveLoad: 2,
        attentionLevel: 1,
        stressLevel: 0,
        skinTemperature: 26
      };

    case 'invalid':
      return {
        ...baseData,
        heartRate: 300, // Too high
        cognitiveLoad: -10, // Negative
        attentionLevel: 150, // Over 100
        stressLevel: 'invalid', // Wrong type
        timestamp: -1 // Invalid timestamp
      };

    case 'missing_fields':
      return {
        userId: baseData.userId,
        timestamp: baseData.timestamp
        // Missing required fields
      };

    default:
      return baseData;
  }
}

// ==================== Performance Test Helpers ====================

/**
 * Measures execution time of an async function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTime: number }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  
  return {
    result,
    executionTime: endTime - startTime
  };
}

/**
 * Runs a function multiple times and returns statistics
 */
export async function benchmarkFunction<T>(
  fn: () => Promise<T>,
  iterations: number = 10
): Promise<{
  averageTime: number;
  minTime: number;
  maxTime: number;
  totalTime: number;
  results: T[];
}> {
  const times: number[] = [];
  const results: T[] = [];

  for (let i = 0; i < iterations; i++) {
    const { result, executionTime } = await measureExecutionTime(fn);
    times.push(executionTime);
    results.push(result);
  }

  return {
    averageTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    totalTime: times.reduce((a, b) => a + b, 0),
    results
  };
}

/**
 * Simulates network delay for testing
 */
export function simulateNetworkDelay(minMs: number = 10, maxMs: number = 100): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Creates a load test scenario
 */
export function createLoadTestScenario(
  concurrentUsers: number,
  requestsPerUser: number,
  requestDelay: number = 100
) {
  return {
    concurrentUsers,
    requestsPerUser,
    requestDelay,
    totalRequests: concurrentUsers * requestsPerUser,
    estimatedDuration: requestsPerUser * requestDelay
  };
}

// ==================== Mock Event Emitters ====================

/**
 * Creates a mock event emitter for testing
 */
export function createMockEventEmitter() {
  const listeners = new Map<string, Function[]>();

  return {
    on: vi.fn().mockImplementation((event: string, listener: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(listener);
    }),
    emit: vi.fn().mockImplementation((event: string, ...args: any[]) => {
      const eventListeners = listeners.get(event) || [];
      eventListeners.forEach(listener => listener(...args));
    }),
    removeAllListeners: vi.fn().mockImplementation(() => {
      listeners.clear();
    }),
    removeListener: vi.fn().mockImplementation((event: string, listener: Function) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    })
  };
}

// ==================== Database Test Helpers ====================

/**
 * Creates mock database records
 */
export function createMockDatabaseRecords(count: number, tableName: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${tableName}-${index + 1}`,
    createdAt: new Date(Date.now() - index * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...createMockBiometricData()
  }));
}

/**
 * Mock database query builder
 */
export function createMockQueryBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue([])
  };
}

// ==================== Assertion Helpers ====================

/**
 * Custom matchers for biometric data testing
 */
export const customMatchers = {
  toBeValidBiometricData: (received: any) => {
    const validation = validateBiometricData(received);
    return {
      pass: validation.valid,
      message: () => 
        validation.valid 
          ? `Expected data to be invalid`
          : `Expected valid biometric data, but got errors: ${validation.errors.join(', ')}`
    };
  },

  toBeWithinPhysiologicalRange: (received: number, metric: string) => {
    const ranges = {
      heartRate: { min: 30, max: 250 },
      cognitiveLoad: { min: 0, max: 100 },
      attentionLevel: { min: 0, max: 100 },
      stressLevel: { min: 0, max: 100 },
      skinTemperature: { min: 25, max: 45 }
    };

    const range = ranges[metric as keyof typeof ranges];
    if (!range) {
      return {
        pass: false,
        message: () => `Unknown metric: ${metric}`
      };
    }

    const isInRange = received >= range.min && received <= range.max;
    return {
      pass: isInRange,
      message: () => 
        isInRange
          ? `Expected ${received} to be outside range ${range.min}-${range.max}`
          : `Expected ${received} to be within range ${range.min}-${range.max}`
    };
  }
};

export default {
  createMockBiometricData,
  createBiometricSequence,
  createMockAnalytics,
  createMockNDPatterns,
  createMockWeaviateClient,
  createMockRedisClient,
  createMockWebSocketServer,
  createMockWebSocketClient,
  validateBiometricData,
  createEdgeCaseData,
  measureExecutionTime,
  benchmarkFunction,
  simulateNetworkDelay,
  createLoadTestScenario,
  createMockEventEmitter,
  createMockDatabaseRecords,
  createMockQueryBuilder,
  customMatchers
};