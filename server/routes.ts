import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { openaiService } from "./services/openai";
import { biometricService } from "./services/biometric";
import { z } from "zod";
import { insertPromptSessionSchema, insertPromptTemplateSchema } from "@shared/schema";

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

      // Generate AI response
      const aiResponse = await openaiService.generateResponse({
        systemPrompt: validatedData.systemPrompt,
        userInput: validatedData.userInput,
        temperature: validatedData.temperature,
        maxTokens: validatedData.maxTokens,
        biometricContext: validatedData.biometricContext,
      });

      // Update session with response
      const updatedSession = await storage.updatePromptSession(session.id, {
        aiResponse: aiResponse.content,
        responseTime: aiResponse.responseTime,
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
        response: aiResponse,
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

  return httpServer;
}
