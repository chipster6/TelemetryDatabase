// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
});

afterAll(async () => {
  // Global cleanup
  // Jest will handle process cleanup
});