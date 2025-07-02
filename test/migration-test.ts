import { migratePostgresToWeaviate } from '../migrations/postgres-to-weaviate.js';

async function runTest() {
  console.log('Testing PostgreSQL to Weaviate migration...');
  
  try {
    // First verify we have data to migrate
    const { storage } = await import('../server/storage.js');
    const [sessions, biometrics] = await Promise.all([
      storage.getPromptSessions(),
      storage.getBiometricData()
    ]);
    
    console.log(`Pre-migration check: ${sessions.length} sessions, ${biometrics.length} biometric records`);
    
    if (sessions.length === 0 && biometrics.length === 0) {
      console.log('No data found - creating sample data first...');
      const { createSampleData } = await import('./create-sample-data.js');
      await createSampleData();
      
      // Recheck after creating data
      const [newSessions, newBiometrics] = await Promise.all([
        storage.getPromptSessions(),
        storage.getBiometricData()
      ]);
      console.log(`After sample creation: ${newSessions.length} sessions, ${newBiometrics.length} biometric records`);
    }
    
    const stats = await migratePostgresToWeaviate({ dryRun: false, batchSize: 10 });
    console.log('Migration Statistics:', stats);
    
    // Test querying migrated data
    const { weaviateService } = await import('../server/services/weaviate.service.js');
    const conversations = await weaviateService.searchConversations('', 10);
    console.log(`Found ${conversations.length} conversations in Weaviate after migration`);
    
  } catch (error) {
    console.error('Migration test failed:', error);
  }
}

runTest();