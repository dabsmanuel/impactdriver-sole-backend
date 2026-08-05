import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Project } from '../models/Project';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { EngineContributionMap } from '../models/EngineContributionMap';
import { SignOff } from '../models/SignOff';
import { createProjectSchema } from '../validation/project.schema';

// POST /api/client/submit — client_data_submitter creates a Flow B project
export async function submitClientProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createProjectSchema.parse(req.body);

    // Auto-generate client-prefixed reference code
    const year = new Date().getFullYear();
    const prefix = `CLT-${year}-`;
    const existing = await Project.countDocuments({ referenceCode: { $regex: `^${prefix}` } });
    let referenceCode = `${prefix}${String(existing + 1).padStart(3, '0')}`;
    const taken = await Project.exists({ referenceCode });
    if (taken) referenceCode = `${prefix}${Date.now().toString().slice(-5)}`;

    const project = await Project.create({
      ...body,
      referenceCode,
      source: 'flow-b',
      status: 'client-submitted',
      client: req.user?.company ?? body.client,
    });

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

// PATCH /api/projects/:id/classify — run rules-based ESG classification
// Accessible by: uptonville_reviewer, admin (ESG Lead triggers classification after review)
export async function classifyProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await Project.findById(req.params['id']);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    if (project.source !== 'flow-b') {
      res.status(400).json({ error: 'Classification is only available for Flow B client projects' });
      return;
    }

    const projectType = project.projectType;

    // Pull live engine data for matching project type
    const [indicatorData, regulatoryData, decisionData, allProjects] = await Promise.all([
      // Section B: indicators for this project type
      ProjectTemplate.aggregate([
        { $unwind: '$sectionB' },
        { $match: { 'sectionB.gapFlag': { $ne: true } } },
        {
          $group: {
            _id: { category: '$sectionB.category', indicatorName: '$sectionB.indicatorName' },
            projectTypes: { $addToSet: '$sectionA.projectType' },
            count: { $sum: 1 },
          },
        },
      ]),
      // Section C: regulatory standards
      ProjectTemplate.aggregate([
        { $unwind: '$sectionC' },
        { $match: { 'sectionC.gapFlag': { $ne: true }, 'sectionA.projectType': projectType } },
        { $group: { _id: '$sectionC.regulationStandard', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Section E: mitigation effectiveness
      ProjectTemplate.aggregate([
        { $unwind: '$sectionE' },
        { $match: { 'sectionA.projectType': projectType } },
        { $group: { _id: '$sectionE.effectiveness', count: { $sum: 1 } } },
      ]),
      // All projects of this type for benchmarking
      Project.countDocuments({ projectType, source: 'flow-a' }),
    ]);

    // ESG score calculation: % of indicators by category found for this project type
    const indicatorsByCategory: Record<string, { matched: number; total: number }> = {
      E: { matched: 0, total: 0 },
      S: { matched: 0, total: 0 },
      G: { matched: 0, total: 0 },
    };
    for (const ind of indicatorData) {
      const cat = ind._id.category as 'E' | 'S' | 'G';
      if (!indicatorsByCategory[cat]) continue;
      indicatorsByCategory[cat].total++;
      if ((ind.projectTypes as string[]).includes(projectType)) {
        indicatorsByCategory[cat].matched++;
      }
    }

    const esgScores = {
      E: indicatorsByCategory['E'].total > 0
        ? Math.round((indicatorsByCategory['E'].matched / indicatorsByCategory['E'].total) * 100)
        : 0,
      S: indicatorsByCategory['S'].total > 0
        ? Math.round((indicatorsByCategory['S'].matched / indicatorsByCategory['S'].total) * 100)
        : 0,
      G: indicatorsByCategory['G'].total > 0
        ? Math.round((indicatorsByCategory['G'].matched / indicatorsByCategory['G'].total) * 100)
        : 0,
    };

    // Risk level from effectiveness distribution
    const effectivenessMap: Record<string, number> = {};
    for (const d of decisionData) effectivenessMap[d._id] = d.count;
    const lowCount = effectivenessMap['low'] ?? 0;
    const total = Object.values(effectivenessMap).reduce((a, b) => a + b, 0);
    const riskLevel: 'high' | 'medium' | 'low' =
      total === 0 ? 'medium' :
      lowCount / total > 0.5 ? 'high' :
      lowCount / total > 0.25 ? 'medium' : 'low';

    // Applicable indicators
    const applicableIndicators = indicatorData
      .filter((i) => (i.projectTypes as string[]).includes(projectType))
      .map((i) => i._id.indicatorName as string)
      .slice(0, 15);

    // Applicable standards
    const applicableStandards = regulatoryData.map((r) => r._id as string);

    // Taxonomy matches from project type
    const taxonomyMatches = [
      { category: projectType, subcategory: project.operatingEnvironment, confidence: 'high' as const },
    ];

    // Benchmark position: is value amount above/at/below median for this type?
    const benchmarkPosition: 'above-average' | 'average' | 'below-average' =
      allProjects === 0 ? 'average' :
      (project.dataReadinessTier === 1) ? 'above-average' :
      (project.dataReadinessTier === 3) ? 'below-average' : 'average';

    const esgClassification = {
      taxonomyMatches,
      applicableStandards,
      esgScores,
      riskLevel,
      applicableIndicators,
      benchmarkPosition,
      classifiedAt: new Date(),
    };

    project.esgClassification = esgClassification;
    project.status = 'ai-classified';
    await project.save();

    res.json({ message: 'Project classified', project });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/esg-validate — ESG Lead validates the classification
// Accessible by: uptonville_reviewer, admin
export async function validateESGClassification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const { esgLeadNotes, override } = req.body as {
      esgLeadNotes?: string;
      override?: Partial<{ esgScores: { E: number; S: number; G: number }; riskLevel: string; applicableStandards: string[] }>;
    };

    const project = await Project.findById(id);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    if (project.source !== 'flow-b') {
      res.status(400).json({ error: 'ESG validation is only for Flow B projects' });
      return;
    }
    if (!project.esgClassification) {
      res.status(409).json({ error: 'Project must be classified first (PATCH /classify)' });
      return;
    }

    // Apply optional overrides from ESG Lead
    if (override) {
      if (override.esgScores) project.esgClassification.esgScores = override.esgScores;
      if (override.riskLevel) project.esgClassification.riskLevel = override.riskLevel as 'high' | 'medium' | 'low';
      if (override.applicableStandards) project.esgClassification.applicableStandards = override.applicableStandards;
    }

    project.esgLeadValidated = true;
    project.esgLeadValidatedBy = new Types.ObjectId(userId);
    project.esgLeadValidatedAt = new Date();
    project.esgLeadNotes = esgLeadNotes ?? '';
    project.status = 'esg-validated';
    await project.save();

    res.json({ message: 'ESG classification validated', project });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/projects/:id/report-ready — mark report ready for client
// Accessible by: impact_driver_analyst, admin, steering_committee
export async function markClientReportReady(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const project = await Project.findById(id);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    if (project.source !== 'flow-b') {
      res.status(400).json({ error: 'Report-ready flag is only for Flow B projects' });
      return;
    }
    if (!project.esgLeadValidated) {
      res.status(409).json({ error: 'ESG Lead must validate classification before report can be marked ready' });
      return;
    }

    project.clientReportReady = true;
    project.clientReportReadyAt = new Date();
    project.clientReportReadyBy = new Types.ObjectId(userId);
    project.status = 'report-ready';
    await project.save();

    res.json({ message: 'Client report marked ready', project });
  } catch (err) {
    next(err);
  }
}
