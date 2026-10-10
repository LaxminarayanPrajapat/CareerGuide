import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIProviderError, extractJson, fetchWithTimeout } from '../services/ai/AIProvider.js';
import { GeminiProvider } from '../services/ai/GeminiProvider.js';
import { OpenAIProvider } from '../services/ai/OpenAIProvider.js';
import { env } from '../config/env.js';

/**
 * These tests exercise the provider HTTP layer with a stubbed `fetch`.
 *
 * No real API call is made and no API key is required. The goal is to verify
 * that a bad, slow or malformed provider response is turned into a controlled,
 * typed failure - never an unhandled exception or a silently accepted result.
 */

const originalFetch = globalThis.fetch;
const originalProvider = env.ai.provider;
const originalGeminiKey = env.ai.geminiApiKey;
const originalOpenAiKey = env.ai.openaiApiKey;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function geminiResponse(text: string) {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });
}

function openAiResponse(text: string) {
  return jsonResponse({ choices: [{ message: { content: text } }] });
}

describe('AI provider HTTP layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    env.ai.geminiApiKey = 'test-gemini-key';
    env.ai.openaiApiKey = 'test-openai-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    env.ai.provider = originalProvider;
    env.ai.geminiApiKey = originalGeminiKey;
    env.ai.openaiApiKey = originalOpenAiKey;
    vi.restoreAllMocks();
  });

  describe('configuration reporting', () => {
    it('reports Gemini as unconfigured when no key is set', () => {
      env.ai.provider = 'gemini';
      env.ai.geminiApiKey = '';
      const provider = new GeminiProvider();
      expect(provider.isConfigured()).toBe(false);
      const health = provider.health();
      expect(health.configured).toBe(false);
      expect(health.reason).toMatch(/GEMINI_API_KEY/);
    });

    it('reports why a provider is not selected', () => {
      env.ai.provider = 'openai';
      const provider = new GeminiProvider();
      expect(provider.isConfigured()).toBe(false);
      expect(provider.health().reason).toMatch(/AI_PROVIDER/);
    });

    it('reports OpenAI as unconfigured when it is not selected', () => {
      env.ai.provider = 'gemini';
      const provider = new OpenAIProvider();
      expect(provider.isConfigured()).toBe(false);
      expect(provider.health().reason).toBeTruthy();
    });

    it('never exposes the API key in its health report', () => {
      env.ai.provider = 'gemini';
      env.ai.geminiApiKey = 'super-secret-key';
      const serialised = JSON.stringify(new GeminiProvider().health());
      expect(serialised).not.toContain('super-secret-key');
    });
  });

  describe('not-configured behaviour', () => {
    it('throws a typed not_configured error instead of calling out', async () => {
      env.ai.provider = 'none';
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const provider = new GeminiProvider();
      await expect(provider.complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'not_configured',
      });
      // No network call is attempted when the provider is not configured.
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Gemini transport', () => {
    beforeEach(() => {
      env.ai.provider = 'gemini';
    });

    it('returns the parsed response text', async () => {
      const fetchMock = vi.fn().mockResolvedValue(geminiResponse('{"overview":"ok"}'));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await new GeminiProvider().complete({ system: 's', prompt: 'p' });
      expect(result.text).toBe('{"overview":"ok"}');
      expect(result.provider).toBe('gemini');
      expect(typeof result.latencyMs).toBe('number');

      // The key travels in a header, never in the URL.
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).not.toContain('super-secret-key');
      expect(init.headers['x-goog-api-key']).toBe('test-gemini-key');
      expect(JSON.parse(init.body).generationConfig.responseMimeType).toBe('application/json');
    });

    it('maps a non-2xx response to a typed http_error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'quota' }, 429)) as unknown as typeof fetch;
      await expect(new GeminiProvider().complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'http_error',
      });
    });

    it('reports a blocked request rather than returning empty text', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } })) as unknown as typeof fetch;
      await expect(new GeminiProvider().complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'invalid_response',
      });
    });

    it('rejects an empty completion', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ candidates: [] })) as unknown as typeof fetch;
      await expect(new GeminiProvider().complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'invalid_response',
      });
    });

    it('rejects a non-JSON completion', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(geminiResponse('I am afraid I cannot comply.')) as unknown as typeof fetch;
      await expect(new GeminiProvider().complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'invalid_response',
      });
    });
  });

  describe('OpenAI transport', () => {
    beforeEach(() => {
      env.ai.provider = 'openai';
    });

    it('returns the parsed response text and requests JSON output', async () => {
      const fetchMock = vi.fn().mockResolvedValue(openAiResponse('{"overview":"ok"}'));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await new OpenAIProvider().complete({ system: 's', prompt: 'p' });
      expect(result.text).toBe('{"overview":"ok"}');
      expect(result.provider).toBe('openai');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/chat/completions');
      expect(init.headers.authorization).toBe('Bearer test-openai-key');
      expect(JSON.parse(init.body).response_format).toEqual({ type: 'json_object' });
    });

    it('maps a non-2xx response to a typed http_error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 500)) as unknown as typeof fetch;
      await expect(new OpenAIProvider().complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'http_error',
      });
    });

    it('rejects an empty completion', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [] })) as unknown as typeof fetch;
      await expect(new OpenAIProvider().complete({ system: 's', prompt: 'p' })).rejects.toMatchObject({
        reason: 'invalid_response',
      });
    });
  });

  describe('fetchWithTimeout', () => {
    it('aborts and raises a timeout error when the provider hangs', async () => {
      globalThis.fetch = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      ) as unknown as typeof fetch;

      await expect(fetchWithTimeout('http://example.test', {}, 50, 'test')).rejects.toMatchObject({
        reason: 'timeout',
        provider: 'test',
      });
    });

    it('maps a connection failure to a network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
      await expect(fetchWithTimeout('http://example.test', {}, 1000, 'test')).rejects.toMatchObject({
        reason: 'network',
      });
    });
  });

  describe('extractJson', () => {
    it('parses a plain JSON object', () => {
      expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    });

    it('parses JSON wrapped in a markdown fence', () => {
      expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('parses JSON embedded in surrounding prose', () => {
      expect(extractJson('Here you go:\n{"a":1}\nHope that helps!')).toEqual({ a: 1 });
    });

    it('handles braces inside strings', () => {
      expect(extractJson('{"note":"a } b","a":2}')).toEqual({ note: 'a } b', a: 2 });
    });

    it('throws a clear error when no JSON is present', () => {
      expect(() => extractJson('no json here')).toThrow(/No JSON structure/);
    });
  });
});

describe('AIProviderError', () => {
  it('carries the provider and a machine-readable reason', () => {
    const error = new AIProviderError('gemini', 'timeout', 'took too long');
    expect(error).toBeInstanceOf(Error);
    expect(error.provider).toBe('gemini');
    expect(error.reason).toBe('timeout');
    expect(error.message).toBe('took too long');
  });
});
