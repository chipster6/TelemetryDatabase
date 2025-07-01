import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface AnonymizedBiometricStats {
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
      low: number;
      medium: number;
      high: number;
    };
    attention: {
      low: number;
      medium: number;
      high: number;
    };
  };
  wellnessScore: number;
  recommendations: string[];
}

interface AnonymizedTimeSeriesPoint {
  timestamp: number;
  wellnessScore: number;
  stressLevel: 'low' | 'medium' | 'high';
  attentionLevel: 'low' | 'medium' | 'high';
}

export default function BiometricDashboard() {
  const wellnessChartRef = useRef<HTMLCanvasElement>(null);
  const distributionChartRef = useRef<HTMLCanvasElement>(null);
  const wellnessChartInstance = useRef<Chart | null>(null);
  const distributionChartInstance = useRef<Chart | null>(null);

  const { data: biometricStats } = useQuery<AnonymizedBiometricStats>({
    queryKey: ['/api/biometric'],
    refetchInterval: 5000,
  });

  const { data: timeSeriesData = [] } = useQuery<AnonymizedTimeSeriesPoint[]>({
    queryKey: ['/api/biometric/timeseries'],
    refetchInterval: 5000,
  });

  // Initialize Wellness Score Chart
  useEffect(() => {
    if (!wellnessChartRef.current || timeSeriesData.length === 0) return;

    if (wellnessChartInstance.current) {
      wellnessChartInstance.current.destroy();
    }

    const ctx = wellnessChartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = timeSeriesData.map(point => {
      const time = new Date(point.timestamp);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    wellnessChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Wellness Score',
          data: timeSeriesData.map(point => point.wellnessScore),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#9ca3af' }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#9ca3af' }
          }
        }
      }
    });
  }, [timeSeriesData]);

  // Initialize Distribution Chart
  useEffect(() => {
    if (!distributionChartRef.current || !biometricStats) return;

    if (distributionChartInstance.current) {
      distributionChartInstance.current.destroy();
    }

    const ctx = distributionChartRef.current.getContext('2d');
    if (!ctx) return;

    distributionChartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Low Stress', 'Medium Stress', 'High Stress'],
        datasets: [{
          data: [
            biometricStats.aggregatedMetrics.stress.low,
            biometricStats.aggregatedMetrics.stress.medium,
            biometricStats.aggregatedMetrics.stress.high
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af' }
          }
        }
      }
    });
  }, [biometricStats]);

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing': return '↗️';
      case 'decreasing': return '↘️';
      case 'stable': return '→';
    }
  };

  const getWellnessColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!biometricStats) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-700 rounded-lg"></div>
            <div className="h-64 bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Wellness Overview</h2>
        <div className={`text-3xl font-bold ${getWellnessColor(biometricStats.wellnessScore)}`}>
          {biometricStats.wellnessScore}/100
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">Heart Rate</div>
          <div className="text-xl font-semibold text-white flex items-center gap-2">
            {biometricStats.aggregatedMetrics.heartRate.avg} bpm
            <span className="text-sm">{getTrendIcon(biometricStats.aggregatedMetrics.heartRate.trend)}</span>
          </div>
          <div className="text-xs text-gray-500">
            Range: {biometricStats.aggregatedMetrics.heartRate.min}-{biometricStats.aggregatedMetrics.heartRate.max}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">HRV</div>
          <div className="text-xl font-semibold text-white flex items-center gap-2">
            {biometricStats.aggregatedMetrics.hrv.avg} ms
            <span className="text-sm">{getTrendIcon(biometricStats.aggregatedMetrics.hrv.trend)}</span>
          </div>
          <div className="text-xs text-gray-500">
            Range: {biometricStats.aggregatedMetrics.hrv.min}-{biometricStats.aggregatedMetrics.hrv.max}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">High Attention</div>
          <div className="text-xl font-semibold text-green-400">
            {biometricStats.aggregatedMetrics.attention.high}%
          </div>
          <div className="text-xs text-gray-500">of readings</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">Total Samples</div>
          <div className="text-xl font-semibold text-white">
            {biometricStats.totalSamples}
          </div>
          <div className="text-xs text-gray-500">data points</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Wellness Score Trend</h3>
          <div className="h-64">
            <canvas ref={wellnessChartRef}></canvas>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Stress Distribution</h3>
          <div className="h-64">
            <canvas ref={distributionChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Recommendations</h3>
        <div className="space-y-2">
          {biometricStats.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{recommendation}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}