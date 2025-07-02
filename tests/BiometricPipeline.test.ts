// Comprehensive Test Suite for Enhanced Biometric Pipeline
// Tests for all major components with extensive coverage

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi, Mock } from 'vitest';
import { createMockBiometricData, createMockWeaviateClient, createMockRedisClient } from './helpers/testHelpers';

import BiometricPipelineService, { BiometricDataPoint, ProcessingResult } from '../server/services/BiometricPipelineService';
import NeurodivergentAnalyticsService, { NDPatterns } from '../server/services/NeurodivergentAnalyticsService';
import BiometricSecurityService, { EncryptedBiometricData } from '../server/services/BiometricSecurityService';
import BiometricPerformanceService, { PerformanceMetrics } from '../server/services/BiometricPerformanceService';

// ==================== Test Setup ====================

describe('Enhanced Biometric Pipeline Test Suite', () => {
  let pipelineService: BiometricPipelineService;
  let analyticsService: NeurodivergentAnalyticsService;
  let securityService: BiometricSecurityService;
  let performanceService: BiometricPerformanceService;
  
  let mockWeaviate: any;
  let mockRedis: any;
  let mockWebSocketServer: any;

  beforeAll(async () => {
    // Setup global test environment
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    // Create mock dependencies
    mockWeaviate = createMockWeaviateClient();
    mockRedis = createMockRedisClient();
    mockWebSocketServer = {
      clients: new Set(),
      on: vi.fn(),
      emit: vi.fn()
    };

    // Initialize services
    pipelineService = new BiometricPipelineService(mockWeaviate, mockRedis, mockWebSocketServer);
    analyticsService = new NeurodivergentAnalyticsService(mockWeaviate, mockRedis);
    securityService = new BiometricSecurityService();
    performanceService = new BiometricPerformanceService(mockRedis, {
      connectionPool: {
        minConnections: 2,
        maxConnections: 10,
        acquireTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 10000
      },
      streamProcessing: {
        batchSize: 100,
        flushInterval: 1000,
        maxConcurrency: 5,
        backpressureThreshold: 1000
      },
      edgeProcessing: true,
      memoryThreshold: 80
    });
  });

  afterEach(async () => {
    // Cleanup
    await pipelineService?.shutdown();
    await analyticsService?.shutdown();
    await securityService?.shutdown();
    await performanceService?.shutdown();
    vi.clearAllMocks();
  });

  // ==================== Biometric Pipeline Service Tests ====================

  describe('BiometricPipelineService', () => {
    describe('processBiometricData', () => {
      it('should successfully process valid biometric data', async () => {
        const testData = createMockBiometricData();
        
        const result = await pipelineService.processBiometricData(testData);
        
        expect(result.success).toBe(true);
        expect(result.dataPoint).toBeDefined();
        expect(result.analytics).toBeDefined();
        expect(result.alerts).toBeDefined();
      });

      it('should reject invalid biometric data', async () => {
        const invalidData = {
          ...createMockBiometricData(),
          heartRate: 300 // Invalid heart rate
        };
        
        const result = await pipelineService.processBiometricData(invalidData);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Heart rate out of physiological range');
      });

      it('should handle missing required fields', async () => {
        const incompleteData = {
          timestamp: Date.now(),
          userId: 'test-user'
          // Missing required fields
        } as BiometricDataPoint;
        
        const result = await pipelineService.processBiometricData(incompleteData);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing required field');
      });

      it('should apply privacy protections', async () => {
        const testData = createMockBiometricData();
        
        const result = await pipelineService.processBiometricData(testData);
        
        expect(result.success).toBe(true);
        // Verify that data has been processed through privacy layer
        expect(result.dataPoint?.heartRate).not.toBe(testData.heartRate); // Should be slightly different due to noise
      });

      it('should emit processing events', async () => {
        const testData = createMockBiometricData();
        const eventSpy = vi.fn();
        
        pipelineService.on('dataProcessed', eventSpy);
        
        await pipelineService.processBiometricData(testData);
        
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            dataPoint: expect.any(Object),
            analytics: expect.any(Object),
            alerts: expect.any(Array)
          })
        );
      });

      it('should handle high-volume data processing', async () => {
        const testDataPoints = Array.from({ length: 100 }, () => createMockBiometricData());
        
        const results = await Promise.all(
          testDataPoints.map(data => pipelineService.processBiometricData(data))
        );
        
        const successfulResults = results.filter(r => r.success);
        expect(successfulResults.length).toBe(100);
      });
    });

    describe('getCurrentAnalytics', () => {
      it('should return current analytics for user', async () => {
        const userId = 'test-user';
        
        // First process some data
        await pipelineService.processBiometricData(createMockBiometricData({ userId }));
        
        const analytics = await pipelineService.getCurrentAnalytics(userId);
        
        expect(analytics).toBeDefined();
        expect(analytics?.cognitiveLoad).toBeDefined();
        expect(analytics?.attentionTrend).toBeDefined();
        expect(analytics?.stressAnalysis).toBeDefined();
      });

      it('should return null for user with no data', async () => {
        const analytics = await pipelineService.getCurrentAnalytics('nonexistent-user');
        
        expect(analytics).toBeNull();
      });
    });

    describe('exportTrainingData', () => {
      it('should export training data for date range', async () => {
        const userId = 'test-user';
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        
        const trainingData = await pipelineService.exportTrainingData(userId, { start: startDate, end: endDate });
        
        expect(trainingData).toBeDefined();
        expect(trainingData.userId).toBe(userId);
        expect(trainingData.exportedAt).toBeDefined();
      });
    });
  });

  // ==================== Neurodivergent Analytics Tests ====================

  describe('NeurodivergentAnalyticsService', () => {
    describe('analyzeNeurodivergentPatterns', () => {
      it('should detect hyperfocus patterns', async () => {
        const userId = 'test-user';
        const hyperfocusData = Array.from({ length: 20 }, (_, i) => 
          createMockBiometricData({
            userId,
            timestamp: Date.now() + i * 60000, // 1 minute intervals
            attentionLevel: 90, // High attention
            cognitiveLoad: 75, // Moderate cognitive load
            stressLevel: 30 // Low stress
          })
        );
        
        const patterns = await analyticsService.analyzeNeurodivergentPatterns(userId, hyperfocusData);
        
        expect(patterns.hyperfocus.length).toBeGreaterThan(0);
        expect(patterns.hyperfocus[0].duration).toBeGreaterThan(900000); // > 15 minutes
        expect(patterns.hyperfocus[0].avgAttention).toBeGreaterThan(80);
      });

      it('should analyze context switching patterns', async () => {
        const userId = 'test-user';
        const switchingData = Array.from({ length: 10 }, (_, i) => 
          createMockBiometricData({
            userId,
            timestamp: Date.now() + i * 300000, // 5 minute intervals
            contextId: `context-${i % 3}`, // Frequent context changes
            attentionLevel: 50 + (i % 2) * 30 // Variable attention
          })
        );
        
        const patterns = await analyticsService.analyzeNeurodivergentPatterns(userId, switchingData);
        
        expect(patterns.contextSwitching.switchCount).toBeGreaterThan(0);
        expect(patterns.contextSwitching.pattern).toBeDefined();
        expect(patterns.contextSwitching.hourlyRate).toBeGreaterThan(0);
      });

      it('should evaluate sensory processing patterns', async () => {
        const userId = 'test-user';
        const sensoryData = Array.from({ length: 15 }, (_, i) => 
          createMockBiometricData({
            userId,
            timestamp: Date.now() + i * 120000, // 2 minute intervals
            environmentalSound: 80 + (i % 3) * 20, // Variable sound levels
            stressLevel: 70 + (i % 2) * 20, // High stress during loud periods
            attentionLevel: 60 - (i % 3) * 20 // Reduced attention during overload
          })
        );
        
        const patterns = await analyticsService.analyzeNeurodivergentPatterns(userId, sensoryData);
        
        expect(patterns.sensoryProcessing.overloadEvents).toBeGreaterThan(0);
        expect(patterns.sensoryProcessing.triggerThresholds.sound).toBeGreaterThan(0);
      });

      it('should assess executive function patterns', async () => {
        const userId = 'test-user';
        const executiveData = Array.from({ length: 30 }, (_, i) => 
          createMockBiometricData({
            userId,
            timestamp: Date.now() + i * 60000,
            cognitiveLoad: 60 + Math.sin(i / 5) * 30, // Cyclical cognitive load
            attentionLevel: 70 + Math.cos(i / 3) * 20 // Variable attention
          })
        );
        
        const patterns = await analyticsService.analyzeNeurodivergentPatterns(userId, executiveData);
        
        expect(patterns.executiveFunction.avgCognitiveLoad).toBeGreaterThan(0);
        expect(patterns.executiveFunction.planningEfficiency).toBeDefined();
        expect(patterns.executiveFunction.workingMemoryLoad).toBeDefined();
      });

      it('should cache patterns for performance', async () => {
        const userId = 'test-user';
        const testData = [createMockBiometricData({ userId })];
        
        // First call
        const patterns1 = await analyticsService.analyzeNeurodivergentPatterns(userId, testData);
        
        // Second call (should use cache)
        const patterns2 = await analyticsService.analyzeNeurodivergentPatterns(userId, testData);
        
        expect(patterns1.timestamp).toBe(patterns2.timestamp);
      });
    });

    describe('analyzeHistoricalPatterns', () => {
      it('should analyze patterns over time range', async () => {
        const userId = 'test-user';
        const timeRange = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };
        
        const patterns = await analyticsService.analyzeHistoricalPatterns(userId, timeRange);
        
        expect(patterns).toBeDefined();
        // Additional assertions based on your implementation
      });
    });
  });

  // ==================== Security Service Tests ====================

  describe('BiometricSecurityService', () => {
    describe('encryptBiometricData', () => {
      it('should encrypt biometric data successfully', async () => {
        const testData = createMockBiometricData();
        
        const encrypted = await securityService.encryptBiometricData(testData);
        
        expect(encrypted.encryptedData).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.authTag).toBeDefined();
        expect(encrypted.keyId).toBeDefined();
        expect(encrypted.algorithm).toBe('aes-256-gcm');
      });

      it('should reject invalid biometric data', async () => {
        const invalidData = {
          ...createMockBiometricData(),
          heartRate: -50 // Invalid value
        };
        
        await expect(securityService.encryptBiometricData(invalidData))
          .rejects.toThrow('Heart rate out of physiological range');
      });

      it('should handle rate limiting', async () => {
        const testData = createMockBiometricData();
        
        // Simulate many rapid requests
        const promises = Array.from({ length: 1001 }, () => 
          securityService.encryptBiometricData(testData)
        );
        
        const results = await Promise.allSettled(promises);
        const rejected = results.filter(r => r.status === 'rejected');
        
        expect(rejected.length).toBeGreaterThan(0);
        expect(rejected[0].reason.message).toContain('Rate limit exceeded');
      });
    });

    describe('decryptBiometricData', () => {
      it('should decrypt data encrypted by the service', async () => {
        const originalData = createMockBiometricData();
        
        const encrypted = await securityService.encryptBiometricData(originalData);
        const decrypted = await securityService.decryptBiometricData(encrypted);
        
        expect(decrypted.userId).toBe(originalData.userId);
        expect(decrypted.sessionId).toBe(originalData.sessionId);
        // Note: Some values may differ due to differential privacy
      });

      it('should reject tampered encrypted data', async () => {
        const testData = createMockBiometricData();
        const encrypted = await securityService.encryptBiometricData(testData);
        
        // Tamper with the encrypted data
        encrypted.encryptedData = encrypted.encryptedData.slice(0, -10) + '0123456789';
        
        await expect(securityService.decryptBiometricData(encrypted))
          .rejects.toThrow();
      });

      it('should reject old encrypted data', async () => {
        const testData = createMockBiometricData();
        const encrypted = await securityService.encryptBiometricData(testData);
        
        // Make the data appear old
        encrypted.timestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
        
        await expect(securityService.decryptBiometricData(encrypted))
          .rejects.toThrow('Encrypted data is too old');
      });
    });

    describe('validateDataIntegrity', () => {
      it('should validate correct biometric data', async () => {
        const testData = createMockBiometricData();
        
        const isValid = await securityService.validateDataIntegrity(testData);
        
        expect(isValid).toBe(true);
      });

      it('should reject data with invalid physiological values', async () => {
        const invalidData = {
          ...createMockBiometricData(),
          heartRate: 300 // Impossible value
        };
        
        const isValid = await securityService.validateDataIntegrity(invalidData);
        
        expect(isValid).toBe(false);
      });

      it('should detect anomalies in data patterns', async () => {
        const anomalousData = {
          ...createMockBiometricData(),
          heartRate: 200, // Very high
          stressLevel: 5 // Very low - inconsistent combination
        };
        
        const isValid = await securityService.validateDataIntegrity(anomalousData);
        
        expect(isValid).toBe(false);
      });
    });

    describe('applyDifferentialPrivacy', () => {
      it('should apply noise to biometric data', async () => {
        const testData = Array.from({ length: 10 }, () => createMockBiometricData());
        
        const privateData = await securityService.applyDifferentialPrivacy(testData, {
          epsilon: 1.0,
          delta: 1e-5,
          sensitivity: 1.0,
          noiseType: 'laplacian'
        });
        
        expect(privateData.length).toBe(testData.length);
        
        // Verify that noise has been added
        const originalSum = testData.reduce((sum, d) => sum + d.heartRate, 0);
        const privateSum = privateData.reduce((sum, d) => sum + d.heartRate, 0);
        expect(Math.abs(originalSum - privateSum)).toBeGreaterThan(0);
      });
    });

    describe('generateDataHash and verifyDataHash', () => {
      it('should generate and verify consistent hashes', () => {
        const testData = createMockBiometricData();
        
        const hash1 = securityService.generateDataHash(testData);
        const hash2 = securityService.generateDataHash(testData);
        
        expect(hash1).toBe(hash2);
        expect(securityService.verifyDataHash(testData, hash1)).toBe(true);
      });

      it('should detect data tampering', () => {
        const testData = createMockBiometricData();
        const originalHash = securityService.generateDataHash(testData);
        
        // Modify the data
        testData.heartRate += 1;
        
        expect(securityService.verifyDataHash(testData, originalHash)).toBe(false);
      });
    });
  });

  // ==================== Performance Service Tests ====================

  describe('BiometricPerformanceService', () => {
    describe('processWithOptimization', () => {
      it('should process data with performance optimizations', async () => {
        const testData = createMockBiometricData();
        
        const result = await performanceService.processWithOptimization(testData, {
          priority: 'high',
          processingMode: 'edge'
        });
        
        expect(result.processed).toBe(true);
        expect(result.processingTime).toBeGreaterThan(0);
        expect(result.result).toBeDefined();
      });

      it('should handle resource constraints gracefully', async () => {
        const testData = createMockBiometricData();
        
        // Simulate resource exhaustion
        vi.spyOn(performanceService as any, 'checkSystemResources')
          .mockResolvedValue({ canProcess: false });
        
        const result = await performanceService.processWithOptimization(testData);
        
        expect(result.processed).toBe(false);
        expect(result.error).toContain('resource');
      });

      it('should choose appropriate processing strategy', async () => {
        const simpleData = createMockBiometricData();
        const complexData = {
          ...createMockBiometricData(),
          metadata: { complexity: 'high' },
          environmentalSound: 85,
          lightLevel: 1200
        };
        
        const simpleResult = await performanceService.processWithOptimization(simpleData);
        const complexResult = await performanceService.processWithOptimization(complexData);
        
        // Simple data should process faster
        expect(simpleResult.processingTime).toBeLessThan(complexResult.processingTime);
      });
    });

    describe('getPerformanceMetrics', () => {
      it('should return current performance metrics', () => {
        const metrics = performanceService.getPerformanceMetrics();
        
        expect(metrics.memoryUsage).toBeDefined();
        expect(metrics.requestsPerSecond).toBeGreaterThanOrEqual(0);
        expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
        expect(metrics.timestamp).toBeGreaterThan(0);
      });
    });

    describe('optimizeResources', () => {
      it('should trigger resource optimization', async () => {
        const optimizeSpy = vi.fn();
        performanceService.on('resourcesOptimized', optimizeSpy);
        
        await performanceService.optimizeResources();
        
        expect(optimizeSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            timestamp: expect.any(Number),
            metrics: expect.any(Object)
          })
        );
      });
    });

    describe('scaleProcessing', () => {
      it('should scale processing capacity up', async () => {
        const scalingSpy = vi.fn();
        performanceService.on('scalingCompleted', scalingSpy);
        
        await performanceService.scaleProcessing('up', 1.5);
        
        expect(scalingSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            direction: 'up',
            factor: 1.5
          })
        );
      });

      it('should scale processing capacity down', async () => {
        const scalingSpy = vi.fn();
        performanceService.on('scalingCompleted', scalingSpy);
        
        await performanceService.scaleProcessing('down', 0.8);
        
        expect(scalingSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            direction: 'down',
            factor: 0.8
          })
        );
      });
    });
  });

  // ==================== Integration Tests ====================

  describe('Integration Tests', () => {
    it('should process data through complete pipeline', async () => {
      const testData = createMockBiometricData();
      
      // Process through main pipeline
      const pipelineResult = await pipelineService.processBiometricData(testData);
      expect(pipelineResult.success).toBe(true);
      
      // Analyze patterns
      const patterns = await analyticsService.analyzeNeurodivergentPatterns(
        testData.userId,
        [testData]
      );
      expect(patterns).toBeDefined();
      
      // Encrypt processed data
      const encrypted = await securityService.encryptBiometricData(testData);
      expect(encrypted.encryptedData).toBeDefined();
      
      // Decrypt and verify
      const decrypted = await securityService.decryptBiometricData(encrypted);
      expect(decrypted.userId).toBe(testData.userId);
    });

    it('should handle errors gracefully across services', async () => {
      const invalidData = {
        userId: 'test-user',
        heartRate: -50, // Invalid
        timestamp: Date.now()
      } as BiometricDataPoint;
      
      // Pipeline should reject invalid data
      const pipelineResult = await pipelineService.processBiometricData(invalidData);
      expect(pipelineResult.success).toBe(false);
      
      // Security service should also reject
      await expect(securityService.encryptBiometricData(invalidData))
        .rejects.toThrow();
    });

    it('should maintain performance under load', async () => {
      const testDataPoints = Array.from({ length: 50 }, () => createMockBiometricData());
      
      const startTime = performance.now();
      
      const results = await Promise.all(
        testDataPoints.map(data => 
          performanceService.processWithOptimization(data, { priority: 'medium' })
        )
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should process 50 items in reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds
      expect(results.filter(r => r.processed).length).toBe(50);
    });

    it('should emit appropriate events during processing', async () => {
      const testData = createMockBiometricData();
      
      const pipelineEvents: string[] = [];
      const analyticsEvents: string[] = [];
      const securityEvents: string[] = [];
      const performanceEvents: string[] = [];
      
      pipelineService.on('dataProcessed', () => pipelineEvents.push('dataProcessed'));
      analyticsService.on('patternsDetected', () => analyticsEvents.push('patternsDetected'));
      securityService.on('securityEvent', () => securityEvents.push('securityEvent'));
      performanceService.on('processingError', () => performanceEvents.push('processingError'));
      
      await pipelineService.processBiometricData(testData);
      await analyticsService.analyzeNeurodivergentPatterns(testData.userId, [testData]);
      await securityService.encryptBiometricData(testData);
      
      expect(pipelineEvents.length).toBeGreaterThan(0);
      expect(analyticsEvents.length).toBeGreaterThan(0);
    });
  });

  // ==================== Performance Tests ====================

  describe('Performance Tests', () => {
    it('should process data within acceptable time limits', async () => {
      const testData = createMockBiometricData();
      
      const startTime = performance.now();
      await pipelineService.processBiometricData(testData);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
    });

    it('should handle concurrent processing efficiently', async () => {
      const concurrentData = Array.from({ length: 10 }, () => createMockBiometricData());
      
      const startTime = performance.now();
      
      const results = await Promise.all(
        concurrentData.map(data => pipelineService.processBiometricData(data))
      );
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Under 2 seconds for 10 concurrent
      expect(results.filter(r => r.success).length).toBe(10);
    });

    it('should maintain memory usage within bounds', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many data points
      for (let i = 0; i < 100; i++) {
        await pipelineService.processBiometricData(createMockBiometricData());
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });
  });

  // ==================== Error Handling Tests ====================

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      // Mock database failure
      mockWeaviate.batch.objectsBatcher.mockRejectedValue(new Error('Database connection failed'));
      
      const testData = createMockBiometricData();
      const result = await pipelineService.processBiometricData(testData);
      
      // Should not crash the service
      expect(result).toBeDefined();
    });

    it('should handle Redis connection failures', async () => {
      // Mock Redis failure
      mockRedis.setEx.mockRejectedValue(new Error('Redis connection failed'));
      
      const testData = createMockBiometricData();
      const result = await pipelineService.processBiometricData(testData);
      
      // Should still process data even without caching
      expect(result).toBeDefined();
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = {
        userId: null,
        heartRate: 'invalid',
        timestamp: 'not-a-number'
      } as any;
      
      const result = await pipelineService.processBiometricData(malformedData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should recover from temporary service failures', async () => {
      let callCount = 0;
      const originalMethod = pipelineService.processBiometricData.bind(pipelineService);
      
      // Mock first call to fail, second to succeed
      vi.spyOn(pipelineService, 'processBiometricData').mockImplementation(async (data) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        return originalMethod(data);
      });
      
      const testData = createMockBiometricData();
      
      // First call should fail
      await expect(pipelineService.processBiometricData(testData)).rejects.toThrow('Temporary failure');
      
      // Second call should succeed
      const result = await pipelineService.processBiometricData(testData);
      expect(result.success).toBe(true);
    });
  });
});

// ==================== Stress Tests ====================

describe('Stress Tests', () => {
  let pipelineService: BiometricPipelineService;
  let mockWeaviate: any;
  let mockRedis: any;

  beforeEach(() => {
    mockWeaviate = createMockWeaviateClient();
    mockRedis = createMockRedisClient();
    pipelineService = new BiometricPipelineService(mockWeaviate, mockRedis);
  });

  afterEach(async () => {
    await pipelineService?.shutdown();
  });

  it('should handle high-volume data streams', async () => {
    const dataStream = Array.from({ length: 1000 }, () => createMockBiometricData());
    
    const startTime = performance.now();
    
    const results = await Promise.allSettled(
      dataStream.map(data => pipelineService.processBiometricData(data))
    );
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Processed ${successful} successful, ${failed} failed in ${processingTime}ms`);
    
    expect(successful).toBeGreaterThan(950); // At least 95% success rate
    expect(processingTime).toBeLessThan(30000); // Under 30 seconds
  });

  it('should handle rapid consecutive requests', async () => {
    const testData = createMockBiometricData();
    
    const rapidRequests = Array.from({ length: 100 }, () => 
      pipelineService.processBiometricData(testData)
    );
    
    const results = await Promise.allSettled(rapidRequests);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    expect(successful).toBeGreaterThan(90); // At least 90% success rate
  });

  it('should maintain performance under sustained load', async () => {
    const testData = createMockBiometricData();
    const processingTimes: number[] = [];
    
    // Process data for 5 seconds
    const endTime = Date.now() + 5000;
    let requestCount = 0;
    
    while (Date.now() < endTime) {
      const startTime = performance.now();
      await pipelineService.processBiometricData(testData);
      const duration = performance.now() - startTime;
      
      processingTimes.push(duration);
      requestCount++;
    }
    
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const maxProcessingTime = Math.max(...processingTimes);
    
    console.log(`Processed ${requestCount} requests, avg: ${avgProcessingTime}ms, max: ${maxProcessingTime}ms`);
    
    expect(avgProcessingTime).toBeLessThan(100); // Average under 100ms
    expect(maxProcessingTime).toBeLessThan(1000); // Max under 1 second
  });
});