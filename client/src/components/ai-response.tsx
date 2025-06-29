import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AIResponseData {
  session: {
    id: number;
    aiResponse: string;
    responseTime: number;
  };
  response: {
    content: string;
    responseTime: number;
    biometricAdaptations?: string[];
    cognitiveComplexityScore?: number;
  };
}

export default function AIResponse() {
  const { toast } = useToast();
  
  const { data: responseData } = useQuery<AIResponseData>({
    queryKey: ['latest-response'],
    enabled: false, // Only fetch when data is set by prompt interface
  });

  const handleCopy = async () => {
    if (responseData?.response.content) {
      try {
        await navigator.clipboard.writeText(responseData.response.content);
        toast({
          title: "Copied to Clipboard",
          description: "Response has been copied to your clipboard",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleRegenerate = () => {
    toast({
      title: "Regenerate",
      description: "Please use the Generate button in the prompt interface",
    });
  };

  if (!responseData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI Response</h3>
        </div>
        <div className="text-center py-12 text-gray-500">
          <i className="fas fa-robot text-4xl mb-4"></i>
          <p>Generate a prompt to see AI responses here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">AI Response</h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <i className="fas fa-clock"></i>
          <span>Response time: {responseData.response.responseTime}ms</span>
          {responseData.response.biometricAdaptations && responseData.response.biometricAdaptations.length > 0 && (
            <>
              <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
              <span>Biometric-adapted</span>
            </>
          )}
        </div>
      </div>
      
      {/* Response Content */}
      <div className="prose max-w-none">
        <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {responseData.response.content}
          </div>
          
          {/* Response Metadata */}
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
            {responseData.response.biometricAdaptations && responseData.response.biometricAdaptations.length > 0 && (
              <span>✨ {responseData.response.biometricAdaptations.join(', ')}</span>
            )}
            {responseData.response.cognitiveComplexityScore && (
              <span>🧠 Complexity: {responseData.response.cognitiveComplexityScore}%</span>
            )}
            <span>💡 Word count: {responseData.response.content.split(/\s+/).length}</span>
          </div>
        </div>
      </div>

      {/* Response Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm">
            <i className="fas fa-thumbs-up mr-1"></i>Like
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <i className="fas fa-copy mr-1"></i>Copy
          </Button>
          <Button variant="ghost" size="sm">
            <i className="fas fa-share mr-1"></i>Share
          </Button>
        </div>
        <Button onClick={handleRegenerate} size="sm">
          <i className="fas fa-redo mr-1"></i>Regenerate
        </Button>
      </div>
    </div>
  );
}
