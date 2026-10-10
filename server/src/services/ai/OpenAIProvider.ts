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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    return env.ai.provider === 'openai' && env.ai.openaiApiKey.length > 0;
  }

  health(): AIProviderHealth {
    const configured = this.isConfigured();
    return {
      name: this.name,
      configured,
      model: env.ai.openaiModel,
      reason: configured
        ? undefined
        : env.ai.provider !== 'openai'
          ? `AI_PROVIDER is "${env.ai.provider}", so the OpenAI provider is not selected.`
          : 'OPENAI_API_KEY is not set.',
    };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    if (!this.isConfigured()) {
      throw new AIProviderError(this.name, 'not_configured', this.health().reason ?? 'OpenAI is not configured.');
    }
    const startedAt = Date.now();
    const timeoutMs = request.timeoutMs ?? env.ai.timeoutMs;

    const response = await fetchWithTimeout(
      OPENAI_URL,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.ai.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: env.ai.openaiModel,
          temperature: 0.3,
          max_tokens: request.maxOutputTokens ?? env.ai.maxOutputTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ],
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
        `OpenAI returned HTTP ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      throw new AIProviderError(this.name, 'invalid_response', 'OpenAI returned an empty response.');
    }

    try {
      extractJson(text);
    } catch {
      throw new AIProviderError(this.name, 'invalid_response', 'OpenAI response did not contain valid JSON.');
    }

    return { text, provider: this.name, model: env.ai.openaiModel, latencyMs: Date.now() - startedAt };
  }
}
