import { BaseController } from './BaseController';
import { Request, Response } from 'express';
import { TOKENS } from '../di/tokens';
import { insertPromptSessionSchema, insertPromptTemplateSchema } from "@shared/schema";
import { z } from "zod";

export class PromptController extends BaseController {
  
  // Helper function to get time of day
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  // Prompt engineering and refinement function
  private generateRefinedPrompt(biometricContext: any, systemPrompt: string, userInput: string): string {
    // Extract the role/purpose from system prompt
    const role = systemPrompt.toLowerCase().includes('creative') ? 'creative assistant' :
                 systemPrompt.toLowerCase().includes('technical') ? 'technical expert' :
                 systemPrompt.toLowerCase().includes('business') ? 'business strategist' :
                 systemPrompt.toLowerCase().includes('research') ? 'research specialist' :
                 'expert assistant';

    // Analyze user input for improvement opportunities
    const inputWords = userInput.split(' ').length;
    const hasContext = userInput.toLowerCase().includes('context') || userInput.toLowerCase().includes('background');
    const hasConstraints = userInput.toLowerCase().includes('format') || userInput.toLowerCase().includes('length') || userInput.toLowerCase().includes('style');
    const hasExamples = userInput.toLowerCase().includes('example') || userInput.toLowerCase().includes('like');
    
    // Generate refined prompt with proper structure
    let refinedPrompt = `You are a ${role} with deep expertise in your field.\n\n`;
    
    // Enhance the original prompt with context
    refinedPrompt += `## Task\n${userInput}\n\n`;
    
    // Add comprehensive prompt engineering best practices
    refinedPrompt += "## Response Guidelines\n";
    refinedPrompt += "Please provide a comprehensive response that includes:\n\n";
    
    // Add structure and best practices based on input analysis
    if (!hasContext) {
      refinedPrompt += "**Context & Background:**\n";
      refinedPrompt += "- Relevant background information\n";
      refinedPrompt += "- Current industry standards and best practices\n";
      refinedPrompt += "- Important considerations or prerequisites\n\n";
    }
    
    refinedPrompt += "**Core Content:**\n";
    refinedPrompt += "- Clear, actionable insights and advice\n";
    refinedPrompt += "- Step-by-step guidance where applicable\n";
    refinedPrompt += "- Specific recommendations tailored to the request\n\n";
    
    if (!hasExamples && inputWords < 15) {
      refinedPrompt += "**Examples & Applications:**\n";
      refinedPrompt += "- Concrete examples to illustrate key points\n";
      refinedPrompt += "- Real-world use cases or scenarios\n";
      refinedPrompt += "- Practical implementation details\n\n";
    }
    
    if (!hasConstraints) {
      refinedPrompt += "**Format & Structure:**\n";
      refinedPrompt += "- Use clear headings and organized sections\n";
      refinedPrompt += "- Include bullet points or numbered lists for clarity\n";
      refinedPrompt += "- Highlight key takeaways or important notes\n\n";
    }
    
    // Add professional closing instruction
    refinedPrompt += "## Quality Standards\n";
    refinedPrompt += "Ensure your response is:\n";
    refinedPrompt += "- Comprehensive yet focused on the specific request\n";
    refinedPrompt += "- Practical and immediately actionable\n";
    refinedPrompt += "- Backed by expertise and current best practices\n";
    refinedPrompt += "- Well-structured and easy to follow\n\n";
    
    refinedPrompt += "---\n\n";
    refinedPrompt += `**User's Original Request:** ${userInput}`;
    
    return refinedPrompt;
  }

  async getPromptTemplates(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      const templates = await storage.getPromptTemplates();
      this.sendSuccess(res, templates);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async createPromptTemplate(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      const validatedData = insertPromptTemplateSchema.parse(req.body);
      const template = await storage.createPromptTemplate(validatedData);
      this.sendSuccess(res, template, "Template created successfully");
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendError(res, 400, "Invalid template data", error.errors);
      } else {
        this.handleError(error, res);
      }
    }
  }

  async generateResponse(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      const biometricService = this.resolve(TOKENS.BiometricService);
      
      const startTime = Date.now();
      const schema = insertPromptSessionSchema.extend({
        biometricContext: z.object({
          heartRate: z.number().optional(),
          hrv: z.number().optional(),
          stressLevel: z.number().optional(),
          attentionLevel: z.number().optional(),
          cognitiveLoad: z.number().optional(),
          environmentalFactors: z.object({
            soundLevel: z.number().optional(),
            temperature: z.number().optional(),
            lightLevel: z.number().optional(),
          }).optional(),
        }).optional(),
      });

      const validatedData = schema.parse(req.body);
      
      // Create prompt session
      const session = await storage.createPromptSession({
        templateId: validatedData.templateId,
        systemPrompt: validatedData.systemPrompt,
        userInput: validatedData.userInput,
        temperature: validatedData.temperature,
        maxTokens: validatedData.maxTokens,
        userId: validatedData.userId,
      });

      // Generate refined prompt (no external AI)
      const analysisResponse = {
        content: this.generateRefinedPrompt(validatedData.biometricContext, validatedData.systemPrompt, validatedData.userInput),
        responseTime: Math.floor(Math.random() * 50) + 10, // Simulate processing time
        type: 'prompt_refinement'
      };

      // Update session with response
      const updatedSession = await storage.updatePromptSession(session.id, {
        aiResponse: analysisResponse.content,
        responseTime: analysisResponse.responseTime,
      });

      // Store biometric context if provided
      if (validatedData.biometricContext) {
        await biometricService.processBiometricReading({
          heartRate: validatedData.biometricContext.heartRate,
          hrv: validatedData.biometricContext.hrv,
          stressLevel: validatedData.biometricContext.stressLevel,
          attentionLevel: validatedData.biometricContext.attentionLevel,
          cognitiveLoad: validatedData.biometricContext.cognitiveLoad,
          environmentalData: validatedData.biometricContext.environmentalFactors,
          deviceSource: 'prompt_session',
        }, session.id);
      }

      const responseTime = Date.now() - startTime;
      
      this.sendSuccess(res, {
        session: updatedSession,
        response: { ...analysisResponse, responseTime },
      });
    } catch (error) {
      console.error('Generate API error:', error);
      if (error instanceof z.ZodError) {
        this.sendError(res, 400, "Invalid request data", error.errors);
      } else {
        this.handleError(error, res);
      }
    }
  }

  async getPromptSessions(req: Request, res: Response): Promise<void> {
    try {
      const storage = this.resolve(TOKENS.DatabaseService);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const sessions = await storage.getPromptSessions(undefined, limit);
      this.sendSuccess(res, sessions);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async prepareLLMContext(req: Request, res: Response): Promise<void> {
    try {
      const { userId, prompt } = req.body;
      
      if (!userId || !prompt) {
        this.sendError(res, 400, "Missing required fields: userId and prompt");
        return;
      }

      // Get biometric service
      const biometricService = this.resolve(TOKENS.BiometricService);
      
      // Get latest biometric data for the user
      const latestBiometricData = await biometricService.getLatestBiometricData(userId);
      
      if (!latestBiometricData) {
        this.sendError(res, 404, "No biometric data available for user");
        return;
      }

      // Initialize BiometricLLMBridge
      const { BiometricLLMBridge } = await import('../services/integration/BiometricLLMBridge.js');
      const llmBridge = new BiometricLLMBridge();

      // Prepare biometric-aware LLM context
      const llmRequest = await llmBridge.prepareLLMContext(userId, prompt, latestBiometricData);

      this.sendSuccess(res, {
        llmRequest,
        biometricState: {
          cognitiveLoad: llmRequest.biometricContext?.metadata.cognitiveLoad,
          flowState: llmRequest.biometricContext?.metadata.flowState,
          attentionLevel: llmRequest.biometricContext?.metadata.attentionLevel,
          neurodivergentPatterns: llmRequest.biometricContext?.metadata.neurodivergentPatterns
        }
      });
    } catch (error) {
      console.error('Prepare LLM context error:', error);
      this.handleError(error, res);
    }
  }

  async storeMemory(req: Request, res: Response): Promise<void> {
    try {
      const { userId, sessionId, prompt, response, cognitiveLoad, attentionLevel, flowState, neurodivergentPatterns, contextualTags, satisfactionScore, completionTime } = req.body;
      
      if (!userId || !sessionId || !prompt || !response) {
        this.sendError(res, 400, "Missing required fields: userId, sessionId, prompt, response");
        return;
      }

      // Initialize PersonalMemoryService
      const { PersonalMemoryService } = await import('../services/memory/PersonalMemoryService.js');
      const memoryService = new PersonalMemoryService();
      await memoryService.initialize();

      // Store interaction in personal memory
      const interactionData = {
        userId,
        sessionId,
        prompt,
        response,
        timestamp: new Date(),
        cognitiveLoad: cognitiveLoad || 0.5,
        attentionLevel: attentionLevel || 0.5,
        flowState: flowState || false,
        neurodivergentPatterns: neurodivergentPatterns || [],
        contextualTags: contextualTags || [],
        satisfactionScore,
        completionTime
      };

      await memoryService.storeInteraction(interactionData);

      this.sendSuccess(res, {
        message: "Memory stored successfully",
        interactionId: `${userId}-${sessionId}-${Date.now()}`
      });
    } catch (error) {
      console.error('Store memory error:', error);
      this.handleError(error, res);
    }
  }

  async retrieveMemories(req: Request, res: Response): Promise<void> {
    try {
      const { userId, query, cognitiveLoad, attentionLevel, flowState, neurodivergentPatterns, limit, relevanceThreshold } = req.query;
      
      if (!userId || !query) {
        this.sendError(res, 400, "Missing required query parameters: userId and query");
        return;
      }

      // Initialize PersonalMemoryService
      const { PersonalMemoryService } = await import('../services/memory/PersonalMemoryService.js');
      const memoryService = new PersonalMemoryService();
      await memoryService.initialize();

      // Build memory query
      const memoryQuery = {
        userId: userId as string,
        query: query as string,
        cognitiveState: cognitiveLoad || attentionLevel || flowState || neurodivergentPatterns ? {
          cognitiveLoad: parseFloat(cognitiveLoad as string) || 0.5,
          attentionLevel: parseFloat(attentionLevel as string) || 0.5,
          flowState: flowState === 'true',
          neurodivergentPatterns: neurodivergentPatterns ? (neurodivergentPatterns as string).split(',') : [],
          timestamp: new Date()
        } : undefined,
        limit: limit ? parseInt(limit as string) : 10,
        relevanceThreshold: relevanceThreshold ? parseFloat(relevanceThreshold as string) : 0.7
      };

      // Retrieve relevant memories
      const memories = await memoryService.retrieveRelevant(memoryQuery);

      this.sendSuccess(res, {
        memories,
        query: memoryQuery,
        count: memories.length
      });
    } catch (error) {
      console.error('Retrieve memories error:', error);
      this.handleError(error, res);
    }
  }

  async getMemoryStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        this.sendError(res, 400, "Missing required query parameter: userId");
        return;
      }

      // Initialize PersonalMemoryService
      const { PersonalMemoryService } = await import('../services/memory/PersonalMemoryService.js');
      const memoryService = new PersonalMemoryService();
      await memoryService.initialize();

      // Get memory statistics
      const stats = await memoryService.getUserMemoryStats(userId as string);

      this.sendSuccess(res, stats);
    } catch (error) {
      console.error('Get memory stats error:', error);
      this.handleError(error, res);
    }
  }
}