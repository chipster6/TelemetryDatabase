
import { migratePostgresToWeaviate } from '../migrations/postgres-to-weaviate';

async function runTest() {
  try {
    const stats = await migratePostgresToWeaviate({ dryRun: true });
    console.log('Test Migration Statistics:', stats);
  } catch (error) {
    console.error('Migration Test Failed:', error);
  }
}

runTest();
