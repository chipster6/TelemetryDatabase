import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useBiometric } from "@/hooks/use-biometric";
import { apiRequest } from "@/lib/queryClient";

interface PromptTemplate {
  id: number;
  name: string;
  systemPrompt: string;
  category: string;
}

interface GenerateRequest {
  templateId?: number;
  systemPrompt: string;
  userInput: string;
  temperature?: number;
  maxTokens?: number;
  userId?: number;
  biometricContext?: any;
}

export default function PromptInterface() {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userInput, setUserInput] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentBiometrics } = useBiometric();

  const { data: templates = [] } = useQuery<PromptTemplate[]>({
    queryKey: ['/api/templates'],
  });

  // Get unique categories for filtering
  const categories = Array.from(new Set(templates.map(t => t.category))).sort();
  
  // Filter templates by selected category
  const filteredTemplates = selectedCategory === "all" 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const generateMutation = useMutation({
    mutationFn: async (request: GenerateRequest) => {
      const response = await apiRequest('POST', '/api/generate', request);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Analysis Complete",
        description: `Biometric analysis completed in ${data.response.responseTime}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      
      // Store the response for the Analysis component
      queryClient.setQueryData(['latest-response'], data);
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to complete biometric analysis",
        variant: "destructive",
      });
    },
  });

  const handleTemplateChange = (templateId: string) => {
    const id = parseInt(templateId);
    setSelectedTemplate(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      setSystemPrompt(template.systemPrompt);
    }
  };

  const handleGenerate = async () => {
    if (!systemPrompt.trim() || !userInput.trim()) {
      toast({
        title: "Missing Input",
        description: "Please provide both analysis template and user query",
        variant: "destructive",
      });
      return;
    }

    const request: GenerateRequest = {
      templateId: selectedTemplate || undefined,
      systemPrompt,
      userInput,
      temperature,
      maxTokens,
      userId: 1, // Default user for demo
      biometricContext: currentBiometrics ? {
        heartRate: currentBiometrics.heartRate,
        hrv: currentBiometrics.hrv,
        stressLevel: currentBiometrics.stressLevel,
        attentionLevel: currentBiometrics.attentionLevel,
        cognitiveLoad: currentBiometrics.cognitiveLoad,
        environmentalFactors: currentBiometrics.environmentalData,
      } : undefined,
    };

    generateMutation.mutate(request);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Biometric Analysis Interface</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <i className="fas fa-save mr-1"></i>Save Template
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={generateMutation.isPending}
            size="sm"
          >
            {generateMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                Analyzing...
              </>
            ) : (
              <>
                <i className="fas fa-chart-line mr-1"></i>Analyze
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Template Selector */}
      <div className="mb-4">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Template Selection</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Category</Label>
            <Select onValueChange={setSelectedCategory} value={selectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories ({templates.length})</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category} ({templates.filter(t => t.category === category).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Template</Label>
            <Select onValueChange={handleTemplateChange} value={selectedTemplate?.toString() || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{template.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{template.category}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="mb-4">
        <Label htmlFor="systemPrompt" className="text-sm font-medium text-gray-700 mb-2 block">System Prompt</Label>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are an expert AI assistant specialized in..."
          className="h-32 resize-none"
        />
      </div>

      {/* User Input */}
      <div className="mb-6">
        <Label htmlFor="userInput" className="text-sm font-medium text-gray-700 mb-2 block">User Input</Label>
        <Textarea
          id="userInput"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your prompt here..."
          className="h-24 resize-none"
        />
      </div>

      {/* Advanced Options */}
      <div className="border-t border-gray-200 pt-4">
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-700 font-medium mb-3 p-0">
              <i className="fas fa-cogs mr-1"></i>Advanced Options
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="temperature" className="text-sm font-medium text-gray-700 mb-1 block">Temperature</Label>
                <div className="space-y-2">
                  <Input
                    type="range"
                    id="temperature"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{temperature}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="maxTokens" className="text-sm font-medium text-gray-700 mb-1 block">Max Tokens</Label>
                <Input
                  type="number"
                  id="maxTokens"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="text-sm"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
