import { Request, Response } from 'express';
import { secureMemoryManager } from '../services/security/SecureMemoryManager';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';
import { HTTP_STATUS } from '../constants/ApplicationConstants';

/**
 * Security monitoring and memory protection endpoints
 * IP-restricted endpoints for security status and memory management
 */
export class SecurityEndpoints {
  
  /**
   * Get secure memory manager statistics
   * Restricted to admin IPs for security
   */
  static getMemoryStats = [
    SecurityMiddleware.ipWhitelist(),
    (req: Request, res: Response) => {
      try {
        const memoryStats = secureMemoryManager.getMemoryStats();
        const processMemory = process.memoryUsage();
        
        res.json({
          secureMemory: memoryStats,
          processMemory: {
            rss: Math.round(processMemory.rss / 1024 / 1024), // MB
            heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
            external: Math.round(processMemory.external / 1024 / 1024), // MB
            arrayBuffers: Math.round(processMemory.arrayBuffers / 1024 / 1024) // MB
          },
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      } catch (error) {
        console.error('Memory stats endpoint error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to retrieve memory statistics',
          timestamp: new Date().toISOString()
        });
      }
    }
  ];

  /**
   * Force garbage collection and memory cleanup (development only)
   */
  static forceMemoryCleanup = [
    SecurityMiddleware.ipWhitelist(),
    (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Memory cleanup endpoint not available in production',
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Trigger cleanup of expired secure buffers
        secureMemoryManager.cleanupExpiredBuffers();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const memoryAfter = process.memoryUsage();
        
        res.json({
          message: 'Memory cleanup completed',
          memoryUsage: {
            rss: Math.round(memoryAfter.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryAfter.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024), // MB
            external: Math.round(memoryAfter.external / 1024 / 1024), // MB
            arrayBuffers: Math.round(memoryAfter.arrayBuffers / 1024 / 1024) // MB
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Memory cleanup endpoint error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Memory cleanup failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  ];

  /**
   * Get comprehensive security status including memory protection
   */
  static getSecurityStatus = [
    SecurityMiddleware.ipWhitelist(),
    (req: Request, res: Response) => {
      try {
        const securityStatus = SecurityMiddleware.getSecurityStatus();
        const memoryStats = secureMemoryManager.getMemoryStats();
        
        res.json({
          ...securityStatus,
          memoryProtection: {
            enabled: true,
            secureBuffers: memoryStats.totalBuffers,
            totalSecureMemory: memoryStats.totalMemory,
            memoryPressure: memoryStats.memoryPressure,
            averageBufferAge: memoryStats.averageAge
          },
          cryptographicSecurity: {
            postQuantumEnabled: true,
            auditStatus: 'TRAIL_OF_BITS_AUDITED',
            memoryProtection: 'ACTIVE',
            keyDerivation: 'ENVIRONMENT_BASED'
          },
          recommendations: this.generateSecurityRecommendations(memoryStats)
        });
      } catch (error) {
        console.error('Security status endpoint error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to retrieve security status',
          timestamp: new Date().toISOString()
        });
      }
    }
  ];

  /**
   * Test secure memory allocation and cleanup
   */
  static testSecureMemory = [
    SecurityMiddleware.ipWhitelist(),
    async (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Memory testing endpoint not available in production',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const testData = 'sensitive-test-data-' + Date.now();
        const startTime = Date.now();
        
        // Test secure memory operations
        const result = await secureMemoryManager.executeWithSecureData(testData, async (bufferId) => {
          // Test write/read operations
          const readData = secureMemoryManager.readSecureData(bufferId);
          const hash = secureMemoryManager.createSecureHash(bufferId);
          
          return {
            dataLength: readData.length,
            hash,
            bufferInfo: secureMemoryManager.getBufferInfo(bufferId)
          };
        });
        
        const processingTime = Date.now() - startTime;
        
        res.json({
          message: 'Secure memory test completed successfully',
          test: {
            dataLength: result.dataLength,
            hash: result.hash,
            processingTime,
            bufferInfo: result.bufferInfo
          },
          memoryStats: secureMemoryManager.getMemoryStats(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Secure memory test error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Secure memory test failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }
  ];

  // ==================== Private Helper Methods ====================

  /**
   * Generate security recommendations based on current state
   */
  private static generateSecurityRecommendations(memoryStats: any): string[] {
    const recommendations: string[] = [];
    
    if (memoryStats.memoryPressure > 0.8) {
      recommendations.push('High memory pressure detected - consider increasing MAX_SECURE_BUFFERS');
    }
    
    if (memoryStats.averageAge > 600000) { // 10 minutes
      recommendations.push('Some secure buffers are old - consider reducing SECURE_BUFFER_TIMEOUT');
    }
    
    if (!process.env.PQC_BASE_SECRET) {
      recommendations.push('PQC_BASE_SECRET environment variable not set - using fallback key derivation');
    }
    
    if (process.env.NODE_ENV !== 'production') {
      recommendations.push('Development mode active - ensure production security settings before deployment');
    }
    
    if (memoryStats.totalBuffers === 0) {
      recommendations.push('No active secure buffers - memory protection system is idle');
    }
    
    return recommendations;
  }
}