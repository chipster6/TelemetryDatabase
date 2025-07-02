// Enhanced Database Schema for Biometric Pipeline
// Extended schema with neurodivergent patterns, security, and performance optimization

import { pgTable, text, integer, real, timestamp, boolean, jsonb, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// ==================== Enhanced Biometric Data Schema ====================

export const enhancedBiometricData = pgTable('enhanced_biometric_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  deviceId: text('device_id'),
  
  // Core biometric measurements
  timestamp: timestamp('timestamp').notNull(),
  heartRate: real('heart_rate').notNull(),
  hrv: real('hrv'),
  hrvVariability: real('hrv_variability'),
  skinTemperature: real('skin_temperature'),
  respiratoryRate: real('respiratory_rate'),
  oxygenSaturation: real('oxygen_saturation'),
  
  // Cognitive measurements
  cognitiveLoad: real('cognitive_load').notNull(),
  attentionLevel: real('attention_level').notNull(),
  stressLevel: real('stress_level').notNull(),
  focusDepth: real('focus_depth'),
  mentalFatigue: real('mental_fatigue'),
  workingMemoryLoad: real('working_memory_load'),
  
  // Environmental context
  environmentalSound: real('environmental_sound'),
  lightLevel: real('light_level'),
  temperature: real('temperature'),
  humidity: real('humidity'),
  airQuality: real('air_quality'),
  
  // Contextual information
  contextId: text('context_id'),
  taskType: text('task_type'),
  taskComplexity: real('task_complexity'),
  socialContext: text('social_context'),
  locationContext: text('location_context'),
  
  // Neurodivergent-specific measurements
  stimulationLevel: real('stimulation_level'),
  sensoryOverload: real('sensory_overload'),
  executiveFunctionLoad: real('executive_function_load'),
  attentionStability: real('attention_stability'),
  transitionDifficulty: real('transition_difficulty'),
  
  // Processing metadata
  processingLatency: real('processing_latency'),
  dataQuality: real('data_quality'),
  confidenceScore: real('confidence_score'),
  anomalyScore: real('anomaly_score'),
  
  // Security and privacy
  encryptionKeyId: text('encryption_key_id'),
  privacyLevel: text('privacy_level').default('standard'),
  dataHash: text('data_hash'),
  
  // Additional metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  processedAt: timestamp('processed_at')
}, (table) => ({
  userIdIdx: index('enhanced_biometric_user_id_idx').on(table.userId),
  timestampIdx: index('enhanced_biometric_timestamp_idx').on(table.timestamp),
  sessionIdIdx: index('enhanced_biometric_session_id_idx').on(table.sessionId),
  contextIdIdx: index('enhanced_biometric_context_id_idx').on(table.contextId),
  userTimestampIdx: index('enhanced_biometric_user_timestamp_idx').on(table.userId, table.timestamp)
}));

// ==================== Neurodivergent Patterns Schema ====================

export const neurodivergentPatterns = pgTable('neurodivergent_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  analysisId: text('analysis_id').notNull(),
  
  // Pattern identification
  patternType: text('pattern_type').notNull(), // 'hyperfocus', 'context_switching', 'sensory_processing', etc.
  patternSubtype: text('pattern_subtype'),
  confidence: real('confidence').notNull(),
  significance: real('significance'),
  
  // Temporal information
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  duration: integer('duration'), // in milliseconds
  frequency: real('frequency'),
  
  // Pattern characteristics
  intensity: real('intensity'),
  stability: real('stability'),
  efficiency: real('efficiency'),
  productivity: real('productivity'),
  
  // Context information
  triggerContext: text('trigger_context'),
  environmentalFactors: jsonb('environmental_factors'),
  taskContext: jsonb('task_context'),
  
  // Measurements during pattern
  avgHeartRate: real('avg_heart_rate'),
  avgCognitiveLoad: real('avg_cognitive_load'),
  avgAttentionLevel: real('avg_attention_level'),
  avgStressLevel: real('avg_stress_level'),
  
  // Pattern-specific data
  hyperfocusData: jsonb('hyperfocus_data'), // For hyperfocus patterns
  switchingData: jsonb('switching_data'), // For context switching patterns
  sensoryData: jsonb('sensory_data'), // For sensory processing patterns
  attentionData: jsonb('attention_data'), // For attention patterns
  
  // Recovery information
  recoveryTime: integer('recovery_time'),
  recoveryQuality: real('recovery_quality'),
  
  // Analysis metadata
  analysisVersion: text('analysis_version').notNull(),
  algorithmVersion: text('algorithm_version'),
  
  // Timestamps
  detectedAt: timestamp('detected_at').defaultNow(),
  analyzedAt: timestamp('analyzed_at').defaultNow()
}, (table) => ({
  userIdIdx: index('nd_patterns_user_id_idx').on(table.userId),
  patternTypeIdx: index('nd_patterns_type_idx').on(table.patternType),
  startTimeIdx: index('nd_patterns_start_time_idx').on(table.startTime),
  userPatternIdx: index('nd_patterns_user_pattern_idx').on(table.userId, table.patternType),
  analysisIdIdx: index('nd_patterns_analysis_id_idx').on(table.analysisId)
}));

// ==================== Pattern Insights Schema ====================

export const patternInsights = pgTable('pattern_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  patternId: uuid('pattern_id').references(() => neurodivergentPatterns.id),
  
  // Insight classification
  insightType: text('insight_type').notNull(), // 'strength', 'recommendation', 'accommodation', 'optimization'
  category: text('category').notNull(), // 'attention', 'energy', 'environment', 'timing', etc.
  priority: text('priority').notNull(), // 'high', 'medium', 'low'
  
  // Insight content
  title: text('title').notNull(),
  description: text('description').notNull(),
  recommendation: text('recommendation'),
  evidence: jsonb('evidence'),
  
  // Implementation guidance
  implementationSteps: jsonb('implementation_steps'),
  expectedBenefit: text('expected_benefit'),
  effort: text('effort'), // 'low', 'medium', 'high'
  timeframe: text('timeframe'), // 'immediate', 'short_term', 'long_term'
  
  // Tracking
  isImplemented: boolean('is_implemented').default(false),
  implementedAt: timestamp('implemented_at'),
  effectiveness: real('effectiveness'),
  userRating: integer('user_rating'),
  
  // Metadata
  confidence: real('confidence'),
  applicability: real('applicability'),
  
  // Timestamps
  generatedAt: timestamp('generated_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  userIdIdx: index('pattern_insights_user_id_idx').on(table.userId),
  typeIdx: index('pattern_insights_type_idx').on(table.insightType),
  categoryIdx: index('pattern_insights_category_idx').on(table.category),
  priorityIdx: index('pattern_insights_priority_idx').on(table.priority),
  patternIdIdx: index('pattern_insights_pattern_id_idx').on(table.patternId)
}));

// ==================== Real-time Analytics Schema ====================

export const realtimeAnalytics = pgTable('realtime_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  
  // Current state analysis
  currentCognitiveLoad: real('current_cognitive_load'),
  currentAttentionLevel: real('current_attention_level'),
  currentStressLevel: real('current_stress_level'),
  currentFlowState: real('current_flow_state'),
  currentEnergyLevel: real('current_energy_level'),
  
  // Trend analysis
  cognitiveLoadTrend: text('cognitive_load_trend'), // 'increasing', 'decreasing', 'stable'
  attentionTrend: text('attention_trend'),
  stressTrend: text('stress_trend'),
  energyTrend: text('energy_trend'),
  
  // Predictive analytics
  predictedCognitiveLoad: real('predicted_cognitive_load'),
  predictedAttentionLevel: real('predicted_attention_level'),
  predictedStressLevel: real('predicted_stress_level'),
  predictionConfidence: real('prediction_confidence'),
  predictionTimeframe: integer('prediction_timeframe'), // minutes
  
  // Recommendations
  immediateRecommendations: jsonb('immediate_recommendations'),
  shortTermRecommendations: jsonb('short_term_recommendations'),
  
  // Alerts
  activeAlerts: jsonb('active_alerts'),
  alertLevel: text('alert_level'), // 'none', 'low', 'medium', 'high', 'critical'
  
  // Performance metrics
  optimalStateScore: real('optimal_state_score'),
  productivityScore: real('productivity_score'),
  sustainabilityScore: real('sustainability_score'),
  
  // Context awareness
  currentContext: text('current_context'),
  contextStability: real('context_stability'),
  contextOptimality: real('context_optimality'),
  
  // Analytics metadata
  analysisQuality: real('analysis_quality'),
  dataPoints: integer('data_points'),
  timeWindow: integer('time_window'), // minutes
  
  // Timestamps
  timestamp: timestamp('timestamp').notNull(),
  expiresAt: timestamp('expires_at').notNull() // TTL for cleanup
}, (table) => ({
  userIdIdx: index('realtime_analytics_user_id_idx').on(table.userId),
  timestampIdx: index('realtime_analytics_timestamp_idx').on(table.timestamp),
  sessionIdIdx: index('realtime_analytics_session_id_idx').on(table.sessionId),
  expiresAtIdx: index('realtime_analytics_expires_at_idx').on(table.expiresAt),
  userTimestampIdx: index('realtime_analytics_user_timestamp_idx').on(table.userId, table.timestamp)
}));

// ==================== Security Audit Schema ====================

export const securityAuditLog = pgTable('security_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  sessionId: text('session_id'),
  
  // Event information
  eventType: text('event_type').notNull(), // 'encryption', 'decryption', 'validation', 'threat', 'privacy'
  severity: text('severity').notNull(), // 'low', 'medium', 'high', 'critical'
  action: text('action').notNull(),
  result: text('result').notNull(), // 'success', 'failure', 'blocked'
  
  // Security details
  threatType: text('threat_type'),
  threatLevel: real('threat_level'),
  encryptionMethod: text('encryption_method'),
  keyId: text('key_id'),
  
  // Context
  sourceIp: text('source_ip'),
  userAgent: text('user_agent'),
  endpoint: text('endpoint'),
  method: text('method'),
  
  // Additional data
  message: text('message').notNull(),
  details: jsonb('details'),
  
  // Processing information
  processingTime: real('processing_time'),
  
  // Timestamps
  timestamp: timestamp('timestamp').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('security_audit_user_id_idx').on(table.userId),
  eventTypeIdx: index('security_audit_event_type_idx').on(table.eventType),
  severityIdx: index('security_audit_severity_idx').on(table.severity),
  timestampIdx: index('security_audit_timestamp_idx').on(table.timestamp),
  threatTypeIdx: index('security_audit_threat_type_idx').on(table.threatType)
}));

// ==================== Performance Metrics Schema ====================

export const performanceMetrics = pgTable('performance_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // System metrics
  requestsPerSecond: real('requests_per_second'),
  averageProcessingTime: real('average_processing_time'),
  dataPointsProcessed: integer('data_points_processed'),
  
  // Resource metrics
  memoryUsage: jsonb('memory_usage'), // heap, external, rss
  cpuUsage: jsonb('cpu_usage'), // user, system
  
  // Connection metrics
  activeConnections: integer('active_connections'),
  connectionPoolUtilization: real('connection_pool_utilization'),
  failedConnections: integer('failed_connections'),
  
  // Cache metrics
  cacheHitRate: real('cache_hit_rate'),
  cacheSize: integer('cache_size'),
  cacheMisses: integer('cache_misses'),
  
  // Queue metrics
  queueSize: integer('queue_size'),
  averageQueueWaitTime: real('average_queue_wait_time'),
  processingBacklog: integer('processing_backlog'),
  
  // Error metrics
  errorRate: real('error_rate'),
  timeoutRate: real('timeout_rate'),
  
  // Optimization metrics
  optimizationEvents: integer('optimization_events'),
  scalingEvents: integer('scaling_events'),
  
  // Timestamps
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  intervalStart: timestamp('interval_start').notNull(),
  intervalEnd: timestamp('interval_end').notNull()
}, (table) => ({
  timestampIdx: index('performance_metrics_timestamp_idx').on(table.timestamp),
  intervalIdx: index('performance_metrics_interval_idx').on(table.intervalStart, table.intervalEnd)
}));

// ==================== User Configuration Schema ====================

export const userBiometricConfig = pgTable('user_biometric_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  
  // Privacy settings
  privacyLevel: text('privacy_level').notNull().default('standard'), // 'minimal', 'standard', 'enhanced'
  dataRetentionDays: integer('data_retention_days').default(90),
  allowAnalytics: boolean('allow_analytics').default(true),
  allowPatternDetection: boolean('allow_pattern_detection').default(true),
  allowInsightGeneration: boolean('allow_insight_generation').default(true),
  
  // Processing preferences
  realtimeProcessing: boolean('realtime_processing').default(true),
  batchProcessing: boolean('batch_processing').default(true),
  predictionEnabled: boolean('prediction_enabled').default(true),
  
  // Neurodivergent profile
  neurodivergentProfile: jsonb('neurodivergent_profile'), // ADHD, autism, etc.
  accommodationNeeds: jsonb('accommodation_needs'),
  triggerSensitivities: jsonb('trigger_sensitivities'),
  
  // Alert preferences
  alertsEnabled: boolean('alerts_enabled').default(true),
  alertThresholds: jsonb('alert_thresholds'),
  notificationChannels: jsonb('notification_channels'),
  
  // Data sharing
  allowResearch: boolean('allow_research').default(false),
  allowAggregation: boolean('allow_aggregation').default(true),
  
  // Device settings
  connectedDevices: jsonb('connected_devices'),
  devicePreferences: jsonb('device_preferences'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  userIdIdx: uniqueIndex('user_biometric_config_user_id_idx').on(table.userId)
}));

// ==================== Device Integration Schema ====================

export const biometricDevices = pgTable('biometric_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  
  // Device information
  deviceId: text('device_id').notNull(),
  deviceName: text('device_name').notNull(),
  deviceType: text('device_type').notNull(), // 'wearable', 'sensor', 'camera', 'microphone'
  manufacturer: text('manufacturer'),
  model: text('model'),
  firmwareVersion: text('firmware_version'),
  
  // Connection information
  connectionType: text('connection_type'), // 'bluetooth', 'wifi', 'usb', 'api'
  connectionStatus: text('connection_status').default('disconnected'), // 'connected', 'disconnected', 'error'
  lastConnected: timestamp('last_connected'),
  
  // Capabilities
  supportedMetrics: jsonb('supported_metrics'),
  samplingRate: real('sampling_rate'),
  accuracy: real('accuracy'),
  batteryLevel: real('battery_level'),
  
  // Configuration
  isActive: boolean('is_active').default(true),
  isPrimary: boolean('is_primary').default(false),
  settings: jsonb('settings'),
  calibrationData: jsonb('calibration_data'),
  
  // Security
  encryptionEnabled: boolean('encryption_enabled').default(true),
  authenticationMethod: text('authentication_method'),
  lastSyncHash: text('last_sync_hash'),
  
  // Timestamps
  registeredAt: timestamp('registered_at').defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  userIdIdx: index('biometric_devices_user_id_idx').on(table.userId),
  deviceIdIdx: index('biometric_devices_device_id_idx').on(table.deviceId),
  deviceTypeIdx: index('biometric_devices_type_idx').on(table.deviceType),
  userDeviceIdx: uniqueIndex('biometric_devices_user_device_idx').on(table.userId, table.deviceId)
}));

// ==================== Training Data Schema ====================

export const trainingDataExports = pgTable('training_data_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  
  // Export details
  exportType: text('export_type').notNull(), // 'personal_ai', 'research', 'backup'
  dataFormat: text('data_format').notNull(), // 'json', 'csv', 'parquet'
  
  // Date range
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  
  // Export statistics
  totalDataPoints: integer('total_data_points'),
  totalPatterns: integer('total_patterns'),
  totalInsights: integer('total_insights'),
  exportSize: integer('export_size'), // bytes
  
  // Privacy and security
  anonymizationLevel: text('anonymization_level'), // 'none', 'partial', 'full'
  encryptionKeyId: text('encryption_key_id'),
  accessHash: text('access_hash'),
  
  // Storage information
  storageLocation: text('storage_location'),
  downloadUrl: text('download_url'),
  expiresAt: timestamp('expires_at'),
  
  // Status
  status: text('status').default('pending'), // 'pending', 'processing', 'completed', 'failed', 'expired'
  progress: real('progress').default(0),
  errorMessage: text('error_message'),
  
  // Timestamps
  requestedAt: timestamp('requested_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at')
}, (table) => ({
  userIdIdx: index('training_exports_user_id_idx').on(table.userId),
  statusIdx: index('training_exports_status_idx').on(table.status),
  expiresAtIdx: index('training_exports_expires_at_idx').on(table.expiresAt),
  requestedAtIdx: index('training_exports_requested_at_idx').on(table.requestedAt)
}));

// ==================== Validation Schemas ====================

// Biometric data validation
export const biometricDataSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().positive(),
  heartRate: z.number().min(30).max(250),
  hrv: z.number().min(0).optional(),
  cognitiveLoad: z.number().min(0).max(100),
  attentionLevel: z.number().min(0).max(100),
  stressLevel: z.number().min(0).max(100),
  skinTemperature: z.number().min(20).max(50).optional(),
  environmentalSound: z.number().min(0).max(150).optional(),
  lightLevel: z.number().min(0).optional(),
  contextId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Pattern detection validation
export const patternDetectionSchema = z.object({
  userId: z.string().min(1),
  patternType: z.enum(['hyperfocus', 'context_switching', 'sensory_processing', 'attention_variability', 'energy_management']),
  startTime: z.date(),
  endTime: z.date(),
  confidence: z.number().min(0).max(1),
  intensity: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional()
});

// Insight generation validation
export const insightGenerationSchema = z.object({
  userId: z.string().min(1),
  insightType: z.enum(['strength', 'recommendation', 'accommodation', 'optimization']),
  category: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  title: z.string().min(1),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1).optional()
});

// Configuration validation
export const userConfigSchema = z.object({
  privacyLevel: z.enum(['minimal', 'standard', 'enhanced']),
  dataRetentionDays: z.number().min(1).max(365),
  allowAnalytics: z.boolean(),
  allowPatternDetection: z.boolean(),
  realtimeProcessing: z.boolean(),
  alertsEnabled: z.boolean(),
  neurodivergentProfile: z.record(z.any()).optional(),
  accommodationNeeds: z.array(z.string()).optional()
});

// ==================== Relations ====================

export const enhancedBiometricDataRelations = relations(enhancedBiometricData, ({ many }) => ({
  patterns: many(neurodivergentPatterns),
  insights: many(patternInsights)
}));

export const neurodivergentPatternsRelations = relations(neurodivergentPatterns, ({ one, many }) => ({
  biometricData: one(enhancedBiometricData),
  insights: many(patternInsights)
}));

export const patternInsightsRelations = relations(patternInsights, ({ one }) => ({
  pattern: one(neurodivergentPatterns, {
    fields: [patternInsights.patternId],
    references: [neurodivergentPatterns.id]
  })
}));

export const userBiometricConfigRelations = relations(userBiometricConfig, ({ many }) => ({
  devices: many(biometricDevices),
  exports: many(trainingDataExports)
}));

export const biometricDevicesRelations = relations(biometricDevices, ({ one }) => ({
  userConfig: one(userBiometricConfig, {
    fields: [biometricDevices.userId],
    references: [userBiometricConfig.userId]
  })
}));

// ==================== Type Exports ====================

export type EnhancedBiometricData = typeof enhancedBiometricData.$inferSelect;
export type NewEnhancedBiometricData = typeof enhancedBiometricData.$inferInsert;

export type NeurodivergentPattern = typeof neurodivergentPatterns.$inferSelect;
export type NewNeurodivergentPattern = typeof neurodivergentPatterns.$inferInsert;

export type PatternInsight = typeof patternInsights.$inferSelect;
export type NewPatternInsight = typeof patternInsights.$inferInsert;

export type RealtimeAnalytics = typeof realtimeAnalytics.$inferSelect;
export type NewRealtimeAnalytics = typeof realtimeAnalytics.$inferInsert;

export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type NewSecurityAuditLog = typeof securityAuditLog.$inferInsert;

export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetrics = typeof performanceMetrics.$inferInsert;

export type UserBiometricConfig = typeof userBiometricConfig.$inferSelect;
export type NewUserBiometricConfig = typeof userBiometricConfig.$inferInsert;

export type BiometricDevice = typeof biometricDevices.$inferSelect;
export type NewBiometricDevice = typeof biometricDevices.$inferInsert;

export type TrainingDataExport = typeof trainingDataExports.$inferSelect;
export type NewTrainingDataExport = typeof trainingDataExports.$inferInsert;

// ==================== Database Schema Export ====================

export const enhancedSchema = {
  enhancedBiometricData,
  neurodivergentPatterns,
  patternInsights,
  realtimeAnalytics,
  securityAuditLog,
  performanceMetrics,
  userBiometricConfig,
  biometricDevices,
  trainingDataExports,
  
  // Relations
  enhancedBiometricDataRelations,
  neurodivergentPatternsRelations,
  patternInsightsRelations,
  userBiometricConfigRelations,
  biometricDevicesRelations,
  
  // Validation schemas
  biometricDataSchema,
  patternDetectionSchema,
  insightGenerationSchema,
  userConfigSchema
};

export default enhancedSchema;