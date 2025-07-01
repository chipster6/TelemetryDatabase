import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    timestamp: number;
    userId?: number;
    contentType: string;
    cognitiveComplexity?: number;
  };
  score?: number;
}

export default function TrainingData() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VectorDocument[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    document.title = "🗄️ Training Data - AI Platform v3.0";
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch('/api/vector/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          options: { limit: 10 }
        })
      });
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStoreData = async () => {
    try {
      const sampleData = {
        id: `training-${Date.now()}`,
        content: "Sample training data for AI prompt optimization based on cognitive load patterns",
        metadata: {
          timestamp: Date.now(),
          userId: 1,
          contentType: "training",
          cognitiveComplexity: 65
        }
      };

      const response = await fetch('/api/vector/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleData)
      });
      
      if (response.ok) {
        console.log('Training data stored successfully');
      }
    } catch (error) {
      console.error('Failed to store training data:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'biometric': return 'bg-blue-100 text-blue-800';
      case 'prompt': return 'bg-green-100 text-green-800';
      case 'response': return 'bg-purple-100 text-purple-800';
      case 'training': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Training Data & Vector Storage</h2>
              <div className="flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse"></div>
                Vector Database
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            {/* Search Interface */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Semantic Search</CardTitle>
                <CardDescription>
                  Search through stored vector embeddings with natural language queries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4">
                  <Input
                    placeholder="Search training data, biometrics, prompts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? (
                      <i className="fas fa-spinner animate-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-search mr-2"></i>
                    )}
                    Search
                  </Button>
                  <Button variant="outline" onClick={handleStoreData}>
                    <i className="fas fa-plus mr-2"></i>
                    Add Sample
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    Found {searchResults.length} relevant documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {searchResults.map((doc, index) => (
                      <div key={doc.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge className={getContentTypeColor(doc.metadata.contentType)}>
                              {doc.metadata.contentType}
                            </Badge>
                            {doc.score && (
                              <Badge variant="outline">
                                {Math.round(doc.score)}% match
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(doc.metadata.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{doc.content}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>ID: {doc.id}</span>
                          {doc.metadata.cognitiveComplexity && (
                            <span>Complexity: {doc.metadata.cognitiveComplexity}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vector Database Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Storage Overview</CardTitle>
                  <CardDescription>
                    Vector database performance and capacity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Encryption</span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-green-600">Post-Quantum Secure</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Sharding</span>
                      <span className="text-sm text-gray-600">Auto-rotation at 10k docs</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Compression</span>
                      <span className="text-sm text-gray-600">Daily at 2:00 AM UTC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Cloud Backup</span>
                      <span className="text-sm text-gray-600">Weaviate Cloud</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Types</CardTitle>
                  <CardDescription>
                    Categories of stored vector embeddings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                        <span className="text-sm">Biometric Data</span>
                      </div>
                      <span className="text-xs text-gray-500">Physiological readings</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">Prompt Templates</span>
                      </div>
                      <span className="text-xs text-gray-500">AI interaction patterns</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="text-sm">AI Responses</span>
                      </div>
                      <span className="text-xs text-gray-500">Generated content</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                        <span className="text-sm">Training Data</span>
                      </div>
                      <span className="text-xs text-gray-500">Learning patterns</span>
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