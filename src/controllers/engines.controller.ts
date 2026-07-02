import { Request, Response, NextFunction } from 'express';
import { PipelineStage } from 'mongoose';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { Project } from '../models/Project';
import { EngineContributionMap } from '../models/EngineContributionMap';
import { stringSimilarity } from '../utils/similarity';

// Shared helper: how many projects have contributed to a given engine
async function engineContributorCount(engineName: string): Promise<number> {
  const result = await EngineContributionMap.countDocuments({
    contributions: { $elemMatch: { engine: engineName, contributed: true } },
  });
  return result;
}

// Engine 1: Project Classification
export async function projectClassification(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [taxonomy, contributorCount] = await Promise.all([
      Project.aggregate([
        {
          $group: {
            _id: '$projectType',
            count: { $sum: 1 },
            environments: { $addToSet: '$operatingEnvironment' },
            statuses: { $push: '$status' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      engineContributorCount('Project Classification Engine'),
    ]);
    res.json({ taxonomy, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 2: Regulatory Rules
export async function regulatoryRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [raw, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        { $unwind: '$sectionC' },
        {
          $group: {
            _id: {
              regulationStandard: '$sectionC.regulationStandard',
              issuingBody: '$sectionC.issuingBody',
            },
            category: { $first: '$sectionC.category' },
            applications: { $push: { projectId: '$project', howItApplied: '$sectionC.howItApplied' } },
            projectCount: { $sum: 1 },
          },
        },
        { $sort: { projectCount: -1 } },
      ]),
      engineContributorCount('Regulatory Rules Engine'),
    ]);
    res.json({ rules: raw, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 3: Indicator Library
export async function indicatorLibrary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, projectType } = req.query;

    const matchStage: Record<string, unknown> = {};
    if (category) matchStage['sectionB.category'] = category;

    const [raw, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        { $unwind: '$sectionB' },
        ...(category ? [{ $match: { 'sectionB.category': category } }] : []),
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectDoc',
          },
        },
        { $unwind: '$projectDoc' },
        ...(projectType ? [{ $match: { 'projectDoc.projectType': projectType } }] : []),
        {
          $group: {
            _id: {
              indicatorName: '$sectionB.indicatorName',
              category: '$sectionB.category',
              unit: '$sectionB.unit',
            },
            measurementMethods: { $addToSet: '$sectionB.measurementMethod' },
            rationales: { $addToSet: '$sectionB.whyItMattered' },
            projectTypes: { $addToSet: '$projectDoc.projectType' },
            projectCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.category': 1, '_id.indicatorName': 1 } },
      ]),
      engineContributorCount('Indicator Library'),
    ]);

    // Flag duplicates using string similarity
    const withDuplicateFlag = raw.map((entry, idx) => {
      const name = entry['_id']?.indicatorName ?? '';
      const isDuplicate = raw.some((other, otherIdx) => {
        if (otherIdx >= idx) return false;
        return stringSimilarity(name, other['_id']?.indicatorName ?? '') > 0.85;
      });
      return { ...entry, isDuplicate };
    });

    res.json({ indicators: withDuplicateFlag, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 4: Materiality Engine
export async function materialityEngine(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [matrix, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectDoc',
          },
        },
        { $unwind: '$projectDoc' },
        { $unwind: '$sectionD' },
        { $unwind: '$sectionB' },
        {
          $group: {
            _id: {
              projectType: '$projectDoc.projectType',
              stakeholderGroup: '$sectionD.stakeholderGroup',
              esgCategory: '$sectionB.category',
            },
            materialTopics: { $addToSet: '$sectionB.indicatorName' },
            projectCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.projectType': 1, '_id.stakeholderGroup': 1 } },
      ]),
      engineContributorCount('Materiality Engine'),
    ]);
    res.json({ matrix, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 5: Stakeholder Intelligence
export async function stakeholderIntelligence(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [profiles, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        { $unwind: '$sectionD' },
        {
          $group: {
            _id: '$sectionD.stakeholderGroup',
            reportingFormats: { $addToSet: '$sectionD.reportingFormatNeeded' },
            concernsAndInterests: { $addToSet: '$sectionD.interestConcern' },
            engagementOutcomes: { $push: '$sectionD.engagementOutcome' },
            projectCount: { $sum: 1 },
          },
        },
        { $sort: { projectCount: -1 } },
      ]),
      engineContributorCount('Stakeholder Intelligence Engine'),
    ]);
    res.json({ profiles, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 6: Decision Support
export async function decisionSupport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { effectiveness, search, projectType } = req.query;

    const pipeline: PipelineStage[] = [
      { $unwind: '$sectionE' },
    ];
    if (effectiveness) pipeline.push({ $match: { 'sectionE.effectiveness': effectiveness } });
    if (search) pipeline.push({
      $match: {
        $or: [
          { 'sectionE.mitigationMeasure': { $regex: search, $options: 'i' } },
          { 'sectionE.expertReasoning': { $regex: search, $options: 'i' } },
        ],
      },
    });
    if (projectType) {
      pipeline.push({
        $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectDoc' },
      });
      pipeline.push({ $unwind: '$projectDoc' });
      pipeline.push({ $match: { 'projectDoc.projectType': projectType } });
    }
    pipeline.push({
      $group: {
        _id: {
          mitigationMeasure: '$sectionE.mitigationMeasure',
          effectiveness: '$sectionE.effectiveness',
        },
        expertReasoning: { $first: '$sectionE.expertReasoning' },
        recommendedFuture: { $first: '$sectionE.recommendedFuture' },
        evidenceForRating: { $first: '$sectionE.evidenceForRating' },
        projectCount: { $sum: 1 },
        projectIds: { $push: '$project' },
      },
    });
    pipeline.push({ $sort: { '_id.effectiveness': 1, projectCount: -1 } });

    const [measures, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate(pipeline),
      engineContributorCount('Decision Support Engine'),
    ]);
    res.json({ measures, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 7: Benchmarking
export async function benchmarking(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [distributions, esgByType, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectDoc' } },
        { $unwind: '$projectDoc' },
        { $unwind: '$sectionB' },
        {
          $group: {
            _id: { projectType: '$projectDoc.projectType', indicatorName: '$sectionB.indicatorName', category: '$sectionB.category', unit: '$sectionB.unit' },
            sectionGOutcomes: { $push: '$sectionG.outcomesAchieved' },
            stakeholderPositiveImpacts: { $push: '$sectionH.positiveImpacts' },
            projectCount: { $sum: 1 },
            projectIds: { $addToSet: '$project' },
          },
        },
        { $sort: { '_id.projectType': 1, '_id.category': 1 } },
      ]),
      // ESG coverage depth by project type — powers the stacked bar chart
      ProjectTemplate.aggregate([
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectDoc' } },
        { $unwind: '$projectDoc' },
        { $unwind: '$sectionB' },
        {
          $group: {
            _id: { projectType: '$projectDoc.projectType', category: '$sectionB.category' },
            indicatorCount: { $sum: 1 },
            uniqueProjects: { $addToSet: '$project' },
          },
        },
        {
          $group: {
            _id: '$_id.projectType',
            categories: { $push: { category: '$_id.category', count: '$indicatorCount' } },
            projectCount: { $first: { $size: '$uniqueProjects' } },
          },
        },
        { $sort: { '_id': 1 } },
      ]),
      engineContributorCount('Benchmarking Engine'),
    ]);

    // Reshape esgByType into { projectType, E, S, G, total, projectCount }
    const esgSummary = esgByType.map((row: { _id: string; categories: { category: string; count: number }[]; projectCount: number }) => {
      const cats = row.categories.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.category]: c.count }), {});
      return {
        projectType: row._id,
        E: cats['E'] ?? 0,
        S: cats['S'] ?? 0,
        G: cats['G'] ?? 0,
        total: (cats['E'] ?? 0) + (cats['S'] ?? 0) + (cats['G'] ?? 0),
        projectCount: row.projectCount,
      };
    });

    res.json({ distributions, esgByProjectType: esgSummary, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 8: Reporting (template library)
export async function reportingTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [frameworks, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        { $unwind: '$sectionI' },
        {
          $group: {
            _id: '$sectionI.alignedFramework',
            topics: { $addToSet: '$sectionI.disclosureTopic' },
            rationales: { $push: '$sectionI.whyValuable' },
            projectCount: { $sum: 1 },
          },
        },
        { $sort: { '_id': 1 } },
      ]),
      engineContributorCount('Reporting Engine'),
    ]);
    res.json({ frameworks, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Summary: contributor counts for all 8 engines in one call
export async function enginesSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const engines = [
      'Project Classification Engine',
      'Regulatory Rules Engine',
      'Indicator Library',
      'Materiality Engine',
      'Stakeholder Intelligence Engine',
      'Decision Support Engine',
      'Benchmarking Engine',
      'Reporting Engine',
    ] as const;

    const counts = await Promise.all(engines.map((e) => engineContributorCount(e)));
    const totalProjects = await Project.countDocuments();
    const summary = engines.map((e, i) => ({ engine: e, contributorCount: counts[i] }));
    res.json({ engines: summary, totalProjects });
  } catch (err) {
    next(err);
  }
}

// Report preview for a single project + framework
export async function reportPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, framework } = req.query;
    if (!projectId || !framework) {
      res.status(400).json({ error: 'projectId and framework are required' });
      return;
    }

    const [project, template] = await Promise.all([
      Project.findById(projectId).lean(),
      ProjectTemplate.findOne({ project: projectId }).lean(),
    ]);

    if (!project || !template) {
      res.status(404).json({ error: 'Project or template not found' });
      return;
    }

    const disclosureItems = (template.sectionI ?? []).filter(
      (d) => d.alignedFramework === framework
    );

    const relevantIndicators = (template.sectionB ?? []).filter(
      (b) => b.category === 'E' || b.category === 'S' || b.category === 'G'
    );

    res.json({
      meta: {
        projectName: project.name,
        referenceCode: project.referenceCode,
        framework,
        generatedAt: new Date().toISOString(),
        preparedBy: 'Impact Driver × Uptonville Nigeria Limited',
      },
      disclosureItems,
      indicators: relevantIndicators,
      regulations: template.sectionC ?? [],
      stakeholders: template.sectionD ?? [],
      mitigationMeasures: template.sectionE ?? [],
      evidence: template.sectionF ?? [],
      environmentalOutcomes: template.sectionG ?? {},
      socialImpacts: template.sectionH ?? {},
    });
  } catch (err) {
    next(err);
  }
}

// System dashboard stats
export async function systemStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [
      totalProjects, statusCounts, tierCounts,
      totalIndicators, totalRegulations, totalStakeholders, totalDisclosures,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Project.aggregate([{ $group: { _id: '$dataReadinessTier', count: { $sum: 1 } } }]),
      ProjectTemplate.aggregate([{ $project: { count: { $size: '$sectionB' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
      ProjectTemplate.aggregate([{ $project: { count: { $size: '$sectionC' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
      ProjectTemplate.aggregate([{ $project: { count: { $size: '$sectionD' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
      ProjectTemplate.aggregate([{ $project: { count: { $size: '$sectionI' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
    ]);

    res.json({
      totalProjects,
      statusBreakdown: Object.fromEntries(statusCounts.map((s: { _id: string; count: number }) => [s._id, s.count])),
      tierBreakdown: Object.fromEntries(tierCounts.map((t: { _id: number; count: number }) => [t._id, t.count])),
      extractedCounts: {
        indicators: totalIndicators[0]?.total ?? 0,
        regulations: totalRegulations[0]?.total ?? 0,
        stakeholders: totalStakeholders[0]?.total ?? 0,
        disclosures: totalDisclosures[0]?.total ?? 0,
      },
    });
  } catch (err) { next(err); }
}
