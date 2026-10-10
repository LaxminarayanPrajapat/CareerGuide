import type { Request, Response } from 'express';
import { CareerModel } from '../models/Career.js';
import { QuestionModel } from '../models/Question.js';
import { SkillModel } from '../models/Skill.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok, paginationMeta } from '../utils/response.js';
import { escapeRegExp } from '../utils/pagination.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import { loadActiveCareers, buildCandidateProfile } from '../services/recommendations/recommendationService.js';
import { computeCareerMatch, rankMatches } from '../services/careers/compatibilityService.js';
import type { CareerCreateInput, SkillCreateInput, SkillUpdateInput } from '../schemas/career.schema.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function hydrateRequirementSkills(
  requirements: Array<{ skill: string; [key: string]: unknown }>,
): Promise<Array<Record<string, unknown>>> {
  const ids = requirements.map((r) => r.skill);
  const skills = await SkillModel.find({ _id: { $in: ids } }).select('code name category').lean();
  const map = new Map(skills.map((s) => [String(s._id), s]));
  return requirements.map((r) => {
    const skill = map.get(String(r.skill));
    if (!skill) {
      throw ApiError.validation('Unknown skill reference.', [
        { field: 'requiredSkills', message: `Skill ${r.skill} does not exist.` },
      ]);
    }
    return {
      skill: skill._id,
      skillCode: skill.code,
      skillName: skill.name,
      requiredLevel: r.requiredLevel ?? 50,
      weight: r.weight ?? 1,
      importance: r.importance ?? 'core',
      developmentFocus: r.developmentFocus ?? '',
    };
  });
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export const listSkills = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as { page: number; limit: number; category?: string; isActive?: boolean; search?: string };
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) filter.$or = [{ name: { $regex: escapeRegExp(query.search), $options: 'i' } }, { code: { $regex: escapeRegExp(query.search), $options: 'i' } }];

  const [items, total] = await Promise.all([
    SkillModel.find(filter).sort({ category: 1, name: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    SkillModel.countDocuments(filter),
  ]);

  return ok(res, { skills: items }, 'Skills.', paginationMeta(query.page, query.limit, total));
});

export const createSkill = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SkillCreateInput;
  const skill = await SkillModel.create({ ...body, code: body.code.toUpperCase(), isSample: false });
  await recordAudit(
    auditFromRequest(req, {
      action: 'skill.create',
      category: 'admin',
      targetType: 'Skill',
      targetId: String(skill._id),
      message: `Created skill "${skill.name}".`,
      metadata: { category: skill.category },
    }),
  );
  return created(res, { skill }, 'Skill created.');
});

export const updateSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await SkillModel.findById(req.params.id);
  if (!skill) throw ApiError.notFound('Skill not found.');
  const body = req.body as SkillUpdateInput;
  Object.assign(skill, body);
  await skill.save();
  await recordAudit(
    auditFromRequest(req, {
      action: 'skill.update',
      category: 'admin',
      targetType: 'Skill',
      targetId: String(skill._id),
      message: `Updated skill "${skill.name}".`,
    }),
  );
  return ok(res, { skill }, 'Skill updated.');
});

export const deleteSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await SkillModel.findById(req.params.id);
  if (!skill) throw ApiError.notFound('Skill not found.');

  const [careerCount, questionCount] = await Promise.all([
    CareerModel.countDocuments({ 'requiredSkills.skill': skill._id }),
    QuestionModel.countDocuments({ 'skillMappings.skill': skill._id }),
  ]);
  if (careerCount > 0 || questionCount > 0) {
    throw ApiError.conflict(
      `This skill is referenced by ${careerCount} career definition(s) and ${questionCount} question(s). Deactivate it instead so existing scores and reports stay valid.`,
    );
  }

  await skill.deleteOne();
  await recordAudit(
    auditFromRequest(req, {
      action: 'skill.delete',
      category: 'admin',
      severity: 'warning',
      targetType: 'Skill',
      targetId: String(skill._id),
      message: `Deleted unused skill "${skill.name}".`,
    }),
  );
  return ok(res, { deleted: true }, 'Skill deleted.');
});

// ---------------------------------------------------------------------------
// Careers
// ---------------------------------------------------------------------------

export const listCareers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as { page: number; limit: number; category?: string; isActive?: boolean; search?: string };
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    filter.$or = [
      { title: { $regex: escapeRegExp(query.search), $options: 'i' } },
      { description: { $regex: escapeRegExp(query.search), $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    CareerModel.find(filter).sort({ title: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    CareerModel.countDocuments(filter),
  ]);

  return ok(res, { careers: items }, 'Career catalogue.', paginationMeta(query.page, query.limit, total));
});

export const getCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await CareerModel.findById(req.params.id).lean();
  if (!career) throw ApiError.notFound('Career not found.');
  return ok(res, { career }, 'Career definition.');
});

export const createCareer = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CareerCreateInput;
  const requiredSkills = await hydrateRequirementSkills(body.requiredSkills as never);

  const career = await CareerModel.create({
    ...body,
    slug: slugify(body.title),
    requiredSkills,
    isSample: false,
    sourceNote:
      'Added through the administration interface. Verify against current industry guidance before relying on it.',
  });

  await recordAudit(
    auditFromRequest(req, {
      action: 'career.create',
      category: 'admin',
      targetType: 'Career',
      targetId: String(career._id),
      message: `Created career definition "${career.title}".`,
      metadata: { careerId: String(career._id) },
    }),
  );

  return created(res, { career }, 'Career created.');
});

export const updateCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await CareerModel.findById(req.params.id);
  if (!career) throw ApiError.notFound('Career not found.');

  const body = req.body as Partial<CareerCreateInput>;
  if (body.requiredSkills) {
    body.requiredSkills = (await hydrateRequirementSkills(body.requiredSkills as never)) as never;
  }
  Object.assign(career, body);
  await career.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'career.update',
      category: 'admin',
      targetType: 'Career',
      targetId: String(career._id),
      message: `Updated career definition "${career.title}".`,
    }),
  );

  return ok(res, { career }, 'Career updated.');
});

export const deleteCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await CareerModel.findById(req.params.id);
  if (!career) throw ApiError.notFound('Career not found.');
  await career.deleteOne();
  await recordAudit(
    auditFromRequest(req, {
      action: 'career.delete',
      category: 'admin',
      severity: 'warning',
      targetType: 'Career',
      targetId: String(career._id),
      message: `Deleted career definition "${career.title}".`,
    }),
  );
  return ok(res, { deleted: true }, 'Career deleted.');
});

/**
 * Live compatibility preview for a candidate. Available to the candidate
 * themselves and to staff with the `reports:read-assigned` permission.
 */
export const previewCompatibility = asyncHandler(async (req: Request, res: Response) => {
  let candidateId = req.user!.id;
  if (req.params.id && req.query.candidateId) {
    candidateId = String(req.query.candidateId);
    if (candidateId !== req.user!.id) {
      if (!req.user!.permissions.includes('reports:read-assigned')) {
        throw ApiError.forbidden('You may only view your own compatibility preview.');
      }
      if (req.user!.role === 'counsellor') {
        const target = await UserModel.findById(candidateId).select('assignedCounsellor');
        if (!target?.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
          throw ApiError.forbidden('This candidate is not assigned to you.');
        }
      }
    }
  }

  const [profile, careers] = await Promise.all([buildCandidateProfile(candidateId), loadActiveCareers()]);

  let matches = careers.map((career) => computeCareerMatch(career, profile));
  if (req.params.id) matches = matches.filter((m) => m.careerId === String(req.params.id));
  if (req.query.minScore) matches = matches.filter((m) => m.compatibilityScore >= Number(req.query.minScore));

  const ranked = rankMatches(matches, 20);

  return ok(
    res,
    {
      scoringVersion: 'compatibility-v1.0.0',
      completedAssessments: profile.completedAssessments,
      dataCoverage: ranked.length > 0 ? ranked[0].dataCoverage : 0,
      matches: ranked,
    },
    'Compatibility preview computed from the deterministic scoring engine.',
  );
});
