import { env } from '../../config/env.js';
import {
  AIProviderError,
  extractJson,
  fetchWithTimeout,
  type AICompletionRequest,
  type AICompletionResult,
  type AIProvider,
  type AIProviderHealth,
} from './AIProvider.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  isConfigured(): boolean {
    return env.ai.provider === 'gemini' && env.ai.geminiApiKey.length > 0;
  }

  health(): AIProviderHealth {
    const configured = this.isConfigured();
    return {
      name: this.name,
      configured,
      model: env.ai.geminiModel,
      reason: configured
        ? undefined
        : env.ai.provider !== 'gemini'
          ? `AI_PROVIDER is "${env.ai.provider}", so the Gemini provider is not selected.`
          : 'GEMINI_API_KEY is not set.',
    };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    if (!this.isConfigured()) {
      throw new AIProviderError(this.name, 'not_configured', this.health().reason ?? 'Gemini is not configured.');
    }
    const startedAt = Date.now();
    const timeoutMs = request.timeoutMs ?? env.ai.timeoutMs;

    const url = `${GEMINI_BASE}/models/${encodeURIComponent(env.ai.geminiModel)}:generateContent`;
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': env.ai.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: request.maxOutputTokens ?? env.ai.maxOutputTokens,
            responseMimeType: 'application/json',
          },
        }),
      },
      timeoutMs,
      this.name,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AIProviderError(
        this.name,
        'http_error',
        `Gemini returned HTTP ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };

    if (payload.promptFeedback?.blockReason) {
      throw new AIProviderError(
        this.name,
        'invalid_response',
        `Gemini blocked the request: ${payload.promptFeedback.blockReason}`,
      );
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) {
      throw new AIProviderError(this.name, 'invalid_response', 'Gemini returned an empty response.');
    }

    try {
      extractJson(text);
    } catch {
      throw new AIProviderError(this.name, 'invalid_response', 'Gemini response did not contain valid JSON.');
    }

    return { text, provider: this.name, model: env.ai.geminiModel, latencyMs: Date.now() - startedAt };
  }
}
