import { BaseController } from './BaseController';
import { Request, Response } from 'express';
import { TOKENS } from '../di/tokens';

export class BiometricController extends BaseController {

  async getBiometricData(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      const anonymizationService = this.resolve(TOKENS.AnonymizationService);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      try {
        // Search Weaviate for biometric conversations instead of PostgreSQL
        const { weaviateService } = await import('../services/weaviate.service.js');
        const conversations = await weaviateService.searchConversations('biometric', limit);
        
        // Transform to legacy format for compatibility
        const biometricData = conversations.map(conv => ({
          id: conv.conversationId,
          heartRate: conv.heartRate,
          hrv: conv.hrv,
          stressLevel: conv.stressLevel,
          attentionLevel: conv.attentionLevel,
          cognitiveLoad: conv.cognitiveLoad,
          timestamp: new Date(conv.timestamp),
          userId: conv.userId,
          effectiveness: conv.effectivenessScore
        }));

        // Convert to PostgreSQL format for compatibility with anonymization service
        const legacyFormat = biometricData.map(item => ({
          id: parseInt(item.id) || 0,
          sessionId: null,
          heartRate: item.heartRate || null,
          hrv: item.hrv || null,
          stressLevel: item.stressLevel || null,
          attentionLevel: item.attentionLevel || null,
          cognitiveLoad: item.cognitiveLoad || null,
          skinTemperature: null,
          respiratoryRate: null,
          oxygenSaturation: null,
          environmentalData: null,
          deviceSource: 'weaviate',
          timestamp: item.timestamp
        }));
        
        // Generate anonymized statistics for privacy
        const anonymizedStats = anonymizationService.generateAnonymizedStats(legacyFormat);
        this.sendSuccess(res, {
          ...anonymizedStats,
          source: 'weaviate_primary',
          totalConversations: conversations.length
        });
      } catch (error) {
        console.error('Failed to get biometric data from Weaviate:', error);
        
        // Fallback to PostgreSQL for compatibility
        try {
          const rawData = await storage.getBiometricData(undefined, limit);
          const anonymizedStats = anonymizationService.generateAnonymizedStats(rawData);
          this.sendSuccess(res, { ...anonymizedStats, source: 'postgresql_fallback' });
        } catch (fallbackError) {
          this.sendError(res, 500, "Failed to fetch biometric statistics");
        }
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getBiometricTimeSeries(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      const anonymizationService = this.resolve(TOKENS.AnonymizationService);
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const maxPoints = req.query.maxPoints ? parseInt(req.query.maxPoints as string) : 20;
      const rawData = await storage.getBiometricData(undefined, limit);
      
      // Generate anonymized time series data
      const timeSeries = anonymizationService.generateAnonymizedTimeSeries(rawData, maxPoints);
      this.sendSuccess(res, timeSeries);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getLatestBiometricData(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      
      try {
        // Get latest from Weaviate
        const { weaviateService } = await import('../services/weaviate.service.js');
        const conversations = await weaviateService.searchConversations('biometric', 1);
        
        if (conversations.length > 0) {
          const latest = conversations[0];
          this.sendSuccess(res, {
            heartRate: latest.heartRate,
            hrv: latest.hrv,
            stressLevel: latest.stressLevel,
            attentionLevel: latest.attentionLevel,
            cognitiveLoad: latest.cognitiveLoad,
            timestamp: new Date(latest.timestamp),
            effectiveness: latest.effectivenessScore,
            source: 'weaviate_primary'
          });
        } else {
          // Fallback to PostgreSQL if no data in Weaviate
          const latest = await storage.getLatestBiometricData();
          this.sendSuccess(res, { ...latest, source: 'postgresql_fallback' });
        }
      } catch (error) {
        console.error('Failed to get latest biometric data from Weaviate:', error);
        // Fallback to PostgreSQL
        const latest = await storage.getLatestBiometricData();
        this.sendSuccess(res, { ...latest, source: 'postgresql_fallback' });
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async collectBiometricData(req: Request, res: Response): Promise<void> {
    try {
      const biometricService = this.resolve(TOKENS.BiometricService);
      const validatedData = req.body; // Assume validation middleware already ran
      
      const result = await biometricService.processBiometricReading(validatedData);
      this.sendSuccess(res, result, "Biometric data collected successfully");
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getBiometricAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analyticsService = this.resolve(TOKENS.AnalyticsService);
      const storage = this.resolve(TOKENS.DatabaseService);
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const rawData = await storage.getBiometricData(undefined, limit);
      
      // Generate analytics insights
      const analytics = await analyticsService.analyzeBiometricTrends(rawData);
      this.sendSuccess(res, analytics);
    } catch (error) {
      this.handleError(error, res);
    }
  }
}