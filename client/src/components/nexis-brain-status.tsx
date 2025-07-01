import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Database, TrendingUp, MessageSquare, BookOpen, Zap } from "lucide-react";

interface NexisStatus {
  initialized: boolean;
  conversations: number;
  memories: number;
  patterns: number;
  templates: number;
  lastUpdated: string;
  error?: string;
}

export function NexisBrainStatus() {
  const [status, setStatus] = useState<NexisStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNexisStatus();
    const interval = setInterval(fetchNexisStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchNexisStatus = async () => {
    try {
      const response = await fetch('/api/nexis/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch Nexis status:', error);
      setStatus({ 
        initialized: false, 
        conversations: 0, 
        memories: 0, 
        patterns: 0, 
        templates: 0, 
        lastUpdated: new Date().toISOString(),
        error: 'Connection failed' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Nexis Brain Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Nexis Brain Status
          <Badge variant={status.initialized ? "default" : "destructive"}>
            {status.initialized ? "Active" : "Offline"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Biometric-aware AI conversation system with contextual memory
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Error: {status.error}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Conversations</span>
            <Badge variant="secondary">{status.conversations}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-green-500" />
            <span className="text-sm">Memories</span>
            <Badge variant="secondary">{status.memories}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <span className="text-sm">Patterns</span>
            <Badge variant="secondary">{status.patterns}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className="text-sm">Templates</span>
            <Badge variant="secondary">{status.templates}</Badge>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Database className="h-3 w-3" />
            Last updated: {new Date(status.lastUpdated).toLocaleTimeString()}
          </div>
        </div>

        {status.initialized && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            <strong>Capabilities:</strong> Contextual memory, biometric pattern recognition, 
            dynamic prompt generation, conversation effectiveness tracking
          </div>
        )}
      </CardContent>
    </Card>
  );
}