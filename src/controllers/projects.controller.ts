import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Project, PROJECT_STATUSES, PROJECT_TYPES } from '../models/Project';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { EngineContributionMap } from '../models/EngineContributionMap';
import { SignOff } from '../models/SignOff';
import { createProjectSchema, updateProjectSchema } from '../validation/project.schema';

export async function listProjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tier, status, projectType, search, dateFrom, dateTo, page = '1', limit = '20' } = req.query;

    const filter: Record<string, unknown> = {};
    if (tier) filter['dataReadinessTier'] = Number(tier);
    if (status) filter['status'] = status;
    if (projectType) filter['projectType'] = projectType;
    if (search) filter['$or'] = [
      { name: { $regex: search, $options: 'i' } },
      { referenceCode: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
    if (dateFrom || dateTo) {
      filter['duration.start'] = {};
      if (dateFrom) (filter['duration.start'] as Record<string, unknown>)['$gte'] = new Date(dateFrom as string);
      if (dateTo) (filter['duration.start'] as Record<string, unknown>)['$lte'] = new Date(dateTo as string);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    const [projects, total] = await Promise.all([
      Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Project.countDocuments(filter),
    ]);

    res.json({ projects, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await Project.findById(req.params['id']).lean();
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createProjectSchema.parse(req.body);
    const project = await Project.create(body);

    // Auto-create linked documents, seeding sectionA from the project fields
    await Promise.all([
      ProjectTemplate.create({
        project: project._id,
        sectionA: {
          name: project.name,
          referenceCode: project.referenceCode,
          projectType: project.projectType,
          location: project.location,
          operatingEnvironment: project.operatingEnvironment,
          client: project.client,
          operator: project.operator,
          duration: project.duration,
          valueScale: project.valueScale,
          valueAmount: project.valueAmount,
          description: project.description,
          dataReadinessTier: project.dataReadinessTier,
        },
      }),
      EngineContributionMap.create({ project: project._id }),
      SignOff.create({ project: project._id }),
    ]);

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateProjectSchema.parse(req.body);

    // Only steering_committee/admin can set status to signed-off
    if (body.status === 'signed-off' && req.user?.role !== 'steering_committee' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Only steering committee or admin can set project to signed-off' });
      return;
    }

    const project = await Project.findByIdAndUpdate(req.params['id'], body, { new: true, runValidators: true });
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await Project.findByIdAndDelete(req.params['id']);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    await Promise.all([
      ProjectTemplate.deleteOne({ project: project._id }),
      EngineContributionMap.deleteOne({ project: project._id }),
      SignOff.deleteOne({ project: project._id }),
    ]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getProjectMeta(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ projectTypes: PROJECT_TYPES, statuses: PROJECT_STATUSES });
  } catch (err) {
    next(err);
  }
}
