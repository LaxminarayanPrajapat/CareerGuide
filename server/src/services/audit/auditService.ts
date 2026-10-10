import { AuditLogModel, type AuditLogDocumentFields } from '../../models/auditLog.js';
import { logger } from '../../utils/logger.js';
import type { Request } from 'express';

export interface AuditInput {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  category: AuditLogDocumentFields['category'];
  targetType?: string;
  targetId?: string;
  outcome?: AuditLogDocumentFields['outcome'];
  message: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditLogDocumentFields['severity'];
}

/**
 * Writes a security / administrative audit record.
 *
 * Audit failures must never break the request they describe, so errors are
 * logged and swallowed. Metadata is restricted to primitive values to avoid
 * accidentally persisting candidate answer payloads.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const safeMetadata = sanitiseMetadata(input.metadata);
    await AuditLogModel.create({
      actor: input.actorId,
      actorEmail: input.actorEmail?.toLowerCase(),
      actorRole: input.actorRole,
      action: input.action,
      category: input.category,
      targetType: input.targetType,
      targetId: input.targetId ? String(input.targetId) : undefined,
      outcome: input.outcome ?? 'success',
      message: input.message.slice(0, 1000),
      metadata: safeMetadata,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      severity: input.severity ?? 'info',
    });
  } catch (error) {
    logger.error('audit.write_failed', { action: input.action, message: (error as Error).message });
  }
}

export function auditFromRequest(
  req: Request,
  base: Omit<AuditInput, 'actorId' | 'actorEmail' | 'actorRole' | 'ipAddress' | 'userAgent'> & {
    severity?: AuditLogDocumentFields['severity'];
  },
): AuditInput {
  return {
    ...base,
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
  };
}

const ALLOWED_METADATA_KEYS = new Set([
  'assessmentId',
  'attemptId',
  'reportId',
  'userId',
  'candidateId',
  'careerId',
  'questionId',
  'questionCount',
  'durationMinutes',
  'score',
  'percentage',
  'scoringVersion',
  'aiProvider',
  'reason',
  'role',
  'previousRole',
  'field',
  'count',
  'status',
  'category',
  'scoreVersion',
  'providerConfigured',
  'keyConfigured',
  'requestId',
  'ip',
  'batch',
  'limit',
  'page',
  'deletedCount',
  'conflictCount',
]);

function sanitiseMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      out[key] = typeof value === 'string' ? value.slice(0, 200) : value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
