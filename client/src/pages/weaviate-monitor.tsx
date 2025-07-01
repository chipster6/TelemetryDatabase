import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  Activity, 
  TrendingUp, 
  Search, 
  Clock, 
  HardDrive, 
  Zap,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Layers,
  Brain,
  BarChart3,
  Network
} from "lucide-react";

interface WeaviateStats {
  initialized: boolean;
  healthStatus: string;
  conversations: number;
  memories: number;
  patterns: number;
  schema: {
    totalClasses: number;
    nexisClasses: number;
    totalProperties: number;
  };
  performance: {
    averageQueryTime: number;
    queriesPerSecond: number;
    errorRate: number;
  };
  storage: {
    totalObjects: number;
    storageUsed: string;
    compressionRatio: number;
  };
}

interface ExportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  recordsExported: number;
  outputFiles: string[];
  stats: {
    averageEffectiveness: number;
    breakthroughCount: number;
    totalDataSize: number;
  };
}

export default function WeaviateMonitor() {
  const [stats, setStats] = useState<WeaviateStats | null>(null);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchWeaviateStats();
    fetchExportJobs();
    
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchWeaviateStats();
        fetchExportJobs();
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchWeaviateStats = async () => {
    try {
      const response = await fetch('/api/weaviate/status');
      const data = await response.json();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch Weaviate stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExportJobs = async () => {
    try {
      const response = await fetch('/api/training-export/jobs');
      if (response.ok) {
        const jobs = await response.json();
        setExportJobs(jobs);
      }
    } catch (error) {
      console.error('Failed to fetch export jobs:', error);
    }
  };

  const startTrainingExport = async () => {
    try {
      const response = await fetch('/api/training-export/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minEffectiveness: 0.8,
          maxRecords: 1000,
          includeBreakthroughsOnly: false,
          groupByCognitiveState: true,
          outputFormat: 'jsonl',
          compressionEnabled: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Export job started:', result.jobId);
        fetchExportJobs();
      }
    } catch (error) {
      console.error('Failed to start export job:', error);
    }
  };

  const refreshStats = () => {
    setLoading(true);
    fetchWeaviateStats();
    fetchExportJobs();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weaviate Monitor</h1>
          <p className="text-gray-600 mt-1">
            Real-time monitoring of vector database performance and data quality
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            Last update: {lastUpdate.toLocaleTimeString()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Health Status</p>
                  <div className={`flex items-center gap-2 mt-1 px-2 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(stats.healthStatus)}`}>
                    {getHealthIcon(stats.healthStatus)}
                    {stats.healthStatus}
                  </div>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Objects</p>
                  <p className="text-2xl font-bold mt-1">
                    {(stats.conversations + stats.memories + stats.patterns).toLocaleString()}
                  </p>
                </div>
                <Layers className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Schema Classes</p>
                  <p className="text-2xl font-bold mt-1">{stats.schema?.nexisClasses || 0}</p>
                  <p className="text-xs text-gray-500">of {stats.schema?.totalClasses || 0} total</p>
                </div>
                <Network className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Initialized</p>
                  <div className={`flex items-center gap-2 mt-1 ${stats.initialized ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.initialized ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <span className="font-medium">{stats.initialized ? 'Ready' : 'Offline'}</span>
                  </div>
                </div>
                <Brain className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Monitoring */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="exports">Training Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Data Distribution
                </CardTitle>
                <CardDescription>
                  Distribution of objects across Weaviate classes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Conversations</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ 
                              width: `${(stats.conversations / (stats.conversations + stats.memories + stats.patterns)) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{stats.conversations}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Memories</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${(stats.memories / (stats.conversations + stats.memories + stats.patterns)) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{stats.memories}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Patterns</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full" 
                            style={{ 
                              width: `${(stats.patterns / (stats.conversations + stats.memories + stats.patterns)) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{stats.patterns}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schema Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Schema Details
                </CardTitle>
                <CardDescription>
                  Weaviate schema configuration and statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.schema && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Total Classes</span>
                      <span className="text-sm text-gray-600">{stats.schema.totalClasses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Nexis Classes</span>
                      <span className="text-sm text-gray-600">{stats.schema.nexisClasses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Total Properties</span>
                      <span className="text-sm text-gray-600">{stats.schema.totalProperties}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-xs text-gray-500">
                        Vectorizer: text2vec-transformers
                      </div>
                      <div className="text-xs text-gray-500">
                        Mode: Primary Storage
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Query Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {stats?.performance?.averageQueryTime || 0}ms
                  </div>
                  <div className="text-xs text-gray-500">Average query time</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {stats?.performance?.queriesPerSecond || 0}
                  </div>
                  <div className="text-xs text-gray-500">Queries per second</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-600">
                    {((stats?.performance?.errorRate || 0) * 100).toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">Error percentage</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Storage Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Objects</span>
                    <span className="text-sm text-gray-600">
                      {stats?.storage?.totalObjects?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Storage Used</span>
                    <span className="text-sm text-gray-600">
                      {stats?.storage?.storageUsed || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Compression</span>
                    <span className="text-sm text-gray-600">
                      {((stats?.storage?.compressionRatio || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Optimization Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Vector Compression</span>
                    <Badge variant="default" className="text-xs">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto Sharding</span>
                    <Badge variant="default" className="text-xs">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Backup Schedule</span>
                    <Badge variant="outline" className="text-xs">Weekly</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exports" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Training Data Exports</h3>
              <p className="text-sm text-gray-600">Export high-quality conversations for LLM training</p>
            </div>
            <Button onClick={startTrainingExport}>
              <Download className="h-4 w-4 mr-2" />
              Start Export
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {exportJobs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No export jobs found</p>
                </CardContent>
              </Card>
            ) : (
              exportJobs.map((job) => (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-medium">
                        Export Job {job.id.slice(0, 8)}
                      </CardTitle>
                      <Badge 
                        variant={
                          job.status === 'completed' ? 'default' :
                          job.status === 'failed' ? 'destructive' :
                          job.status === 'running' ? 'secondary' : 'outline'
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {job.status === 'running' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{job.progress}%</span>
                          </div>
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Records Exported:</span>
                          <div className="text-gray-600">{job.recordsExported}</div>
                        </div>
                        <div>
                          <span className="font-medium">Output Files:</span>
                          <div className="text-gray-600">{job.outputFiles.length}</div>
                        </div>
                      </div>

                      {job.status === 'completed' && job.stats && (
                        <div className="pt-2 border-t">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="font-medium">Avg Effectiveness:</span>
                              <div className="text-gray-600">
                                {(job.stats.averageEffectiveness * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Breakthroughs:</span>
                              <div className="text-gray-600">{job.stats.breakthroughCount}</div>
                            </div>
                            <div>
                              <span className="font-medium">Data Size:</span>
                              <div className="text-gray-600">
                                {(job.stats.totalDataSize / 1024 / 1024).toFixed(1)}MB
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}