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
import { z } from "zod";
import { insertPromptSessionSchema, insertPromptTemplateSchema } from "@shared/schema";

// Biometric analysis function (replaces AI integration)
function generateBiometricAnalysis(biometricContext: any, systemPrompt: string, userInput: string): string {
  const responses = [
    "Based on your current biometric state, this analysis suggests optimal cognitive engagement patterns.",
    "Your physiological data indicates readiness for focused analytical work.",
    "Biometric patterns suggest this is an ideal time for creative thinking exercises.",
    "Current stress levels and heart rate variability indicate good conditions for learning.",
    "Your attention metrics suggest excellent capacity for problem-solving activities.",
    "Environmental and physiological factors are aligned for productive work sessions.",
    "Cognitive load indicators suggest optimal timing for complex task engagement.",
    "Heart rate variability patterns indicate good stress resilience at this time."
  ];
  
  if (biometricContext) {
    const stress = biometricContext.stressLevel || 50;
    const attention = biometricContext.attentionLevel || 50;
    const heartRate = biometricContext.heartRate || 75;
    
    if (stress > 70) {
      return "Your biometric data shows elevated stress levels. Consider stress-reduction techniques or lighter cognitive tasks.";
    } else if (attention > 80) {
      return "Excellent attention levels detected. This is an optimal time for complex analytical tasks and deep focus work.";
    } else if (heartRate > 90) {
      return "Elevated heart rate detected. Consider breathing exercises or physical activity to optimize cognitive performance.";
    }
  }
  
  return responses[Math.floor(Math.random() * responses.length)];
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

  // Get prompt templates
  app.get("/api/templates", async (req, res) => {
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

      // Generate analysis response (no external AI)
      const analysisResponse = {
        content: generateBiometricAnalysis(validatedData.biometricContext, validatedData.systemPrompt, validatedData.userInput),
        responseTime: Math.floor(Math.random() * 50) + 10, // Simulate processing time
        type: 'biometric_analysis'
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

  // Get biometric data
  app.get("/api/biometric", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const data = await storage.getBiometricData(undefined, limit);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch biometric data" });
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
