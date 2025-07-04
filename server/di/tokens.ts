import { ServiceToken } from './ServiceContainer';
import { ConfigurationManager } from '../config/ConfigurationManager';

export const TOKENS = {
  ConfigurationManager: { name: 'ConfigurationManager' } as ServiceToken<ConfigurationManager>,
  DatabaseService: { name: 'DatabaseService' } as ServiceToken<any>,
  EncryptionService: { name: 'EncryptionService' } as ServiceToken<any>,
  BiometricService: { name: 'BiometricService' } as ServiceToken<any>,
  AnalyticsService: { name: 'AnalyticsService' } as ServiceToken<any>,
  WeaviateService: { name: 'WeaviateService' } as ServiceToken<any>,
  WeaviateClientProvider: { name: 'WeaviateClientProvider' } as ServiceToken<any>,
  WebAuthnService: { name: 'WebAuthnService' } as ServiceToken<any>,
  RAGService: { name: 'RAGService' } as ServiceToken<any>,
  NexisBrainService: { name: 'NexisBrainService' } as ServiceToken<any>,
  VectorDatabaseService: { name: 'VectorDatabaseService' } as ServiceToken<any>,
  CloudExportService: { name: 'CloudExportService' } as ServiceToken<any>,
  AnonymizationService: { name: 'AnonymizationService' } as ServiceToken<any>,
  GDPRComplianceService: { name: 'GDPRComplianceService' } as ServiceToken<any>,
  BiometricPipelineService: { name: 'BiometricPipelineService' } as ServiceToken<any>,
  BiometricPerformanceService: { name: 'BiometricPerformanceService' } as ServiceToken<any>,
  BiometricSecurityService: { name: 'BiometricSecurityService' } as ServiceToken<any>,
  NeurodivergentAnalyticsService: { name: 'NeurodivergentAnalyticsService' } as ServiceToken<any>,
  TrainingExportService: { name: 'TrainingExportService' } as ServiceToken<any>,
  // Controllers
  AuthController: { name: 'AuthController' } as ServiceToken<any>,
  PromptController: { name: 'PromptController' } as ServiceToken<any>,
  BiometricController: { name: 'BiometricController' } as ServiceToken<any>,
  WebSocketController: { name: 'WebSocketController' } as ServiceToken<any>,
} as const;