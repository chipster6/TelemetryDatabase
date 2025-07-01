import { BiometricData } from '../../shared/schema.js';

export interface AnonymizedBiometricStats {
  totalSamples: number;
  timeRange: {
    start: number;
    end: number;
  };
  aggregatedMetrics: {
    heartRate: {
      min: number;
      max: number;
      avg: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    hrv: {
      min: number;
      max: number;
      avg: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    stress: {
      low: number;    // percentage of readings in low stress
      medium: number; // percentage of readings in medium stress
      high: number;   // percentage of readings in high stress
    };
    attention: {
      low: number;    // percentage of readings with low attention
      medium: number; // percentage of readings with medium attention
      high: number;   // percentage of readings with high attention
    };
  };
  wellnessScore: number; // 0-100 composite wellness score
  recommendations: string[];
}

export interface AnonymizedTimeSeriesPoint {
  timestamp: number;
  wellnessScore: number;
  stressLevel: 'low' | 'medium' | 'high';
  attentionLevel: 'low' | 'medium' | 'high';
}

export class AnonymizationService {
  
  /**
   * Convert raw biometric data to anonymized aggregated statistics
   */
  generateAnonymizedStats(biometricData: BiometricData[]): AnonymizedBiometricStats {
    if (biometricData.length === 0) {
      return this.getEmptyStats();
    }

    const heartRates = biometricData.map(d => d.heartRate).filter(hr => hr !== null) as number[];
    const hrvValues = biometricData.map(d => d.hrv).filter(hrv => hrv !== null) as number[];
    const stressLevels = biometricData.map(d => d.stressLevel).filter(sl => sl !== null) as number[];
    const attentionLevels = biometricData.map(d => d.attentionLevel).filter(al => al !== null) as number[];

    // Calculate aggregated metrics
    const heartRateStats = this.calculateNumericStats(heartRates);
    const hrvStats = this.calculateNumericStats(hrvValues);
    const stressDistribution = this.calculateDistribution(stressLevels, [0.3, 0.6]); // low < 0.3, medium 0.3-0.6, high > 0.6
    const attentionDistribution = this.calculateDistribution(attentionLevels, [0.4, 0.7]); // low < 0.4, medium 0.4-0.7, high > 0.7

    // Calculate composite wellness score
    const wellnessScore = this.calculateWellnessScore(heartRateStats.avg, hrvStats.avg, stressDistribution, attentionDistribution);

    // Generate recommendations
    const recommendations = this.generateRecommendations(wellnessScore, stressDistribution, attentionDistribution);

    return {
      totalSamples: biometricData.length,
      timeRange: {
        start: Math.min(...biometricData.map(d => d.timestamp ? new Date(d.timestamp).getTime() : Date.now())),
        end: Math.max(...biometricData.map(d => d.timestamp ? new Date(d.timestamp).getTime() : Date.now()))
      },
      aggregatedMetrics: {
        heartRate: heartRateStats,
        hrv: hrvStats,
        stress: stressDistribution,
        attention: attentionDistribution
      },
      wellnessScore,
      recommendations
    };
  }

  /**
   * Generate anonymized time series data for charts
   */
  generateAnonymizedTimeSeries(biometricData: BiometricData[], maxPoints: number = 20): AnonymizedTimeSeriesPoint[] {
    if (biometricData.length === 0) {
      return [];
    }

    // Group data into time buckets
    const sortedData = [...biometricData].sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return aTime - bTime;
    });

    const bucketSize = Math.max(1, Math.floor(sortedData.length / maxPoints));
    const timeSeries: AnonymizedTimeSeriesPoint[] = [];

    for (let i = 0; i < sortedData.length; i += bucketSize) {
      const bucket = sortedData.slice(i, i + bucketSize);
      const avgTimestamp = bucket.reduce((sum, d) => {
        return sum + (d.timestamp ? new Date(d.timestamp).getTime() : Date.now());
      }, 0) / bucket.length;

      const avgStress = bucket.reduce((sum, d) => sum + (d.stressLevel || 0.5), 0) / bucket.length;
      const avgAttention = bucket.reduce((sum, d) => sum + (d.attentionLevel || 0.5), 0) / bucket.length;
      
      // Calculate wellness score for this time bucket
      const heartRates = bucket.map(d => d.heartRate).filter(hr => hr !== null) as number[];
      const hrvValues = bucket.map(d => d.hrv).filter(hrv => hrv !== null) as number[];
      
      const avgHeartRate = heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : 70;
      const avgHrv = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : 35;

      const wellnessScore = this.calculateWellnessScore(
        avgHeartRate,
        avgHrv,
        this.calculateDistribution([avgStress], [0.3, 0.6]),
        this.calculateDistribution([avgAttention], [0.4, 0.7])
      );

      timeSeries.push({
        timestamp: avgTimestamp,
        wellnessScore,
        stressLevel: avgStress < 0.3 ? 'low' : avgStress < 0.6 ? 'medium' : 'high',
        attentionLevel: avgAttention < 0.4 ? 'low' : avgAttention < 0.7 ? 'medium' : 'high'
      });
    }

    return timeSeries;
  }

  private calculateNumericStats(values: number[]): { min: number; max: number; avg: number; trend: 'increasing' | 'decreasing' | 'stable' } {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, trend: 'stable' };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate trend from first half vs second half
    const midPoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midPoint);
    const secondHalf = values.slice(midPoint);
    
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : avg;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : avg;
    
    const trendThreshold = avg * 0.05; // 5% change threshold
    const trend = secondAvg > firstAvg + trendThreshold ? 'increasing' : 
                  secondAvg < firstAvg - trendThreshold ? 'decreasing' : 'stable';

    return { min, max, avg: Math.round(avg * 100) / 100, trend };
  }

  private calculateDistribution(values: number[], thresholds: [number, number]): { low: number; medium: number; high: number } {
    if (values.length === 0) {
      return { low: 0, medium: 0, high: 0 };
    }

    const [lowThreshold, highThreshold] = thresholds;
    let low = 0, medium = 0, high = 0;

    values.forEach(value => {
      if (value < lowThreshold) low++;
      else if (value < highThreshold) medium++;
      else high++;
    });

    const total = values.length;
    return {
      low: Math.round((low / total) * 100),
      medium: Math.round((medium / total) * 100),
      high: Math.round((high / total) * 100)
    };
  }

  private calculateWellnessScore(avgHeartRate: number, avgHrv: number, stressDistribution: any, attentionDistribution: any): number {
    // Normalize heart rate (optimal range 60-80 bpm)
    const hrScore = avgHeartRate >= 60 && avgHeartRate <= 80 ? 100 : 
                   Math.max(0, 100 - Math.abs(avgHeartRate - 70) * 2);

    // Normalize HRV (higher is generally better, optimal range 30-50)
    const hrvScore = avgHrv >= 30 ? Math.min(100, (avgHrv / 50) * 100) : (avgHrv / 30) * 60;

    // Stress score (lower stress is better)
    const stressScore = (stressDistribution.low * 1.0 + stressDistribution.medium * 0.6 + stressDistribution.high * 0.2);

    // Attention score (higher attention is better)
    const attentionScore = (attentionDistribution.low * 0.3 + attentionDistribution.medium * 0.6 + attentionDistribution.high * 1.0);

    // Weighted composite score
    const compositeScore = (hrScore * 0.25) + (hrvScore * 0.25) + (stressScore * 0.25) + (attentionScore * 0.25);

    return Math.round(Math.max(0, Math.min(100, compositeScore)));
  }

  private generateRecommendations(wellnessScore: number, stressDistribution: any, attentionDistribution: any): string[] {
    const recommendations: string[] = [];

    if (wellnessScore < 50) {
      recommendations.push("Consider taking breaks to improve overall wellness");
    }

    if (stressDistribution.high > 40) {
      recommendations.push("High stress levels detected - try relaxation techniques");
    }

    if (attentionDistribution.low > 50) {
      recommendations.push("Attention levels could improve - ensure adequate rest");
    }

    if (wellnessScore >= 80) {
      recommendations.push("Excellent wellness indicators - keep up the good work");
    }

    if (recommendations.length === 0) {
      recommendations.push("Wellness levels are stable");
    }

    return recommendations;
  }

  private getEmptyStats(): AnonymizedBiometricStats {
    return {
      totalSamples: 0,
      timeRange: { start: Date.now(), end: Date.now() },
      aggregatedMetrics: {
        heartRate: { min: 0, max: 0, avg: 0, trend: 'stable' },
        hrv: { min: 0, max: 0, avg: 0, trend: 'stable' },
        stress: { low: 0, medium: 0, high: 0 },
        attention: { low: 0, medium: 0, high: 0 }
      },
      wellnessScore: 0,
      recommendations: ["No data available"]
    };
  }
}

export const anonymizationService = new AnonymizationService();