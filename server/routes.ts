import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
// import { openaiService } from "./services/openai"; // Removed AI integration
import { biometricService } from "./services/biometric";
import { vectorDatabase } from "./services/vector-database";
import { analyticsService } from "./services/analytics";
import { cloudExportService } from "./services/cloud-export";
import { postQuantumEncryption } from "./services/encryption";
import { anonymizationService } from "./services/anonymization";
import { z } from "zod";
import { insertPromptSessionSchema, insertPromptTemplateSchema } from "@shared/schema";

// Prompt engineering and refinement function
function generateRefinedPrompt(biometricContext: any, systemPrompt: string, userInput: string): string {
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

// Middleware to encrypt sensitive API responses
async function encryptResponse(data: any, isSensitive: boolean = false): Promise<any> {
  if (!isSensitive) return data;
  try {
    const encrypted = await postQuantumEncryption.encryptForTransmission(data);
    return {
      encrypted: true,
      data: encrypted.data,
      keyId: encrypted.keyId,
      timestamp: encrypted.timestamp,
      signature: encrypted.signature
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return data; // Fallback to unencrypted data if encryption fails
  }
}

// Middleware to decrypt sensitive API requests  
async function decryptRequest(encryptedData: any): Promise<any> {
  try {
    if (!encryptedData.encrypted) {
      return encryptedData; // Return as-is if not encrypted
    }
    return await postQuantumEncryption.decryptFromTransmission({
      data: encryptedData.data,
      keyId: encryptedData.keyId,
      timestamp: encryptedData.timestamp,
      signature: encryptedData.signature
    });
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt request data');
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time biometric data
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to biometric stream');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from biometric stream');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast biometric data to all connected clients
  function broadcastBiometricData(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Start simulated biometric data generation
  setInterval(async () => {
    try {
      const simulatedData = biometricService.generateRealisticBiometricData();
      const savedData = await biometricService.processBiometricReading(simulatedData);
      
      broadcastBiometricData({
        type: 'biometric_update',
        data: savedData
      });
    } catch (error) {
      console.error('Error generating biometric data:', error);
    }
  }, 3000); // Every 3 seconds

  // API Routes

  // Authentication middleware
  function requireAuth(req: any, res: any, next: any) {
    if (req.session && req.session.userId) {
      return next();
    }
    return res.status(401).json({ error: "Authentication required" });
  }

  // Login route
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.authenticateUser(username, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      
      res.json({ 
        message: "Login successful", 
        user: { id: user.id, username: user.username } 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Check authentication status
  app.get("/api/auth/status", (req, res) => {
    if (req.session && req.session.userId) {
      res.json({ 
        authenticated: true,
        user: { id: req.session.userId, username: req.session.username }
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Get prompt templates (protected)
  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getPromptTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prompt templates" });
    }
  });

  // Create new prompt template
  app.post("/api/templates", async (req, res) => {
    try {
      const validatedData = insertPromptTemplateSchema.parse(req.body);
      const template = await storage.createPromptTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid template data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create template" });
      }
    }
  });

  // Generate AI response
  app.post("/api/generate", async (req, res) => {
    try {
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
        content: generateRefinedPrompt(validatedData.biometricContext, validatedData.systemPrompt, validatedData.userInput),
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

      res.json({
        session: updatedSession,
        response: analysisResponse,
      });
    } catch (error) {
      console.error('Generate API error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to generate response" });
      }
    }
  });

  // Get recent prompt sessions
  app.get("/api/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const sessions = await storage.getPromptSessions(undefined, limit);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get anonymized biometric statistics
  app.get("/api/biometric", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const rawData = await storage.getBiometricData(undefined, limit);
      
      // Generate anonymized statistics instead of raw data
      const anonymizedStats = anonymizationService.generateAnonymizedStats(rawData);
      res.json(anonymizedStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch biometric statistics" });
    }
  });

  // Get anonymized biometric time series for charts
  app.get("/api/biometric/timeseries", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const maxPoints = req.query.maxPoints ? parseInt(req.query.maxPoints as string) : 20;
      const rawData = await storage.getBiometricData(undefined, limit);
      
      // Generate anonymized time series data
      const timeSeries = anonymizationService.generateAnonymizedTimeSeries(rawData, maxPoints);
      res.json(timeSeries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch biometric time series" });
    }
  });

  // Get latest biometric reading
  app.get("/api/biometric/latest", async (req, res) => {
    try {
      const latest = await storage.getLatestBiometricData();
      res.json(latest);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch latest biometric data" });
    }
  });

  // Get biometric statistics
  app.get("/api/biometric/stats", async (req, res) => {
    try {
      const stats = await biometricService.getBiometricStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch biometric statistics" });
    }
  });

  // Get device connections
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDeviceConnections();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device connections" });
    }
  });

  // Update device connection status
  app.patch("/api/devices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { connectionStatus } = req.body;
      
      const updated = await storage.updateDeviceConnection(id, { connectionStatus });
      if (!updated) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update device connection" });
    }
  });

  // Vector Database API Endpoints
  
  // Store document in vector database
  app.post("/api/vector/store", async (req, res) => {
    try {
      const document = req.body;
      
      // Record telemetry event
      await analyticsService.recordEvent('user_interaction', {
        action: 'store_document',
        contentType: document.metadata.contentType,
        size: document.content.length
      }, {
        userId: document.metadata.userId,
        sessionId: document.metadata.sessionId
      });

      const documentId = await vectorDatabase.storeDocument(document);
      
      res.json({ 
        success: true, 
        documentId,
        encrypted: document.metadata.contentType === 'biometric' || document.metadata.contentType === 'correlation'
      });
    } catch (error) {
      console.error('Store document error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Storage failed' 
      });
    }
  });

  // Semantic search
  app.post("/api/vector/search", async (req, res) => {
    try {
      const { query, options = {} } = req.body;
      
      // Record search telemetry
      await analyticsService.recordEvent('user_interaction', {
        action: 'semantic_search',
        query,
        options
      });

      const results = await vectorDatabase.semanticSearch(query, options);
      
      res.json({ 
        success: true, 
        results,
        count: results.length,
        query
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Search failed' 
      });
    }
  });

  // Get cognitive correlations analysis
  app.get("/api/analytics/correlations/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const timeRange = {
        start: parseInt(req.query.start as string) || Date.now() - (7 * 24 * 60 * 60 * 1000),
        end: parseInt(req.query.end as string) || Date.now()
      };

      const analysis = await analyticsService.analyzeCognitiveCorrelations(userId, timeRange);
      
      res.json({ 
        success: true, 
        analysis,
        timeRange
      });
    } catch (error) {
      console.error('Correlation analysis error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      });
    }
  });

  // Get performance metrics
  app.get("/api/analytics/performance", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const timeRange = req.query.start && req.query.end ? {
        start: parseInt(req.query.start as string),
        end: parseInt(req.query.end as string)
      } : undefined;

      const metrics = await analyticsService.getPerformanceMetrics(userId, timeRange);
      
      res.json({ 
        success: true, 
        metrics
      });
    } catch (error) {
      console.error('Performance metrics error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Metrics calculation failed' 
      });
    }
  });

  // Vector database statistics
  app.get("/api/vector/stats", async (req, res) => {
    try {
      const stats = vectorDatabase.getStats();
      
      res.json({ 
        success: true, 
        stats
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Stats retrieval failed' 
      });
    }
  });

  // Cloud export operations
  app.post("/api/cloud/export/:type", async (req, res) => {
    try {
      const type = req.params.type as 'compression' | 'backup';
      
      if (type !== 'compression' && type !== 'backup') {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid export type. Must be "compression" or "backup"' 
        });
      }

      const jobId = await cloudExportService.triggerManualExport(type);
      
      res.json({ 
        success: true, 
        jobId,
        type
      });
    } catch (error) {
      console.error('Cloud export error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Export failed' 
      });
    }
  });

  // Get system status
  app.get("/api/system/status", async (req, res) => {
    try {
      const status = cloudExportService.getSystemStatus();
      const encryptionKeyId = postQuantumEncryption.getCurrentKeyId();
      
      res.json({ 
        success: true, 
        status: {
          ...status,
          encryption: {
            currentKeyId: encryptionKeyId,
            algorithm: 'post-quantum-resistant'
          },
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('System status error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Status retrieval failed' 
      });
    }
  });

  return httpServer;
}
