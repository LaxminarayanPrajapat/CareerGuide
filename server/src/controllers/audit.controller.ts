import type { Request, Response } from 'express';
import { AuditLogModel } from '../models/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, paginationMeta } from '../utils/response.js';
import { escapeRegExp } from '../utils/pagination.js';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    limit: number;
    category?: string;
    action?: string;
    outcome?: string;
    severity?: string;
    from?: string;
    to?: string;
    search?: string;
  };

  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.action) filter.action = { $regex: escapeRegExp(query.action), $options: 'i' };
  if (query.outcome) filter.outcome = query.outcome;
  if (query.severity) filter.severity = query.severity;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  if (query.search) {
    const rx = { $regex: escapeRegExp(query.search), $options: 'i' };
    filter.$or = [{ message: rx }, { actorEmail: rx }, { action: rx }];
  }

  const [items, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select('-__v')
      .lean(),
    AuditLogModel.countDocuments(filter),
  ]);

  const summary = await AuditLogModel.aggregate([
    { $match: filter },
    { $group: { _id: { category: '$category', severity: '$severity' }, count: { $sum: 1 } } },
  ]);

  return ok(
    res,
    {
      logs: items.map((l) => ({
        id: String(l._id),
        actor: l.actor ? String(l.actor) : null,
        actorEmail: l.actorEmail ?? null,
        actorRole: l.actorRole ?? null,
        action: l.action,
        category: l.category,
        targetType: l.targetType ?? null,
        targetId: l.targetId ?? null,
        outcome: l.outcome,
        message: l.message,
        metadata: l.metadata ?? null,
        severity: l.severity,
        createdAt: l.createdAt,
      })),
      summary: summary.map((s) => ({ category: s._id.category, severity: s._id.severity, count: s.count })),
    },
    'Audit log.',
    paginationMeta(query.page, query.limit, total),
  );
});
