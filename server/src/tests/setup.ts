/**
 * Vitest global setup.
 *
 * Tests run against a dedicated local MongoDB database (`career_guide_test`)
 * that is dropped between suites. This keeps the development data untouched
 * while still exercising real Mongoose behaviour, indexes and transactions
 * rather than mocking the database layer.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-that-is-long-enough-for-hs256-signing';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/career_guide_test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.LOG_LEVEL = 'error';
process.env.AI_PROVIDER = 'none';
process.env.BOOTSTRAP_ADMIN_PASSWORD = '';
process.env.RATE_LIMIT_MAX = '10000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';
