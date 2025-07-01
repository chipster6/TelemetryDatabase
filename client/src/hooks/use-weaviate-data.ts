import { useQuery } from "@tanstack/react-query";

export interface WeaviateConversation {
  conversationId: string;
  userId: number;
  userMessage: string;
  aiResponse: string;
  effectivenessScore: number;
  heartRate?: number;
  hrv?: number;
  stressLevel?: number;
  attentionLevel?: number;
  cognitiveLoad?: number;
  flowState?: number;
  timestamp: string;
  conversationType: string;
  responseStrategy: string;
}

export interface WeaviateTemplate {
  templateId: string;
  name: string;
  content: string;
  category: string;
  averageEffectiveness: number;
  usageCount: number;
  biometricOptimization: {
    cognitiveLoadRange: [number, number];
    stressLevelRange: [number, number];
    attentionRequirement: number;
    flowStateOptimal: number;
  };
  createdAt: string;
}

export interface WeaviateSearchResult {
  query: string;
  results: Array<{
    type: 'conversation' | 'memory' | 'pattern' | 'template';
    [key: string]: any;
  }>;
  total: number;
  searchType: string;
  source: string;
}

/**
 * Hook for fetching conversation history from Weaviate
 */
export function useWeaviateConversations(limit = 20) {
  return useQuery<WeaviateConversation[]>({
    queryKey: ['/api/weaviate/conversations', limit],
    queryFn: async () => {
      const response = await fetch(`/api/weaviate/conversations?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversations from Weaviate');
      }
      return response.json();
    },
  });
}

/**
 * Hook for searching across all Weaviate data with semantic similarity
 */
export function useWeaviateSearch(query: string, searchType = 'all', enabled = true) {
  return useQuery<WeaviateSearchResult>({
    queryKey: ['/api/vector/search', query, searchType],
    queryFn: async () => {
      const response = await fetch('/api/vector/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          type: searchType,
          limit: 20
        }),
      });
      if (!response.ok) {
        throw new Error('Vector search failed');
      }
      return response.json();
    },
    enabled: enabled && query.length > 2,
  });
}

/**
 * Hook for fetching prompt templates from Weaviate
 */
export function useWeaviateTemplates() {
  return useQuery<WeaviateTemplate[]>({
    queryKey: ['/api/weaviate/templates'],
    queryFn: async () => {
      const response = await fetch('/api/weaviate/templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates from Weaviate');
      }
      return response.json();
    },
  });
}

/**
 * Hook for biometric-aware conversation retrieval
 */
export function useBiometricConversations(currentBiometrics: any, limit = 10) {
  return useQuery<WeaviateConversation[]>({
    queryKey: ['/api/weaviate/biometric-conversations', currentBiometrics, limit],
    queryFn: async () => {
      const response = await fetch('/api/weaviate/biometric-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          biometrics: currentBiometrics,
          limit
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch biometric conversations');
      }
      return response.json();
    },
    enabled: !!currentBiometrics,
  });
}

/**
 * Hook for getting Weaviate storage status and health
 */
export function useWeaviateStatus() {
  return useQuery({
    queryKey: ['/api/vector/status'],
    queryFn: async () => {
      const response = await fetch('/api/vector/status');
      if (!response.ok) {
        throw new Error('Failed to get Weaviate status');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}