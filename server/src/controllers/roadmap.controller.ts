import type { Request, Response } from 'express';
import { z } from 'zod';
import { RoadmapModel } from '../models/Roadmap.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import { recomputeProgress } from '../services/recommendations/roadmapService.js';

const assignSchema = z.object({ counsellorId: z.string().nullable() });

/** Normalises a roadmap document into a stable public shape. */
function serialiseRoadmap(roadmap: Record<string, any>) {
  return {
    id: String(roadmap._id),
    candidateId: String(roadmap.candidate),
    careerId: String(roadmap.career),
    reportId: String(roadmap.report),
    scoringVersion: roadmap.scoringVersion,
    title: roadmap.title,
    summary: roadmap.summary,
    currentDemonstratedSkills: roadmap.currentDemonstratedSkills ?? [],
    priorityGaps: roadmap.priorityGaps ?? [],
    items: (roadmap.items ?? []).map((item: Record<string, any>) => ({
      id: String(item._id),
      order: item.order,
      title: item.title,
      description: item.description,
      skillCode: item.skillCode ?? null,
      kind: item.kind,
      stage: item.stage,
      estimatedHours: item.estimatedHours,
      completionCriteria: item.completionCriteria,
      resourceLinks: item.resourceLinks ?? [],
      status: item.status,
      startedAt: item.startedAt ?? null,
      completedAt: item.completedAt ?? null,
    })),
    milestones: roadmap.milestones ?? [],
    progressPercent: roadmap.progressPercent ?? 0,
    sourceReportTitle: roadmap.sourceReportTitle,
    lastActivityAt: roadmap.lastActivityAt,
    createdAt: roadmap.createdAt,
  };
}

/** Confirms the caller may act on the given roadmap. */
async function loadRoadmapForUser(roadmapId: string, req: Request) {
  const roadmap = await RoadmapModel.findById(roadmapId);
  if (!roadmap) throw ApiError.notFound('Roadmap not found.');

  if (String(roadmap.candidate) === req.user!.id) return roadmap;

  if (req.user!.permissions.includes('reports:read-assigned')) {
    if (req.user!.role === 'counsellor') {
      const target = await UserModel.findById(roadmap.candidate).select('assignedCounsellor');
      if (!target?.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This roadmap belongs to a candidate who is not assigned to you.');
      }
    }
    return roadmap;
  }

  throw ApiError.forbidden('You may only access your own roadmaps.');
}

export const listRoadmaps = asyncHandler(async (req: Request, res: Response) => {
  let candidateId = req.user!.id;
  if (req.query.candidateId && String(req.query.candidateId) !== req.user!.id) {
    if (!req.user!.permissions.includes('reports:read-assigned')) {
      throw ApiError.forbidden('You may only view your own roadmaps.');
    }
    candidateId = String(req.query.candidateId);
    if (req.user!.role === 'counsellor') {
      const target = await UserModel.findById(candidateId).select('assignedCounsellor');
      if (!target?.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This candidate is not assigned to you.');
      }
    }
  }

  const roadmaps = await RoadmapModel.find({ candidate: candidateId }).sort({ createdAt: -1 }).lean();
  return ok(res, { roadmaps: roadmaps.map((r) => serialiseRoadmap(r as never)) }, 'Learning roadmaps.');
});

export const getRoadmap = asyncHandler(async (req: Request, res: Response) => {
  const roadmap = await loadRoadmapForUser(req.params.id, req);
  return ok(res, { roadmap: serialiseRoadmap(roadmap.toObject() as never) }, 'Learning roadmap.');
});

/**
 * Updates an item's status. This is a genuine user action, so it is the only
 * thing that can mark roadmap work as started or completed.
 */
export const updateRoadmapItem = asyncHandler(async (req: Request, res: Response) => {
  const roadmap = await loadRoadmapForUser(req.params.id, req);
  const { status } = req.body as { status: 'not_started' | 'in_progress' | 'completed' };

  if (String(roadmap.candidate) !== req.user!.id) {
    throw ApiError.forbidden('Only the candidate can update their own roadmap progress.');
  }

  const item = roadmap.items.find((i) => String(i._id) === req.params.itemId);
  if (!item) throw ApiError.notFound('Roadmap item not found.');

  const now = new Date();
  if (status === 'in_progress' && !item.startedAt) item.startedAt = now;
  if (status === 'completed') {
    if (!item.startedAt) item.startedAt = now;
    item.completedAt = now;
  } else {
    item.completedAt = undefined;
  }
  item.status = status;

  recomputeProgress(roadmap as never);
  await roadmap.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'roadmap.item_update',
      category: 'access',
      targetType: 'Roadmap',
      targetId: String(roadmap._id),
      message: `Roadmap item "${item.title}" marked as ${status}.`,
      metadata: { status, progressPercent: roadmap.progressPercent },
    }),
  );

  return ok(res, { roadmap: serialiseRoadmap(roadmap.toObject() as never) }, 'Roadmap updated.');
});
