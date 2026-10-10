/**
 * Provider abstraction for the AI explanation layer.
 *
 * The provider is only ever allowed to *explain* results that the deterministic
 * engine has already produced. It never decides scores, never chooses careers
 * and never grants permissions. If no provider is configured, or the call
 * fails, the recommendation service falls back to template text.
 */

export interface AICompletionRequest {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface AICompletionResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface AIProviderHealth {
  name: string;
  configured: boolean;
  model: string;
  /** Explains why the provider cannot be used, when it cannot. */
  reason?: string;
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  health(): AIProviderHealth;
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}

export class AIProviderError extends Error {
  readonly provider: string;
  readonly reason: 'not_configured' | 'timeout' | 'http_error' | 'invalid_response' | 'network';

  constructor(
    provider: string,
    reason: AIProviderError['reason'],
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.reason = reason;
  }
}

/** Shared fetch wrapper with an explicit timeout - never leaves a hanging request. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new AIProviderError(provider, 'timeout', `${provider} request timed out after ${timeoutMs}ms.`);
    }
    throw new AIProviderError(provider, 'network', `${provider} request failed: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts JSON from a model response that may be wrapped in prose or fences. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the outermost balanced object/array in the text.
    const start = candidate.search(/[[{]/);
    if (start === -1) throw new Error('No JSON structure found in the provider response.');
    const open = candidate[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i += 1) {
      const char = candidate[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === open) depth += 1;
      if (char === close) {
        depth -= 1;
        if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
      }
    }
    throw new Error('Provider response contained an unterminated JSON structure.');
  }
}
