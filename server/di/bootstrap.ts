import { ServiceContainer } from './ServiceContainer';
import { TOKENS } from './tokens';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { DatabaseStorage } from '../storage';
import { postQuantumEncryption } from '../services/encryption';
import { biometricService } from '../services/biometric';
import { analyticsService } from '../services/analytics';
import { WeaviateVectorDatabase } from '../services/vector-database';
import { WebauthnService } from '../services/webauthn';
import { CloudExportService } from '../services/cloud-export';
import { anonymizationService } from '../services/anonymization';
import { GDPRComplianceService } from '../services/gdpr-compliance';
import { BiometricPipelineService } from '../services/BiometricPipelineService';
import { BiometricPerformanceService } from '../services/BiometricPerformanceService';
import { BiometricSecurityService } from '../services/BiometricSecurityService';
import { NeurodivergentAnalyticsService } from '../services/NeurodivergentAnalyticsService';
import { trainingExportService } from '../services/training-export.service';
import { ragService } from '../services/rag.service';
import { nexisBrainService } from '../services/nexis-brain';
import { weaviateClientProvider } from '../services/shared/WeaviateClientProvider';
import { weaviateConnectionManager } from '../services/WeaviateConnectionManager';
import { redisConnectionManager } from '../services/RedisConnectionManager';
import { AuthController } from '../controllers/AuthController';
import { PromptController } from '../controllers/PromptController';
import { BiometricController } from '../controllers/BiometricController';

export function bootstrapDI(): ServiceContainer {
  const container = new ServiceContainer();

  // Core services
  container.registerSingleton(TOKENS.ConfigurationManager, () => ConfigurationManager.getInstance());
  
  // Database services
  container.registerSingleton(TOKENS.DatabaseService, () => new DatabaseStorage());
  container.registerSingleton(TOKENS.RedisService, () => redisConnectionManager.getClient());
  
  // Security services
  container.registerSingleton(TOKENS.EncryptionService, () => postQuantumEncryption);
  container.registerSingleton(TOKENS.WebAuthnService, () => new WebauthnService());
  container.registerSingleton(TOKENS.BiometricSecurityService, () => new BiometricSecurityService());
  
  // Biometric services
  container.registerSingleton(TOKENS.BiometricService, () => biometricService);
  container.registerSingleton(TOKENS.BiometricPipelineService, () => {
    const redis = container.resolve(TOKENS.RedisService);
    const weaviate = container.resolve(TOKENS.WeaviateClientProvider);
    return new BiometricPipelineService(weaviate, redis);
  });
  container.registerSingleton(TOKENS.BiometricPerformanceService, () => {
    const redis = container.resolve(TOKENS.RedisService);
    return new BiometricPerformanceService(redis, {
      connectionPool: { min: 2, max: 10, acquireTimeoutMillis: 5000, createTimeoutMillis: 3000 },
      streamProcessing: { batchSize: 100, flushIntervalMs: 1000, maxConcurrency: 4, bufferSize: 1000 }
    });
  });
  
  // Analytics services
  container.registerSingleton(TOKENS.AnalyticsService, () => analyticsService);
  container.registerSingleton(TOKENS.NeurodivergentAnalyticsService, () => {
    const redis = container.resolve(TOKENS.RedisService);
    const weaviate = container.resolve(TOKENS.WeaviateClientProvider);
    return new NeurodivergentAnalyticsService(weaviate, redis);
  });
  
  // Vector database services
  container.registerSingleton(TOKENS.WeaviateClientProvider, () => weaviateClientProvider);
  container.registerSingleton(TOKENS.WeaviateConnectionManager, () => weaviateConnectionManager);
  container.registerSingleton(TOKENS.VectorDatabaseService, () => new WeaviateVectorDatabase());
  container.registerSingleton(TOKENS.WeaviateService, () => new WeaviateVectorDatabase());
  
  // Cloud services
  container.registerSingleton(TOKENS.CloudExportService, () => new CloudExportService());
  container.registerSingleton(TOKENS.TrainingExportService, () => trainingExportService);
  
  // Compliance services
  container.registerSingleton(TOKENS.AnonymizationService, () => anonymizationService);
  container.registerSingleton(TOKENS.GDPRComplianceService, () => new GDPRComplianceService());
  
  // AI services
  container.registerSingleton(TOKENS.RAGService, () => ragService);
  container.registerSingleton(TOKENS.NexisBrainService, () => nexisBrainService);

  // Controllers
  container.register(TOKENS.AuthController, () => new AuthController(container));
  container.register(TOKENS.PromptController, () => new PromptController(container));
  container.register(TOKENS.BiometricController, () => new BiometricController(container));

  return container;
}

// Global container instance
export const globalContainer = bootstrapDI();