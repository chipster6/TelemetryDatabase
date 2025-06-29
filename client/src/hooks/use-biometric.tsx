import { useState, useCallback } from 'react';

interface BiometricData {
  id?: number;
  heartRate?: number | null;
  hrv?: number | null;
  stressLevel?: number | null;
  attentionLevel?: number | null;
  cognitiveLoad?: number | null;
  skinTemperature?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  environmentalData?: {
    soundLevel?: number;
    temperature?: number;
    lightLevel?: number;
    humidity?: number;
  } | null;
  deviceSource?: string;
  timestamp?: string;
}

export function useBiometric() {
  const [currentBiometrics, setCurrentBiometrics] = useState<BiometricData | null>(null);
  const [biometricHistory, setBiometricHistory] = useState<BiometricData[]>([]);

  const updateBiometrics = useCallback((newData: BiometricData) => {
    setCurrentBiometrics(newData);
    setBiometricHistory(prev => [newData, ...prev.slice(0, 99)]); // Keep last 100 readings
  }, []);

  const getBiometricContext = useCallback(() => {
    if (!currentBiometrics) return null;

    return {
      heartRate: currentBiometrics.heartRate,
      hrv: currentBiometrics.hrv,
      stressLevel: currentBiometrics.stressLevel,
      attentionLevel: currentBiometrics.attentionLevel,
      cognitiveLoad: currentBiometrics.cognitiveLoad,
      environmentalFactors: currentBiometrics.environmentalData,
    };
  }, [currentBiometrics]);

  const getCognitiveState = useCallback(() => {
    if (!currentBiometrics) return null;

    const attention = currentBiometrics.attentionLevel || 50;
    const stress = currentBiometrics.stressLevel || 50;
    const cognitiveLoad = currentBiometrics.cognitiveLoad || 50;

    // Calculate overall cognitive performance score
    const cognitiveScore = (attention + (100 - stress) + (100 - cognitiveLoad)) / 3;

    return {
      score: Math.round(cognitiveScore),
      attention: Math.round(attention),
      stress: Math.round(stress),
      cognitiveLoad: Math.round(cognitiveLoad),
      isOptimal: cognitiveScore >= 80,
      isGood: cognitiveScore >= 60,
      needsRest: cognitiveScore < 40,
    };
  }, [currentBiometrics]);

  return {
    currentBiometrics,
    biometricHistory,
    updateBiometrics,
    getBiometricContext,
    getCognitiveState,
  };
}
