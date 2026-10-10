import type { Request, Response } from 'express';
import { SystemSettingModel } from '../models/SystemSetting.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { env } from '../config/env.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import { getProviderStatus } from '../services/ai/aiProviderRegistry.js';

/**
 * Secrets are never stored in this collection. AI credentials live in
 * environment variables only; this endpoint reports *whether* a provider is
 * configured, never the key itself.
 */
export const listSettings = asyncHandler(async (_req: Request, res: Response) => {
  const payload = await buildSettingsPayload();
  return ok(res, payload, 'System settings.');
});

async function buildSettingsPayload() {
  const settings = await SystemSettingModel.find().sort({ category: 1, key: 1 }).lean();
  const provider = getProviderStatus();

  return {
    settings: settings.map((s) => ({
      key: s.key,
      value: s.value,
      valueType: s.valueType,
      category: s.category,
      label: s.label,
      description: s.description,
      isSecretBacked: s.isSecretBacked,
      updatedAt: s.updatedAt,
    })),
    aiProvider: {
      selected: env.ai.provider,
      usable: provider.usable,
      activeProvider: provider.activeProvider,
      reason: provider.reason,
      providers: provider.providers.map((p) => ({
        name: p.name,
        configured: p.configured,
        model: p.model,
        reason: p.reason ?? null,
      })),
      keysInEnvironment: {
        gemini: env.ai.geminiApiKey.length > 0,
        openai: env.ai.openaiApiKey.length > 0,
      },
      note: 'API keys are read from server environment variables and are never stored in the database or returned by this API.',
    },
    runtime: {
      nodeEnv: env.nodeEnv,
      port: env.port,
      clientOrigins: env.clientOrigins,
      cookieSecure: env.cookieSecure,
      mailEnabled: env.mail.enabled,
    },
  };
}

const ALLOWED_SETTINGS: Record<string, { valueType: 'string' | 'number' | 'boolean' | 'json'; category: string; label: string; description: string }> = {
  'general.siteName': { valueType: 'string', category: 'general', label: 'Site name', description: 'Shown in the header and on printed reports.' },
  'general.assessmentNotice': { valueType: 'string', category: 'general', label: 'Assessment notice', description: 'Message shown before a candidate starts an attempt.' },
  'assessment.defaultPassPercentage': { valueType: 'number', category: 'assessment', label: 'Default passing percentage', description: 'Used when an administrator does not set a threshold.' },
  'assessment.showExplanations': { valueType: 'boolean', category: 'assessment', label: 'Show explanations after submission', description: 'Whether answer explanations are revealed in the result review.' },
  'report.minDataCoverage': { valueType: 'number', category: 'report', label: 'Minimum data coverage', description: 'Coverage below which a report is marked low confidence.' },
  'report.disclaimer': { valueType: 'string', category: 'report', label: 'Report disclaimer', description: 'Additional disclaimer text appended to generated reports.' },
  'ai.enabled': { valueType: 'boolean', category: 'ai', label: 'Enable AI narrative', description: 'When off, reports always use deterministic template explanations.' },
};

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as Record<string, unknown>;

  for (const key of Object.keys(payload)) {
    if (!(key in ALLOWED_SETTINGS)) {
      throw ApiError.validation('Unknown setting.', [
        { field: key, message: 'This setting is not part of the allowed configuration list.' },
      ]);
    }
  }

  const updates = Object.entries(payload).map(([key, value]) => {
    const spec = ALLOWED_SETTINGS[key];
    const typed: string | number | boolean =
      spec.valueType === 'number'
        ? Number(value)
        : spec.valueType === 'boolean'
          ? value === true || value === 'true'
          : String(value);

    if (spec.valueType === 'number' && !Number.isFinite(typed as number)) {
      throw ApiError.validation('Invalid setting value.', [{ field: key, message: 'Expected a number.' }]);
    }

    return {
      updateOne: {
        filter: { key },
        update: {
          $set: {
            value: typed,
            valueType: spec.valueType,
            category: spec.category as 'general' | 'assessment' | 'ai' | 'security' | 'report',
            label: spec.label,
            description: spec.description,
            isSecretBacked: false,
            updatedBy: req.user!.id,
          },
        },
        upsert: true,
      },
    };
  });

  if (updates.length > 0) {
    await SystemSettingModel.bulkWrite(updates as never[]);
  }

  await recordAudit(
    auditFromRequest(req, {
      action: 'settings.update',
      category: 'admin',
      severity: 'warning',
      message: `Updated application settings: ${Object.keys(payload).join(', ')}.`,
    }),
  );

  const payloadOut = await buildSettingsPayload();
  return ok(res, payloadOut, 'Settings updated.');
});

export const getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await SystemSettingModel.find({ category: 'general' }).lean();
  const provider = getProviderStatus();
  return ok(
    res,
    {
      siteName: settings.find((s) => s.key === 'general.siteName')?.value ?? 'AI Career Guide',
      assessmentNotice:
        settings.find((s) => s.key === 'general.assessmentNotice')?.value ??
        'Assessments are timed and scored on the server. Once submitted, an attempt cannot be changed.',
      aiEnabled: provider.usable,
      aiProvider: provider.activeProvider,
    },
    'Public settings.',
  );
});
