/**
 * Create sample data for migration testing
 */

import { storage } from '../server/storage.js';

async function createSampleData() {
  console.log('🔧 Creating sample data for migration testing...');

  try {
    // Create sample user if doesn't exist
    let testUser;
    try {
      testUser = await storage.getUserByUsername('testuser');
      if (!testUser) {
        testUser = await storage.createUser({
          username: 'testuser',
          password: 'testpass'
        });
        console.log('✓ Created test user');
      }
    } catch (error) {
      console.log('Test user already exists or error creating user');
    }

    // Create sample prompt sessions
    const promptSessions = [];
    for (let i = 0; i < 5; i++) {
      try {
        const session = await storage.createPromptSession({
          userId: testUser?.id || 1,
          systemPrompt: `Test system prompt ${i + 1}`,
          userInput: `Sample user input ${i + 1}`,
          aiResponse: `Generated AI response for test case ${i + 1}`,
          biometricContext: {
            heartRate: 70 + Math.random() * 20,
            stressLevel: Math.random(),
            timestamp: Date.now() - (i * 1000 * 60 * 60) // Hours ago
          },
          responseTime: 1000 + Math.random() * 2000,
          satisfactionRating: Math.floor(Math.random() * 5) + 1
        });
        promptSessions.push(session);
        console.log(`✓ Created prompt session ${i + 1}`);
      } catch (error) {
        console.error(`Failed to create prompt session ${i + 1}:`, error);
      }
    }

    // Create sample biometric data
    for (let i = 0; i < 20; i++) {
      try {
        await storage.createBiometricData({
          sessionId: promptSessions[Math.floor(Math.random() * promptSessions.length)]?.id || null,
          heartRate: 60 + Math.random() * 40,
          hrv: 20 + Math.random() * 80,
          stressLevel: Math.random(),
          attentionLevel: Math.random(),
          cognitiveLoad: Math.random(),
          deviceSource: 'migration_test_device',
          timestamp: new Date(Date.now() - (i * 1000 * 60 * 10)) // 10 minutes apart
        });
        console.log(`✓ Created biometric record ${i + 1}`);
      } catch (error) {
        console.error(`Failed to create biometric record ${i + 1}:`, error);
      }
    }

    console.log('🎉 Sample data creation completed!');
    
    // Verify data was created
    const [sessions, biometrics] = await Promise.all([
      storage.getPromptSessions(),
      storage.getBiometricData()
    ]);
    
    console.log(`📊 Summary: ${sessions.length} sessions, ${biometrics.length} biometric records`);
    
  } catch (error) {
    console.error('❌ Failed to create sample data:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSampleData().then(() => process.exit(0));
}

export { createSampleData };