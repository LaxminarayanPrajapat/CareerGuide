import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(here, '../../.env') });
dotenv.config({ path: path.resolve(here, '../../../.env') });

function str(key: string, fallback = ''): string {
  const raw = process.env[key];
  return raw === undefined ? fallback : raw.trim();
}

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = str(key);
  if (raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const NODE_ENV = str('NODE_ENV', 'development');
const MONGODB_URI = str('MONGODB_URI', 'mongodb://127.0.0.1:27017/career_guide');
const JWT_SECRET = str('JWT_SECRET', '');
const AI_PROVIDER = str('AI_PROVIDER', 'none').toLowerCase();

/**
 * Configuration problems that make the application unusable. Reported at
 * startup with an actionable message instead of failing later at runtime.
 */
function collectStartupErrors(): string[] {
  const errors: string[] = [];

  if (!MONGODB_URI) {
    errors.push('MONGODB_URI is required. Copy server/.env.example to server/.env and set it.');
  }
  if (!JWT_SECRET) {
    errors.push('JWT_SECRET is required. Use a long random string (>= 32 characters).');
  } else if (NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production.');
  }
  if (AI_PROVIDER !== 'none' && AI_PROVIDER !== 'gemini' && AI_PROVIDER !== 'openai') {
    errors.push('AI_PROVIDER must be one of: none | gemini | openai.');
  }
  return errors;
}

const startupErrors = collectStartupErrors();

if (startupErrors.length > 0 && NODE_ENV === 'production') {
  // Fail fast in production; in development we print the same problems so the
  // developer can see them, but the process still starts for the health endpoint.
  // eslint-disable-next-line no-console
  console.error('Invalid server configuration:\n- ' + startupErrors.join('\n- '));
}

export const env = {
  nodeEnv: NODE_ENV as 'development' | 'test' | 'production',
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  port: int('PORT', 5000),
  logLevel: str('LOG_LEVEL', 'info'),
  startupErrors,

  mongoUri: MONGODB_URI,
  dbName: str('MONGODB_DB_NAME', ''),

  clientOrigins: str('CLIENT_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  jwtSecret: JWT_SECRET,
  jwtExpiresIn: str('JWT_EXPIRES_IN', '2h'),
  cookieName: str('COOKIE_NAME', 'cgs_session'),
  csrfCookieName: str('CSRF_COOKIE_NAME', 'cgs_csrf'),
  cookieSecure: bool('COOKIE_SECURE', NODE_ENV === 'production'),
  sessionTtlMinutes: int('SESSION_TTL_MINUTES', 120),

  bootstrapAdmin: {
    email: str('BOOTSTRAP_ADMIN_EMAIL', 'admin@careerguide.local'),
    password: str('BOOTSTRAP_ADMIN_PASSWORD', ''),
    name: str('BOOTSTRAP_ADMIN_NAME', 'System Administrator'),
  },

  rateLimitWindowMs: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMax: int('RATE_LIMIT_MAX', 300),
  authRateLimitMax: int('AUTH_RATE_LIMIT_MAX', 10),

  ai: {
    provider: AI_PROVIDER as 'none' | 'gemini' | 'openai',
    geminiApiKey: str('GEMINI_API_KEY'),
    geminiModel: str('GEMINI_MODEL', 'gemini-2.0-flash'),
    openaiApiKey: str('OPENAI_API_KEY'),
    openaiModel: str('OPENAI_MODEL', 'gpt-4o-mini'),
    timeoutMs: int('AI_TIMEOUT_MS', 30000),
    maxOutputTokens: int('AI_MAX_OUTPUT_TOKENS', 2600),
  },

  mail: {
    enabled: bool('MAIL_ENABLED', false),
    host: str('MAIL_HOST'),
    port: int('MAIL_PORT', 587),
    secure: bool('MAIL_SECURE', false),
    user: str('MAIL_USER'),
    password: str('MAIL_PASSWORD'),
    from: str('MAIL_FROM', 'CareerGuide <no-reply@careerguide.local>'),
  },

  attemptSweepIntervalMs: int('ATTEMPT_SWEEP_INTERVAL_MS', 60000),
} as const;

export function assertValidConfig(): void {
  if (env.startupErrors.length > 0) {
    throw new Error('Invalid server configuration:\n- ' + env.startupErrors.join('\n- '));
  }
}
