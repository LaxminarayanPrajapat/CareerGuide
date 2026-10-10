import { z } from 'zod';
import { extractJson, type AIProvider, type AIProviderHealth } from './AIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { logger } from '../../utils/logger.js';

export const aiNarrativeSchema = z.object({
  overview: z
    .string()
    .min(20, 'The overview must be at least 20 characters.')
    .max(1200)
    .describe('A plain-language summary of the candidate\'s assessed profile, 2-4 sentences.'),
  strengths: z
    .array(z.string().min(5).max(400))
    .min(1)
    .max(6)
    .describe('Short explanations of the strongest demonstrated skills, referencing only the supplied evidence.'),
  developmentAreas: z
    .array(z.string().min(5).max(400))
    .min(1)
    .max(6)
    .describe('Short explanations of the most important gaps to work on.'),
  careerRationale: z
    .record(z.string().min(20).max(600))
    .describe(
      'One explanation per career slug provided in the input. Keys must match the supplied career slugs exactly and nothing else.',
    ),
  roadmapGuidance: z
    .record(z.array(z.string().min(5).max(300)).max(6))
    .describe('Practical next steps keyed by career slug.'),
  motivationNotes: z
    .array(z.string().min(10).max(400))
    .max(5)
    .describe('Encouraging, realistic suggestions for keeping momentum. Never promise a job outcome.'),
});

export type AiNarrative = z.infer<typeof aiNarrativeSchema>;

export interface ProviderStatus {
  selected: string;
  activeProvider: string | null;
  usable: boolean;
  reason: string;
  providers: AIProviderHealth[];
}

const providers = [new GeminiProvider(), new OpenAIProvider()];

export function getProviderStatus(): ProviderStatus {
  const health = providers.map((p) => p.health());
  const active = providers.find((p) => p.isConfigured());
  return {
    selected: providers[0] ? (providers[0].name as string) : 'none',
    activeProvider: active?.name ?? null,
    usable: Boolean(active),
    reason: active
      ? 'An AI provider is configured and will be used to write the narrative explanation.'
      : 'No AI provider is configured. Deterministic, template-based explanations will be generated instead.',
    providers: health,
  };
}

export function activeProvider() {
  return providers.find((p) => p.isConfigured()) ?? null;
}

export interface NarrativeRequest {
  candidateSummary: {
    completedAssessments: number;
    dataCoverage: number;
    skills: Array<{ code: string; name: string; score: number; evidence: number }>;
    strongest: Array<{ code: string; name: string; score: number }>;
    weakest: Array<{ code: string; name: string; score: number }>;
    unmeasured: string[];
    preferences: Array<{ dimension: string; score: number }>;
  };
  careers: Array<{
    slug: string;
    title: string;
    compatibilityScore: number;
    confidence: string;
    dataCoverage: number;
    matched: string[];
    gaps: Array<{ name: string; gap: number }>;
    unmeasured: string[];
  }>;
}

const SYSTEM_PROMPT = [
  'You are a career guidance assistant inside an academic assessment web application.',
  'You receive ONLY the structured evidence listed in the user message. That evidence was computed by a deterministic scoring engine.',
  'Rules you must follow:',
  '1. Never invent scores, percentages, skill levels, job outcomes or hiring predictions.',
  '2. Never claim the candidate will get a job, pass an interview or succeed in a career.',
  '3. Never describe the candidate using psychological, diagnostic or personality-type language.',
  '4. Refer to personality results only as indicative working preferences.',
  '5. If evidence is missing for something, say it has not been measured yet.',
  '6. Career compatibility is an indicative compatibility score, not a probability of success.',
  '7. Use only the career slugs provided. Do not introduce any other career, company, course name or URL.',
  '8. Respond with a single JSON object and nothing else.',
].join('\n');

export function buildNarrativePrompt(input: NarrativeRequest): string {
  return [
    'Here is the verified evidence for one candidate. Write the explanation sections from it.',
    '',
    'CANDIDATE EVIDENCE (JSON):',
    JSON.stringify(input.candidateSummary, null, 1),
    '',
    'CAREER MATCHES (JSON):',
    JSON.stringify(input.careers, null, 1),
    '',
    'Return a JSON object with exactly these keys:',
    '{ "overview": string, "strengths": string[], "developmentAreas": string[],',
    '  "careerRationale": { "<career slug>": string },',
    '  "roadmapGuidance": { "<career slug>": string[] },',
    '  "motivationNotes": string[] }',
    'Use every career slug you were given as a key in careerRationale and roadmapGuidance, and no others.',
  ].join('\n');
}

/**
 * Calls the active provider and validates the response.
 *
 * Returns `null` (never throws) whenever the AI layer cannot be used, so the
 * caller can fall back to deterministic text. Invalid structures, unknown
 * career references and non-string fields are all rejected rather than
 * silently repaired.
 */
export async function generateNarrative(input: NarrativeRequest): Promise<{
  narrative: AiNarrative | null;
  provider: string;
  latencyMs?: number;
  failureReason?: string;
}> {
  const provider = activeProvider();
  if (!provider) {
    return { narrative: null, provider: 'none', failureReason: 'No AI provider is configured.' };
  }

  try {
    const completion = await provider.complete({
      system: SYSTEM_PROMPT,
      prompt: buildNarrativePrompt(input),
    });

    const parsedJson = extractJson(completion.text);
    const validated = aiNarrativeSchema.safeParse(parsedJson);

    if (!validated.success) {
      logger.warn('ai.invalid_response', {
        provider: provider.name,
        issues: validated.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return {
        narrative: null,
        provider: provider.name,
        latencyMs: completion.latencyMs,
        failureReason: 'The AI provider returned a response that failed schema validation.',
      };
    }

    const allowedSlugs = new Set(input.careers.map((c) => c.slug));
    const narrative = validated.data;

    // Drop any key the model invented. Model output never widens the scope.
    for (const key of Object.keys(narrative.careerRationale)) {
      if (!allowedSlugs.has(key)) delete narrative.careerRationale[key];
    }
    for (const key of Object.keys(narrative.roadmapGuidance)) {
      if (!allowedSlugs.has(key)) delete narrative.roadmapGuidance[key];
    }

    if (Object.keys(narrative.careerRationale).length === 0) {
      return {
        narrative: null,
        provider: provider.name,
        latencyMs: completion.latencyMs,
        failureReason: 'The AI provider did not reference any known career.',
      };
    }

    return { narrative, provider: provider.name, latencyMs: completion.latencyMs };
  } catch (error) {
    const reason = (error as Error).message;
    logger.warn('ai.provider_failed', { provider: provider.name, reason });
    return { narrative: null, provider: provider.name, failureReason: reason };
  }
}

export { GeminiProvider } from './GeminiProvider.js';
export { OpenAIProvider } from './OpenAIProvider.js';
