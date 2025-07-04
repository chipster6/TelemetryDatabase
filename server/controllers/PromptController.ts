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
}