import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  category: text("category").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promptSessions = pgTable("prompt_sessions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => promptTemplates.id),
  systemPrompt: text("system_prompt").notNull(),
  userInput: text("user_input").notNull(),
  aiResponse: text("ai_response"),
  temperature: real("temperature").default(0.7),
  maxTokens: integer("max_tokens").default(1000),
  responseTime: integer("response_time"), // in milliseconds
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const biometricData = pgTable("biometric_data", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => promptSessions.id),
  heartRate: integer("heart_rate"),
  hrv: real("hrv"), // heart rate variability in ms
  stressLevel: real("stress_level"), // percentage
  attentionLevel: real("attention_level"), // percentage
  cognitiveLoad: real("cognitive_load"), // percentage
  skinTemperature: real("skin_temperature"), // celsius
  respiratoryRate: real("respiratory_rate"), // breaths per minute
  oxygenSaturation: real("oxygen_saturation"), // percentage
  environmentalData: jsonb("environmental_data"), // sound, light, etc.
  deviceSource: text("device_source").notNull(), // 'bluetooth', 'healthkit', 'simulation'
  timestamp: timestamp("timestamp").defaultNow(),
});

export const cognitiveCorrelations = pgTable("cognitive_correlations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => promptSessions.id),
  attentionScore: real("attention_score"),
  stressScore: real("stress_score"),
  cognitiveLoadScore: real("cognitive_load_score"),
  circadianAlignment: real("circadian_alignment"),
  promptComplexityScore: real("prompt_complexity_score"),
  responseQualityScore: real("response_quality_score"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const deviceConnections = pgTable("device_connections", {
  id: serial("id").primaryKey(),
  deviceType: text("device_type").notNull(), // 'heart_rate_monitor', 'smart_ring', 'environmental'
  deviceName: text("device_name").notNull(),
  connectionStatus: text("connection_status").notNull(), // 'connected', 'disconnected', 'simulated'
  lastSeen: timestamp("last_seen").defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertPromptSessionSchema = createInsertSchema(promptSessions).omit({
  id: true,
  createdAt: true,
  responseTime: true,
  aiResponse: true,
});

export const insertBiometricDataSchema = createInsertSchema(biometricData).omit({
  id: true,
  timestamp: true,
});

export const insertCognitiveCorrelationSchema = createInsertSchema(cognitiveCorrelations).omit({
  id: true,
  timestamp: true,
});

export const insertDeviceConnectionSchema = createInsertSchema(deviceConnections).omit({
  id: true,
  lastSeen: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type PromptSession = typeof promptSessions.$inferSelect;
export type InsertPromptSession = z.infer<typeof insertPromptSessionSchema>;
export type BiometricData = typeof biometricData.$inferSelect;
export type InsertBiometricData = z.infer<typeof insertBiometricDataSchema>;
export type CognitiveCorrelation = typeof cognitiveCorrelations.$inferSelect;
export type InsertCognitiveCorrelation = z.infer<typeof insertCognitiveCorrelationSchema>;
export type DeviceConnection = typeof deviceConnections.$inferSelect;
export type InsertDeviceConnection = z.infer<typeof insertDeviceConnectionSchema>;

// Vector Database Types
export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    timestamp: number;
    userId?: number;
    sessionId?: number;
    biometricContext?: any;
    contentType: 'prompt' | 'response' | 'biometric' | 'correlation' | 'telemetry';
    cognitiveComplexity?: number;
    eventType?: string;
    source?: string;
  };
  vector?: number[];
  encrypted?: boolean;
}
