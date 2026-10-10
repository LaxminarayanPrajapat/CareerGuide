import { env } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (env.logLevel as Level) ?? 'info';
const threshold = LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info;

/** Keys that must never appear in a log line. */
const REDACT_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'csrf',
  'csrftoken',
  'sessiontoken',
  'geminiapikey',
  'openaiapikey',
]);

function redact(input: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (Array.isArray(input)) return input.slice(0, 20).map((v) => redact(v, depth + 1));
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (REDACT_KEYS.has(key.toLowerCase())) {
        out[key] = '[redacted]';
      } else {
        out[key] = redact(value, depth + 1);
      }
    }
    return out;
  }
  if (typeof input === 'string' && input.length > 500) return input.slice(0, 500) + '...[truncated]';
  return input;
}

function write(level: Level, event: string, context?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < threshold) return;
  if (env.isTest) return; // keep the test output readable

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => write('debug', event, context),
  info: (event: string, context?: Record<string, unknown>) => write('info', event, context),
  warn: (event: string, context?: Record<string, unknown>) => write('warn', event, context),
  error: (event: string, context?: Record<string, unknown>) => write('error', event, context),
};
