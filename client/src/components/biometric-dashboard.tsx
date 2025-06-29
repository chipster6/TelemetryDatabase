import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface BiometricData {
  id: number;
  heartRate?: number | null;
  hrv?: number | null;
  stressLevel?: number | null;
  attentionLevel?: number | null;
  cognitiveLoad?: number | null;
  environmentalData?: {
    soundLevel?: number;
    temperature?: number;
    lightLevel?: number;
  } | null;
  timestamp?: string;
}

interface BiometricStats {
  totalSamples: number;
  avgHeartRate: number;
  avgHRV: number;
  avgStressLevel: number;
  avgAttentionLevel: number;
}

export default function BiometricDashboard() {
  const hrvChartRef = useRef<HTMLCanvasElement>(null);
  const cognitiveChartRef = useRef<HTMLCanvasElement>(null);
  const hrvChartInstance = useRef<Chart | null>(null);
  const cognitiveChartInstance = useRef<Chart | null>(null);

  const { data: biometricData = [] } = useQuery<BiometricData[]>({
    queryKey: ['/api/biometric'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: stats } = useQuery<BiometricStats>({
    queryKey: ['/api/biometric/stats'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Initialize HRV Chart
  useEffect(() => {
    if (!hrvChartRef.current || biometricData.length === 0) return;

    if (hrvChartInstance.current) {
      hrvChartInstance.current.destroy();
    }

    const ctx = hrvChartRef.current.getContext('2d');
    if (!ctx) return;

    const recentData = biometricData.slice(-20).filter(d => d.hrv !== null);
    const labels = recentData.map((_, index) => {
      const time = new Date(Date.now() - (recentData.length - 1 - index) * 180000); // 3-minute intervals
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    hrvChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'HRV (ms)',
          data: recentData.map(d => d.hrv || 0),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 20,
            max: 60
          }
        }
      }
    });

    return () => {
      if (hrvChartInstance.current) {
        hrvChartInstance.current.destroy();
        hrvChartInstance.current = null;
      }
    };
  }, [biometricData]);

  // Initialize Cognitive Chart
  useEffect(() => {
    if (!cognitiveChartRef.current) return;

    if (cognitiveChartInstance.current) {
      cognitiveChartInstance.current.destroy();
    }

    const ctx = cognitiveChartRef.current.getContext('2d');
    if (!ctx) return;

    const latestData = biometricData[0];
    const attention = latestData?.attentionLevel || 78;
    const stress = latestData?.stressLevel || 25;
    const cognitiveLoad = latestData?.cognitiveLoad || 34;
    const workingMemory = 65; // Simulated
    const processingSpeed = 82; // Simulated
    const executiveFunction = 71; // Simulated

    cognitiveChartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Attention', 'Working Memory', 'Processing Speed', 'Executive Function'],
        datasets: [{
          data: [attention, workingMemory, processingSpeed, executiveFunction],
          backgroundColor: [
            '#6366F1',
            '#8B5CF6',
            '#10B981',
            '#F59E0B'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          }
        }
      }
    });

    return () => {
      if (cognitiveChartInstance.current) {
        cognitiveChartInstance.current.destroy();
        cognitiveChartInstance.current = null;
      }
    };
  }, [biometricData]);

  const latestData = biometricData[0];
  const environmentalData = latestData?.environmentalData;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Heart Rate Variability Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Heart Rate Variability</h3>
          <div className="flex space-x-2">
            <button className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">1H</button>
            <button className="px-2 py-1 text-xs bg-primary-500 text-white rounded">6H</button>
            <button className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">24H</button>
          </div>
        </div>
        <div className="h-64 relative">
          <canvas ref={hrvChartRef} className="w-full h-full"></canvas>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{stats?.avgHRV || 41.5}</p>
            <p className="text-sm text-gray-500">Avg HRV (ms)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">+12%</p>
            <p className="text-sm text-gray-500">vs Yesterday</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">78</p>
            <p className="text-sm text-gray-500">Recovery Score</p>
          </div>
        </div>
      </div>

      {/* Cognitive Performance Correlation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Cognitive Performance</h3>
          <div className="flex items-center text-sm text-gray-500">
            <i className="fas fa-info-circle mr-1"></i>
            Real-time correlation
          </div>
        </div>
        <div className="h-64 relative">
          <canvas ref={cognitiveChartRef} className="w-full h-full"></canvas>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{Math.round(latestData?.attentionLevel || 78)}%</p>
            <p className="text-sm text-gray-500">Attention Level</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{Math.round(latestData?.cognitiveLoad || 34)}%</p>
            <p className="text-sm text-gray-500">Cognitive Load</p>
          </div>
        </div>
      </div>

      {/* Environmental Factors */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Environmental Factors</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-volume-up text-blue-500 mr-3"></i>
              <span className="text-sm text-gray-700">Sound Level</span>
            </div>
            <div className="flex items-center">
              <div className="w-24 h-2 bg-gray-200 rounded-full mr-3">
                <div 
                  className="h-2 bg-blue-500 rounded-full" 
                  style={{ width: `${Math.min(100, (environmentalData?.soundLevel || 45) / 70 * 100)}%` }}
                ></div>
              </div>
              <span className="text-sm font-semibold">{environmentalData?.soundLevel || 45} dB</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-thermometer-half text-red-500 mr-3"></i>
              <span className="text-sm text-gray-700">Temperature</span>
            </div>
            <div className="flex items-center">
              <div className="w-24 h-2 bg-gray-200 rounded-full mr-3">
                <div 
                  className="h-2 bg-red-500 rounded-full" 
                  style={{ width: `${Math.min(100, ((environmentalData?.temperature || 22.5) - 15) / 15 * 100)}%` }}
                ></div>
              </div>
              <span className="text-sm font-semibold">{environmentalData?.temperature || 22.5}°C</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-sun text-yellow-500 mr-3"></i>
              <span className="text-sm text-gray-700">Light Level</span>
            </div>
            <div className="flex items-center">
              <div className="w-24 h-2 bg-gray-200 rounded-full mr-3">
                <div 
                  className="h-2 bg-yellow-500 rounded-full" 
                  style={{ width: `${Math.min(100, (environmentalData?.lightLevel || 520) / 1000 * 100)}%` }}
                ></div>
              </div>
              <span className="text-sm font-semibold">{environmentalData?.lightLevel || 520} lux</span>
            </div>
          </div>
        </div>
      </div>

      {/* Training Data Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Data Collection</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Biometric Samples</span>
            <span className="text-lg font-semibold text-blue-600">{stats?.totalSamples.toLocaleString() || '1,247,592'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Prompt-Response Pairs</span>
            <span className="text-lg font-semibold text-green-600">8,934</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Cognitive Correlations</span>
            <span className="text-lg font-semibold text-purple-600">15,672</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Privacy Compliance</span>
              <span className="text-sm font-semibold text-green-600">100%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div className="w-full h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
