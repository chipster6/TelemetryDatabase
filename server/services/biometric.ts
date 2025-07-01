import { storage } from "../storage";
import type { BiometricData, InsertBiometricData, CognitiveCorrelation } from "@shared/schema";

export interface BiometricReading {
  heartRate?: number;
  hrv?: number;
  stressLevel?: number;
  attentionLevel?: number;
  cognitiveLoad?: number;
  skinTemperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  environmentalData?: {
    soundLevel?: number;
    temperature?: number;
    lightLevel?: number;
    humidity?: number;
  };
  deviceSource: string;
}

export interface CognitiveMetrics {
  attentionScore: number;
  stressScore: number;
  cognitiveLoadScore: number;
  circadianAlignment: number;
}

export class BiometricService {
  private dataCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5000; // 5 seconds cache
  private correlationCoefficients = {
    hrvCognitivePerformance: 0.424,
    temperatureCircadianRhythm: 0.78,
    soundExposureCognitiveFatigue: -0.62,
    sleepQualityAttention: 0.71
  };

  async processBiometricReading(reading: BiometricReading, sessionId?: number): Promise<BiometricData> {
    // Calculate derived metrics
    const processedReading = this.calculateDerivedMetrics(reading);
    
    // Store biometric data
    const biometricData: InsertBiometricData = {
      sessionId: sessionId || null,
      heartRate: processedReading.heartRate || null,
      hrv: processedReading.hrv || null,
      stressLevel: processedReading.stressLevel || null,
      attentionLevel: processedReading.attentionLevel || null,
      cognitiveLoad: processedReading.cognitiveLoad || null,
      skinTemperature: processedReading.skinTemperature || null,
      respiratoryRate: processedReading.respiratoryRate || null,
      oxygenSaturation: processedReading.oxygenSaturation || null,
      environmentalData: processedReading.environmentalData || null,
      deviceSource: processedReading.deviceSource
    };

    const savedData = await storage.createBiometricData(biometricData);

    // Calculate and store cognitive correlations if session exists
    if (sessionId) {
      const cognitiveMetrics = this.calculateCognitiveCorrelations(processedReading);
      await storage.createCognitiveCorrelation({
        sessionId,
        attentionScore: cognitiveMetrics.attentionScore,
        stressScore: cognitiveMetrics.stressScore,
        cognitiveLoadScore: cognitiveMetrics.cognitiveLoadScore,
        circadianAlignment: cognitiveMetrics.circadianAlignment,
        promptComplexityScore: null,
        responseQualityScore: null
      });
    }

    return savedData;
  }

  private calculateDerivedMetrics(reading: BiometricReading): BiometricReading {
    const processed = { ...reading };

    // Calculate stress level from HRV and heart rate if not provided
    if (!processed.stressLevel && processed.hrv && processed.heartRate) {
      const normalizedHRV = Math.max(0, Math.min(1, processed.hrv / 50));
      const normalizedHR = Math.max(0, Math.min(1, (processed.heartRate - 60) / 40));
      processed.stressLevel = Math.round((1 - normalizedHRV + normalizedHR) * 50);
    }

    // Calculate attention level from HRV and environmental factors
    if (!processed.attentionLevel && processed.hrv) {
      let attention = processed.hrv / 45 * 100; // Base attention from HRV
      
      // Environmental adjustments
      if (processed.environmentalData?.soundLevel) {
        const soundImpact = Math.max(0, (processed.environmentalData.soundLevel - 50) / 30);
        attention -= soundImpact * 20;
      }
      
      processed.attentionLevel = Math.max(0, Math.min(100, Math.round(attention)));
    }

    // Calculate cognitive load from multiple factors
    if (!processed.cognitiveLoad) {
      let cogLoad = 0;
      let factors = 0;

      if (processed.respiratoryRate) {
        cogLoad += Math.max(0, (processed.respiratoryRate - 14) / 8) * 100;
        factors++;
      }

      if (processed.skinTemperature) {
        cogLoad += Math.abs(processed.skinTemperature - 36.5) / 1.5 * 100;
        factors++;
      }

      if (processed.environmentalData?.soundLevel) {
        cogLoad += Math.max(0, (processed.environmentalData.soundLevel - 50) / 30) * 100;
        factors++;
      }

      if (factors > 0) {
        processed.cognitiveLoad = Math.round(cogLoad / factors);
      }
    }

    return processed;
  }

  private calculateCognitiveCorrelations(reading: BiometricReading): CognitiveMetrics {
    // Attention correlation (HRV + temperature + environmental factors)
    let attentionScore = 0;
    if (reading.hrv) {
      const hrvFactor = Math.min(reading.hrv / 45, 1);
      attentionScore += hrvFactor * 70;
    }
    if (reading.skinTemperature) {
      const tempFactor = 1 - Math.abs(reading.skinTemperature - 36.5) / 2;
      attentionScore += tempFactor * 30;
    }

    // Stress correlation (inverse of HRV + respiratory rate)
    let stressScore = 0;
    if (reading.hrv) {
      stressScore += Math.max(0, (45 - reading.hrv) / 45) * 60;
    }
    if (reading.respiratoryRate) {
      stressScore += Math.max(0, (reading.respiratoryRate - 16) / 10) * 40;
    }

    // Cognitive load correlation
    let cognitiveLoadScore = reading.cognitiveLoad || 0;

    // Circadian alignment based on temperature patterns
    let circadianAlignment = 50; // default
    if (reading.skinTemperature) {
      const currentHour = new Date().getHours();
      const optimalTempWindow = (currentHour >= 6 && currentHour <= 22);
      const expectedTemp = optimalTempWindow ? 36.7 : 36.3;
      circadianAlignment = Math.max(0, (1 - Math.abs(reading.skinTemperature - expectedTemp) / 1.0) * 100);
    }

    return {
      attentionScore: Math.max(0, Math.min(100, attentionScore)),
      stressScore: Math.max(0, Math.min(100, stressScore)),
      cognitiveLoadScore: Math.max(0, Math.min(100, cognitiveLoadScore)),
      circadianAlignment: Math.max(0, Math.min(100, circadianAlignment))
    };
  }

  generateRealisticBiometricData(): BiometricReading {
    const now = new Date();
    const hour = now.getHours();
    
    // Generate biologically plausible data with circadian variations
    const baseHR = 70 + Math.sin(hour / 24 * 2 * Math.PI) * 8; // Circadian rhythm
    const heartRate = Math.round(baseHR + (Math.random() - 0.5) * 10);
    
    const baseHRV = 40 + Math.sin(hour / 24 * 2 * Math.PI) * 10;
    const hrv = Math.max(20, baseHRV + (Math.random() - 0.5) * 15);
    
    const skinTemp = 36.1 + Math.sin(hour / 24 * 2 * Math.PI) * 0.6 + (Math.random() - 0.5) * 0.4;
    
    return {
      heartRate,
      hrv: Math.round(hrv * 10) / 10,
      respiratoryRate: Math.round((12 + Math.random() * 8) * 10) / 10,
      oxygenSaturation: Math.round((96 + Math.random() * 3) * 10) / 10,
      skinTemperature: Math.round(skinTemp * 10) / 10,
      environmentalData: {
        soundLevel: Math.round(30 + Math.random() * 40),
        temperature: Math.round((18 + Math.random() * 8) * 10) / 10,
        lightLevel: Math.round(Math.max(0, 200 + Math.sin(hour / 24 * 2 * Math.PI) * 300 + Math.random() * 100)),
        humidity: Math.round(40 + Math.random() * 30)
      },
      deviceSource: 'simulation'
    };
  }

  async getRecentBiometricTrends(limit: number = 50): Promise<BiometricData[]> {
    const cacheKey = `trends_${limit}`;
    const cached = this.dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const data = await storage.getBiometricData(undefined, limit);
    this.dataCache.set(cacheKey, { data, timestamp: Date.now() });
    
    // Clean up expired cache entries
    this.clearExpiredCache();
    
    return data;
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of Array.from(this.dataCache.entries())) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.dataCache.delete(key);
      }
    }
  }

  async getBiometricStats(): Promise<{
    totalSamples: number;
    avgHeartRate: number;
    avgHRV: number;
    avgStressLevel: number;
    avgAttentionLevel: number;
  }> {
    const recentData = await this.getRecentBiometricTrends(100);
    
    if (recentData.length === 0) {
      return {
        totalSamples: 0,
        avgHeartRate: 0,
        avgHRV: 0,
        avgStressLevel: 0,
        avgAttentionLevel: 0
      };
    }

    const validHR = recentData.filter(d => d.heartRate !== null);
    const validHRV = recentData.filter(d => d.hrv !== null);
    const validStress = recentData.filter(d => d.stressLevel !== null);
    const validAttention = recentData.filter(d => d.attentionLevel !== null);

    return {
      totalSamples: recentData.length,
      avgHeartRate: validHR.length > 0 ? Math.round(validHR.reduce((sum, d) => sum + d.heartRate!, 0) / validHR.length) : 0,
      avgHRV: validHRV.length > 0 ? Math.round(validHRV.reduce((sum, d) => sum + d.hrv!, 0) / validHRV.length * 10) / 10 : 0,
      avgStressLevel: validStress.length > 0 ? Math.round(validStress.reduce((sum, d) => sum + d.stressLevel!, 0) / validStress.length) : 0,
      avgAttentionLevel: validAttention.length > 0 ? Math.round(validAttention.reduce((sum, d) => sum + d.attentionLevel!, 0) / validAttention.length) : 0
    };
  }
}

export const biometricService = new BiometricService();
