import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Zap, MessageSquare, TrendingUp, Clock, Target } from "lucide-react";
import { useBiometric } from "@/hooks/use-biometric";

interface RAGResponse {
  content: string;
  confidence: number;
  strategy: string;
  contextUsed: {
    conversationCount: number;
    memoryCount: number;
    patternCount: number;
  };
  adaptations: string[];
  followUpSuggestions?: string[];
  biometricConsiderations: string[];
}

export default function RAGInterface() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentBiometrics } = useBiometric();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/rag/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          biometrics: currentBiometrics,
          intent: 'general',
          complexity: 'medium'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const ragResponse = await response.json();
      setResponse(ragResponse);
      
      // Store the conversation in Weaviate
      await storeConversation(query, ragResponse);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const storeConversation = async (userMessage: string, ragResponse: RAGResponse) => {
    try {
      await fetch('/api/weaviate/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          aiResponse: ragResponse.content,
          conversationType: 'rag_interaction',
          effectivenessScore: ragResponse.confidence,
          responseStrategy: ragResponse.strategy,
          biometricState: currentBiometrics,
          neurodivergentMarkers: {
            hyperfocusState: currentBiometrics.flowState > 0.8,
            contextSwitches: 0,
            sensoryLoad: currentBiometrics.arousal || 0.5,
            executiveFunction: Math.max(0, 1 - currentBiometrics.stressLevel),
            workingMemoryLoad: currentBiometrics.cognitiveLoad,
            attentionRegulation: currentBiometrics.attentionLevel
          },
          environmentalContext: {
            timeOfDay: getTimeOfDay(),
            dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
            location: 'web_interface',
            soundLevel: 50,
            lightLevel: 300,
            temperature: 22,
            humidity: 50,
            airQuality: 80
          },
          learningMarkers: {
            isBreakthrough: ragResponse.confidence > 0.9,
            cognitiveBreakthrough: currentBiometrics.flowState > 0.8,
            difficultyLevel: Math.ceil(query.length / 50),
            userSatisfaction: ragResponse.confidence,
            learningGoals: ['ai_interaction'],
            skillAreas: ['communication'],
            knowledgeDomains: ['general'],
            adaptationNeeded: ragResponse.adaptations.length > 0,
            followUpRequired: (ragResponse.followUpSuggestions?.length || 0) > 0
          }
        }),
      });
    } catch (error) {
      console.warn('Failed to store conversation:', error);
    }
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            RAG-Powered AI Assistant
          </CardTitle>
          <CardDescription>
            Ask anything and get contextually intelligent responses powered by infinite memory and biometric awareness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Ask me anything... I'll use my infinite memory and your current state to provide the best possible response."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              className="resize-none"
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Target className="h-3 w-3" />
                <span>Cognitive Load: {(currentBiometrics.cognitiveLoad * 100).toFixed(0)}%</span>
                <span>•</span>
                <span>Flow State: {(currentBiometrics.flowState * 100).toFixed(0)}%</span>
              </div>
              
              <Button type="submit" disabled={loading || !query.trim()}>
                {loading ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Response
                  </>
                )}
              </Button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              Error: {error}
            </div>
          )}
        </CardContent>
      </Card>

      {response && (
        <div className="space-y-4">
          {/* Response Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  AI Response
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{response.strategy}</Badge>
                  <Badge variant={response.confidence > 0.8 ? "default" : response.confidence > 0.6 ? "secondary" : "outline"}>
                    {(response.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap">{response.content}</p>
              </div>
            </CardContent>
          </Card>

          {/* Context Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Context & Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Context Usage */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{response.contextUsed.conversationCount}</div>
                  <div className="text-gray-600">Conversations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{response.contextUsed.memoryCount}</div>
                  <div className="text-gray-600">Memories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{response.contextUsed.patternCount}</div>
                  <div className="text-gray-600">Patterns</div>
                </div>
              </div>

              {/* Confidence Visualization */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Response Confidence</span>
                  <span>{(response.confidence * 100).toFixed(0)}%</span>
                </div>
                <Progress value={response.confidence * 100} className="h-2" />
              </div>

              {/* Biometric Considerations */}
              {response.biometricConsiderations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Biometric Adaptations:</div>
                  <div className="flex flex-wrap gap-1">
                    {response.biometricConsiderations.map((consideration, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {consideration.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Adaptations */}
              {response.adaptations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Applied Adaptations:</div>
                  <div className="flex flex-wrap gap-1">
                    {response.adaptations.map((adaptation, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {adaptation.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Follow-up Suggestions */}
          {response.followUpSuggestions && response.followUpSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Follow-up Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {response.followUpSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 px-3"
                      onClick={() => setQuery(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}