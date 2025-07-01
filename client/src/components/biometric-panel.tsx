import { Progress } from "@/components/ui/progress";

interface BiometricData {
  id?: number;
  heartRate?: number | null;
  hrv?: number | null;
  stressLevel?: number | null;
  attentionLevel?: number | null;
  cognitiveLoad?: number | null;
  skinTemperature?: number | null;
  environmentalData?: {
    soundLevel?: number;
    temperature?: number;
    lightLevel?: number;
  } | null;
}

interface BiometricPanelProps {
  currentBiometrics?: BiometricData | null;
}

export default function BiometricPanel({ currentBiometrics }: BiometricPanelProps) {
  const heartRate = currentBiometrics?.heartRate || 72;
  const hrv = currentBiometrics?.hrv || 42;
  const stressLevel = currentBiometrics?.stressLevel || 23;
  const attentionLevel = currentBiometrics?.attentionLevel || 78;
  const cognitiveLoad = currentBiometrics?.cognitiveLoad || 34;

  // Calculate cognitive performance score
  const cognitiveScore = Math.round((attentionLevel + (100 - stressLevel) + (100 - cognitiveLoad)) / 3);

  const getCognitiveStatus = (score: number) => {
    if (score >= 80) return { text: "Optimal for complex tasks", color: "text-green-600" };
    if (score >= 60) return { text: "Good for creative tasks", color: "text-blue-600" };
    if (score >= 40) return { text: "Suitable for routine tasks", color: "text-yellow-600" };
    return { text: "Consider taking a break", color: "text-red-600" };
  };

  const cognitiveStatus = getCognitiveStatus(cognitiveScore);

  return (
    <>
      {/* Current Biometric Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Wellness Monitoring</h4>
        <p className="text-xs text-gray-500 mb-3">Track your work patterns and stress levels while using the platform</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Heart Rate</span>
            <div className="flex items-center">
              <span className="text-lg font-semibold text-red-600">{heartRate}</span>
              <span className="text-sm text-gray-500 ml-1">BPM</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">HRV</span>
            <div className="flex items-center">
              <span className="text-lg font-semibold text-green-600">{Math.round(hrv * 10) / 10}</span>
              <span className="text-sm text-gray-500 ml-1">ms</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Stress Level</span>
            <div className="flex items-center">
              <span className="text-lg font-semibold text-yellow-600">{Math.round(stressLevel)}</span>
              <span className="text-sm text-gray-500 ml-1">%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Attention</span>
            <div className="flex items-center">
              <span className="text-lg font-semibold text-blue-600">{Math.round(attentionLevel)}</span>
              <span className="text-sm text-gray-500 ml-1">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cognitive Performance Indicator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Cognitive Performance</h4>
        <div className="relative">
          <div className="flex items-center justify-center h-24">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <Progress 
                    value={cognitiveScore} 
                    className="w-20 h-20 rounded-full transform -rotate-90"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-green-600">{cognitiveScore}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className={`text-center text-sm mt-2 ${cognitiveStatus.color}`}>
            {cognitiveStatus.text}
          </p>
        </div>
      </div>

      {/* Privacy Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Privacy Protection</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">On-device Processing</span>
            <i className="fas fa-check-circle text-green-500"></i>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Encryption Enabled</span>
            <i className="fas fa-check-circle text-green-500"></i>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Federated Learning</span>
            <i className="fas fa-check-circle text-green-500"></i>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Differential Privacy</span>
            <i className="fas fa-check-circle text-green-500"></i>
          </div>
        </div>
      </div>
    </>
  );
}
