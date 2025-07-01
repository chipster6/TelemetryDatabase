import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle, XCircle, Database, Cloud, Server } from "lucide-react";

interface WeaviateStatus {
  connected: boolean;
  mode: 'weaviate' | 'fallback';
  version?: string;
  documentsCount: number;
  shardsCount: number;
  error?: string;
}

export function WeaviateStatus() {
  const { data: status, isLoading, error } = useQuery<WeaviateStatus>({
    queryKey: ['/api/weaviate/status'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Vector Database Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-400 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Checking connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !status) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Vector Database Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Connection Error</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (status.connected && status.mode === 'weaviate') return 'bg-green-500';
    if (status.mode === 'fallback') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusIcon = () => {
    if (status.connected && status.mode === 'weaviate') return <Cloud className="h-4 w-4" />;
    if (status.mode === 'fallback') return <Server className="h-4 w-4" />;
    return <XCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (status.connected && status.mode === 'weaviate') return 'Weaviate Cloud Connected';
    if (status.mode === 'fallback') return 'In-Memory Fallback';
    return 'Disconnected';
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Vector Database Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          <Badge variant={status.connected ? "default" : "secondary"}>
            {status.mode}
          </Badge>
        </div>

        {status.version && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Version:</span>
            <span className="font-mono">{status.version}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Documents:</span>
          <span className="font-mono">{status.documentsCount.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Shards:</span>
          <span className="font-mono">{status.shardsCount}</span>
        </div>

        {status.error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded border">
            {status.error}
          </div>
        )}

        {status.mode === 'fallback' && (
          <div className="text-xs text-yellow-700 bg-yellow-50 dark:bg-yellow-950 p-2 rounded border">
            Using local storage. Configure WEAVIATE_URL and WEAVIATE_API_KEY for cloud sync.
          </div>
        )}
      </CardContent>
    </Card>
  );
}