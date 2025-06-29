export interface SimulatedBiometricData {
  heartRate: number;
  hrv: number;
  stressLevel: number;
  attentionLevel: number;
  cognitiveLoad: number;
  skinTemperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  environmentalData: {
    soundLevel: number;
    temperature: number;
    lightLevel: number;
    humidity: number;
  };
}

export class BiometricSimulator {
  private baseHeartRate: number = 70;
  private baseHRV: number = 40;
  private circadianPhase: number = 0;
  private stressModifier: number = 1;
  private activityLevel: number = 0.5; // 0 = resting, 1 = high activity

  constructor() {
    // Initialize with current time-based circadian rhythm
    const hour = new Date().getHours();
    this.circadianPhase = (hour / 24) * 2 * Math.PI;
  }

  /**
   * Generate realistic biometric data based on circadian rhythms and various factors
   */
  generateRealisticData(): SimulatedBiometricData {
    const currentTime = Date.now();
    const hour = new Date().getHours();
    
    // Update circadian phase
    this.circadianPhase = (hour / 24) * 2 * Math.PI;
    
    // Generate heart rate with circadian variation
    const circadianHRVariation = Math.sin(this.circadianPhase) * 8;
    const randomVariation = (Math.random() - 0.5) * 10;
    const stressImpact = this.stressModifier * 15;
    const heartRate = Math.round(
      this.baseHeartRate + circadianHRVariation + randomVariation + stressImpact
    );

    // Generate HRV (inversely related to stress and heart rate)
    const circadianHRVVariation = Math.cos(this.circadianPhase) * 10;
    const stressHRVImpact = -this.stressModifier * 15;
    const hrv = Math.max(
      20, 
      this.baseHRV + circadianHRVVariation + stressHRVImpact + (Math.random() - 0.5) * 15
    );

    // Calculate stress level based on HRV and environmental factors
    const normalizedHRV = Math.max(0, Math.min(1, hrv / 50));
    const baseStress = (1 - normalizedHRV) * 50;
    const environmentalStress = this.calculateEnvironmentalStress();
    const stressLevel = Math.max(0, Math.min(100, baseStress + environmentalStress));

    // Calculate attention level based on HRV, stress, and circadian rhythm
    const circadianAttention = this.getCircadianAttentionFactor(hour);
    const hrvAttentionBonus = normalizedHRV * 30;
    const stressAttentionPenalty = (stressLevel / 100) * 25;
    const attentionLevel = Math.max(
      0, 
      Math.min(100, circadianAttention + hrvAttentionBonus - stressAttentionPenalty + (Math.random() - 0.5) * 20)
    );

    // Calculate cognitive load
    const cognitiveLoad = this.calculateCognitiveLoad(stressLevel, attentionLevel);

    // Generate physiological measurements
    const skinTemperature = this.generateSkinTemperature();
    const respiratoryRate = this.generateRespiratoryRate(stressLevel);
    const oxygenSaturation = this.generateOxygenSaturation();

    // Generate environmental data
    const environmentalData = this.generateEnvironmentalData();

    return {
      heartRate: Math.max(40, Math.min(200, heartRate)),
      hrv: Math.round(hrv * 10) / 10,
      stressLevel: Math.round(stressLevel),
      attentionLevel: Math.round(attentionLevel),
      cognitiveLoad: Math.round(cognitiveLoad),
      skinTemperature: Math.round(skinTemperature * 10) / 10,
      respiratoryRate: Math.round(respiratoryRate * 10) / 10,
      oxygenSaturation: Math.round(oxygenSaturation * 10) / 10,
      environmentalData
    };
  }

  private getCircadianAttentionFactor(hour: number): number {
    // Model natural circadian attention patterns
    if (hour >= 9 && hour <= 11) return 85; // Morning peak
    if (hour >= 14 && hour <= 16) return 75; // Afternoon peak
    if (hour >= 22 || hour <= 6) return 30; // Night/early morning low
    if (hour >= 13 && hour <= 15) return 50; // Post-lunch dip
    return 65; // Default moderate attention
  }

  private calculateEnvironmentalStress(): number {
    // Simulate environmental stressors
    const soundStress = Math.max(0, (Math.random() * 70 - 50) / 20 * 15);
    const temperatureStress = Math.abs(22 - (18 + Math.random() * 8)) / 4 * 10;
    return soundStress + temperatureStress;
  }

  private calculateCognitiveLoad(stressLevel: number, attentionLevel: number): number {
    // Cognitive load increases with stress and decreases with attention
    const stressFactor = stressLevel / 100 * 40;
    const attentionFactor = (100 - attentionLevel) / 100 * 30;
    const randomFactor = Math.random() * 20;
    return Math.max(0, Math.min(100, stressFactor + attentionFactor + randomFactor));
  }

  private generateSkinTemperature(): number {
    const baseTemp = 36.5;
    const circadianVariation = Math.sin(this.circadianPhase + Math.PI) * 0.6;
    const randomVariation = (Math.random() - 0.5) * 0.4;
    const stressVariation = this.stressModifier * 0.3;
    return baseTemp + circadianVariation + randomVariation + stressVariation;
  }

  private generateRespiratoryRate(stressLevel: number): number {
    const baseRate = 14;
    const stressImpact = (stressLevel / 100) * 6;
    const randomVariation = (Math.random() - 0.5) * 4;
    return Math.max(8, Math.min(25, baseRate + stressImpact + randomVariation));
  }

  private generateOxygenSaturation(): number {
    const baseO2 = 98;
    const randomVariation = (Math.random() - 0.5) * 3;
    const activityImpact = this.activityLevel * -1;
    return Math.max(94, Math.min(100, baseO2 + randomVariation + activityImpact));
  }

  private generateEnvironmentalData() {
    const hour = new Date().getHours();
    
    // Sound level varies by time of day
    let baseSoundLevel = 35;
    if (hour >= 7 && hour <= 9) baseSoundLevel = 55; // Morning commute
    if (hour >= 12 && hour <= 14) baseSoundLevel = 50; // Lunch time
    if (hour >= 17 && hour <= 19) baseSoundLevel = 60; // Evening commute
    if (hour >= 22 || hour <= 6) baseSoundLevel = 25; // Night quiet
    
    // Light level based on time of day
    let lightLevel = 0;
    if (hour >= 6 && hour <= 18) {
      const solarAngle = Math.sin((hour - 6) / 12 * Math.PI);
      lightLevel = Math.max(0, solarAngle * 1000 + Math.random() * 200);
    } else {
      lightLevel = Math.random() * 100; // Artificial lighting
    }

    return {
      soundLevel: Math.round(baseSoundLevel + (Math.random() - 0.5) * 20),
      temperature: Math.round((20 + Math.random() * 6) * 10) / 10,
      lightLevel: Math.round(lightLevel),
      humidity: Math.round(40 + Math.random() * 30)
    };
  }

  /**
   * Simulate stress events that affect biometric readings
   */
  induceStressEvent(intensity: number = 0.5, duration: number = 30000): void {
    this.stressModifier = 1 + intensity;
    setTimeout(() => {
      this.stressModifier = Math.max(1, this.stressModifier - 0.1);
    }, duration);
  }

  /**
   * Simulate activity changes
   */
  setActivityLevel(level: number): void {
    this.activityLevel = Math.max(0, Math.min(1, level));
  }

  /**
   * Get current stress modifier for external monitoring
   */
  getCurrentStressLevel(): number {
    return this.stressModifier;
  }
}

export const biometricSimulator = new BiometricSimulator();
