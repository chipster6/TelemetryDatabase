import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Brain, TrendingUp, MessageSquare, BookOpen, Zap, Network, Users } from "lucide-react";

interface WeaviateStorageStatus {
  initialized: boolean;
  mode: string;
  conversations: number;
  memories: number;
  patterns: number;
  knowledge: number;
  totalStorage: number;
  lastUpdated: string;
  error?: string;
}

export function WeaviatePrimaryStatus() {
  const [status, setStatus] = useState<WeaviateStorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);

  useEffect(() => {
    fetchStorageStatus();
    const interval = setInterval(fetchStorageStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStorageStatus = async () => {
    try {
      const response = await fetch('/api/weaviate/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch Weaviate storage status:', error);
      setStatus({ 
        initialized: false, 
        mode: 'unknown',
        conversations: 0, 
        memories: 0, 
        patterns: 0, 
        knowledge: 0,
        totalStorage: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Connection failed' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLearnPatterns = async () => {
    setLearning(true);
    try {
      const response = await fetch('/api/weaviate/learn-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (result.success) {
        setTimeout(fetchStorageStatus, 2000); // Refresh after learning
      }
    } catch (error) {
      console.error('Failed to initiate learning:', error);
    } finally {
      setLearning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Weaviate LLM Backbone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading storage status...</div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Weaviate LLM Backbone
          <Badge variant={status.initialized ? "default" : "destructive"}>
            {status.initialized ? "Primary Storage" : "Offline"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Infinite memory and context for biometric-aware AI conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Error: {status.error}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span>Conversations</span>
            <Badge variant="secondary">{(status.conversations || 0).toLocaleString()}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-green-500" />
            <span>Memories</span>
            <Badge variant="secondary">{(status.memories || 0).toLocaleString()}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <span>Patterns</span>
            <Badge variant="secondary">{(status.patterns || 0).toLocaleString()}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-orange-500" />
            <span>Schema</span>
            <Badge variant="secondary">{(status as any).schema?.nexisClasses || 0}</Badge>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Brain className="h-3 w-3" />
              Total: {((status.conversations || 0) + (status.memories || 0) + (status.patterns || 0)).toLocaleString()} objects
            </div>
            <div className="text-xs text-gray-400">
              {new Date(status.lastUpdated).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {status.initialized && (
          <>
            <div className="space-y-2">
              <Button 
                onClick={handleLearnPatterns}
                disabled={learning}
                size="sm"
                className="w-full"
              >
                {learning ? (
                  <>
                    <Zap className="h-3 w-3 mr-2 animate-spin" />
                    Learning Patterns...
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-2" />
                    Learn from Conversations
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
              <strong>LLM Capabilities:</strong> Infinite context window, semantic memory retrieval, 
              biometric pattern recognition, personalized response strategies, knowledge graph connections
            </div>
          </>
        )}

        {status.mode === 'primary_storage' && (
          <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
            <strong>Architecture:</strong> Weaviate is the primary data store with PostgreSQL handling 
            only authentication. All conversations, memories, and patterns stored here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}