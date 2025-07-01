import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PerformanceMetrics {
  totalSessions: number;
  averageResponseTime: number;
  cognitiveLoadTrends: number[];
  biometricStability: number;
  aiAdaptationEffectiveness: number;
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<{ metrics: PerformanceMetrics }>({
    queryKey: ['/api/analytics/performance'],
  });

  useEffect(() => {
    document.title = "📊 Analytics - AI Platform v3.0";
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
              <div className="flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
                Real-time Analytics
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Performance Metrics */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <i className="fas fa-chart-line h-4 w-4 text-muted-foreground"></i>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : analytics?.metrics.totalSessions || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active AI interactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                  <i className="fas fa-clock h-4 w-4 text-muted-foreground"></i>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : `${analytics?.metrics.averageResponseTime || 0}ms`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average AI response
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Biometric Stability</CardTitle>
                  <i className="fas fa-heartbeat h-4 w-4 text-muted-foreground"></i>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : `${Math.round((analytics?.metrics.biometricStability || 0) * 100)}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Physiological consistency
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AI Adaptation</CardTitle>
                  <i className="fas fa-brain h-4 w-4 text-muted-foreground"></i>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : `${Math.round((analytics?.metrics.aiAdaptationEffectiveness || 0) * 100)}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Learning effectiveness
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cognitive Load Trends</CardTitle>
                  <CardDescription>
                    Analysis of cognitive complexity patterns over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <i className="fas fa-chart-area text-gray-400 text-3xl mb-2"></i>
                      <p className="text-gray-500">Cognitive load visualization</p>
                      <p className="text-sm text-gray-400">
                        {analytics?.metrics.cognitiveLoadTrends?.length || 0} data points collected
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vector Database Performance</CardTitle>
                  <CardDescription>
                    Semantic search and storage analytics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Documents Stored</span>
                      <span className="text-sm text-gray-600">Active vector embeddings</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Encryption Status</span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-green-600">Post-Quantum Secure</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Daily Compression</span>
                      <span className="text-sm text-gray-600">2:00 AM UTC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Cloud Backup</span>
                      <span className="text-sm text-gray-600">Weaviate Cloud</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}