import { Request, Response, NextFunction } from 'express';
import { PipelineStage, Types } from 'mongoose';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { Project } from '../models/Project';
import { EngineContributionMap } from '../models/EngineContributionMap';
import { EngineSnapshot } from '../models/EngineSnapshot';
import { stringSimilarity } from '../utils/similarity';

// Fix 5: data-driven contributor count based on actual section content
async function dataContributorCount(engineName: string): Promise<number> {
  const filterMap: Record<string, Record<string, unknown>> = {
    'Project Classification Engine': {},
    'Regulatory Rules Engine': { 'sectionC.0': { $exists: true } },
    'Indicator Library': { 'sectionB.0': { $exists: true } },
    'Materiality Engine': { 'sectionD.0': { $exists: true } },
    'Stakeholder Intelligence Engine': { 'sectionD.0': { $exists: true } },
    'Decision Support Engine': { 'sectionE.0': { $exists: true } },
    'Benchmarking Engine': { 'sectionB.0': { $exists: true } },
    'Reporting Engine': { 'sectionI.0': { $exists: true } },
  };
  const filter = filterMap[engineName];
  if (filter === undefined) return 0;
  if (!Object.keys(filter).length) return Project.countDocuments();
  return ProjectTemplate.countDocuments(filter);
}

// Returns max of attestation-based (Section K) and data-driven counts
async function engineContributorCount(engineName: string): Promise<number> {
  const [attestation, dataBased] = await Promise.all([
    EngineContributionMap.countDocuments({
      contributions: { $elemMatch: { engine: engineName, contributed: true } },
    }),
    dataContributorCount(engineName),
  ]);
  return Math.max(attestation, dataBased);
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
            projectIds: { $addToSet: { $toString: '$_id' } }, // GAP 3
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
// Fix 1: include Section F evidence cross-reference alongside Section C rules
export async function regulatoryRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [raw, evidenceByRegulation, contributorCount] = await Promise.all([
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
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
          },
        },
        { $sort: { projectCount: -1 } },
      ]),
      // Fix 1: Section F — evidence expected per regulation
      ProjectTemplate.aggregate([
        { $unwind: '$sectionF' },
        { $match: { 'sectionF.regulationStandard': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$sectionF.regulationStandard',
            evidenceTypes: { $addToSet: '$sectionF.evidenceType' },
            formatFrequencies: { $addToSet: '$sectionF.formatFrequency' },
            totalSubmissions: { $sum: 1 },
            acceptedCount: { $sum: { $cond: ['$sectionF.acceptedWithoutDispute', 1, 0] } },
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
            disputeNotes: {
              $push: {
                $cond: [
                  { $and: [{ $eq: ['$sectionF.acceptedWithoutDispute', false] }, { $ne: ['$sectionF.disputeNotes', ''] }] },
                  '$sectionF.disputeNotes',
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        {
          $addFields: {
            evidenceTypes: { $filter: { input: '$evidenceTypes', cond: { $ne: ['$$this', ''] } } },
            formatFrequencies: { $filter: { input: '$formatFrequencies', cond: { $ne: ['$$this', ''] } } },
          },
        },
      ]),
      engineContributorCount('Regulatory Rules Engine'),
    ]);
    res.json({ rules: raw, evidenceByRegulation, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 3: Indicator Library
// GAP 2: also pull sectionG outcomes per projectType as outcomeContext
export async function indicatorLibrary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, projectType } = req.query;

    const [raw, outcomeContext, contributorCount] = await Promise.all([
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
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
          },
        },
        { $sort: { '_id.category': 1, '_id.indicatorName': 1 } },
      ]),
      // GAP 2: sectionG outcomes per projectType
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
        ...(projectType ? [{ $match: { 'projectDoc.projectType': projectType } }] : []),
        {
          $group: {
            _id: '$projectDoc.projectType',
            outcomesAchieved: {
              $push: {
                $cond: [{ $ne: ['$sectionG.outcomesAchieved', null] }, '$sectionG.outcomesAchieved', '$$REMOVE'],
              },
            },
            measurementMethods: {
              $addToSet: {
                $cond: [{ $ne: ['$sectionG.measurementMethod', null] }, '$sectionG.measurementMethod', '$$REMOVE'],
              },
            },
            timeframes: {
              $addToSet: {
                $cond: [{ $ne: ['$sectionG.timeframe', null] }, '$sectionG.timeframe', '$$REMOVE'],
              },
            },
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
          },
        },
        {
          $addFields: {
            outcomesAchieved: {
              $filter: { input: '$outcomesAchieved', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            measurementMethods: {
              $filter: { input: '$measurementMethods', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            timeframes: {
              $filter: { input: '$timeframes', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      engineContributorCount('Indicator Library'),
    ]);

    const withDuplicateFlag = raw.map((entry, idx) => {
      const name = entry['_id']?.indicatorName ?? '';
      const isDuplicate = raw.some((other, otherIdx) => {
        if (otherIdx >= idx) return false;
        return stringSimilarity(name, other['_id']?.indicatorName ?? '') > 0.85;
      });
      return { ...entry, isDuplicate };
    });

    // GAP 2: return outcomeContext alongside indicators
    res.json({ indicators: withDuplicateFlag, outcomeContext, contributorCount });
  } catch (err) {
    next(err);
  }
}

// Engine 4: Materiality Engine
// Fix 3: replace D×B cartesian (inflated projectCount) with proper deduplication;
//         add G/H context as a parallel query
export async function materialityEngine(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [matrix, contextByType, contributorCount] = await Promise.all([
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
            // Fix 3: collect unique project IDs, not sum of rows
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3 (keep and expose)
          },
        },
        // Fix 3: derive accurate count from the set
        { $addFields: { projectCount: { $size: '$projectIds' } } },
        { $sort: { '_id.projectType': 1, '_id.stakeholderGroup': 1 } },
      ]),
      // Fix 3: G/H context per project type (spec: MAT built from D+G+H)
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
        {
          $group: {
            _id: '$projectDoc.projectType',
            envOutcomes: { $push: '$sectionG.outcomesAchieved' },
            positiveImpacts: { $push: '$sectionH.positiveImpacts' },
            negativeImpacts: { $push: '$sectionH.negativeImpacts' },
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
          },
        },
        {
          $addFields: {
            envOutcomes: {
              $filter: { input: '$envOutcomes', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            positiveImpacts: {
              $filter: { input: '$positiveImpacts', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            negativeImpacts: {
              $filter: { input: '$negativeImpacts', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      engineContributorCount('Materiality Engine'),
    ]);
    res.json({ matrix, contextByType, contributorCount });
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
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
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
        projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3 — expose in output (was $push before)
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
// Fix 2: add outcomesByType (Sections G + H) aggregation and return it
// GAP 4b: only include projects with anonymisationApproved: true
export async function benchmarking(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // GAP 4b: all three aggregations must filter on anonymisationApproved
    const [distributions, esgByType, outcomesByType, contributorCount] = await Promise.all([
      ProjectTemplate.aggregate([
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectDoc' } },
        { $unwind: '$projectDoc' },
        { $match: { 'projectDoc.anonymisationApproved': true } }, // GAP 4b
        { $unwind: '$sectionB' },
        {
          $group: {
            _id: { projectType: '$projectDoc.projectType', indicatorName: '$sectionB.indicatorName', category: '$sectionB.category', unit: '$sectionB.unit' },
            projectCount: { $sum: 1 },
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
          },
        },
        { $sort: { '_id.projectType': 1, '_id.category': 1 } },
      ]),
      ProjectTemplate.aggregate([
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectDoc' } },
        { $unwind: '$projectDoc' },
        { $match: { 'projectDoc.anonymisationApproved': true } }, // GAP 4b
        { $unwind: '$sectionB' },
        {
          $group: {
            _id: { projectType: '$projectDoc.projectType', category: '$sectionB.category' },
            indicatorCount: { $sum: 1 },
            uniqueProjects: { $addToSet: { $toString: '$project' } },
          },
        },
        {
          $group: {
            _id: '$_id.projectType',
            categories: { $push: { category: '$_id.category', count: '$indicatorCount' } },
            projectCount: { $first: { $size: '$uniqueProjects' } },
            projectIds: { $push: '$uniqueProjects' }, // gather for flattening
          },
        },
        { $sort: { '_id': 1 } },
      ]),
      // Fix 2: environmental and social outcomes by project type (Sections G + H)
      ProjectTemplate.aggregate([
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'projectDoc' } },
        { $unwind: '$projectDoc' },
        { $match: { 'projectDoc.anonymisationApproved': true } }, // GAP 4b
        {
          $group: {
            _id: '$projectDoc.projectType',
            envOutcomes: { $push: '$sectionG.outcomesAchieved' },
            measurementMethods: { $addToSet: '$sectionG.measurementMethod' },
            positiveImpacts: { $push: '$sectionH.positiveImpacts' },
            negativeImpacts: { $push: '$sectionH.negativeImpacts' },
            projectCount: { $sum: 1 },
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
          },
        },
        {
          $addFields: {
            envOutcomes: {
              $filter: { input: '$envOutcomes', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            measurementMethods: {
              $filter: { input: '$measurementMethods', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            positiveImpacts: {
              $filter: { input: '$positiveImpacts', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
            negativeImpacts: {
              $filter: { input: '$negativeImpacts', cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] } },
            },
          },
        },
        {
          $match: {
            $or: [
              { 'envOutcomes.0': { $exists: true } },
              { 'positiveImpacts.0': { $exists: true } },
            ],
          },
        },
        { $sort: { _id: 1 } },
      ]),
      engineContributorCount('Benchmarking Engine'),
    ]);

    const esgSummary = esgByType.map((row: { _id: string; categories: { category: string; count: number }[]; projectCount: number; projectIds: string[][] }) => {
      const cats = row.categories.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.category]: c.count }), {});
      // Flatten nested projectIds arrays
      const flatProjectIds = Array.from(new Set((row.projectIds ?? []).flat()));
      return {
        projectType: row._id,
        E: cats['E'] ?? 0,
        S: cats['S'] ?? 0,
        G: cats['G'] ?? 0,
        total: (cats['E'] ?? 0) + (cats['S'] ?? 0) + (cats['G'] ?? 0),
        projectCount: row.projectCount,
        projectIds: flatProjectIds, // GAP 3
      };
    });

    res.json({ distributions, esgByProjectType: esgSummary, outcomesByType, contributorCount });
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
            projectIds: { $addToSet: { $toString: '$project' } }, // GAP 3
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

// GAP 9: Report preview — consume engine snapshot outputs instead of raw template data
export async function reportPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, framework } = req.query;
    if (!projectId || !framework) {
      res.status(400).json({ error: 'projectId and framework are required' });
      return;
    }

    const [project, template, engineMap] = await Promise.all([
      Project.findById(projectId).lean(),
      ProjectTemplate.findOne({ project: projectId }).lean(),
      EngineContributionMap.findOne({ project: projectId }).lean(),
    ]);

    if (!project || !template) {
      res.status(404).json({ error: 'Project or template not found' });
      return;
    }

    const projectIdStr = project._id.toString();

    // GAP 9: load active snapshots for each relevant engine
    const relevantEngines = (engineMap?.contributions ?? [])
      .filter((c) => c.contributed)
      .map((c) => c.engine);

    // Load all active snapshots for those engines
    const snapshotDocs = await EngineSnapshot.find({
      engine: { $in: relevantEngines },
      isActive: true,
    }).lean();

    // Build a map: engineName -> snapshot data filtered to this projectId
    const engineOutputs: Record<string, unknown[]> = {};
    for (const snap of snapshotDocs) {
      const snapData = snap.data as Record<string, unknown>;

      // Each snapshot stores data as an array of entries with projectIds on them
      // Filter to entries that include this project
      const filteredEntries = Object.values(snapData).flatMap((val) => {
        if (!Array.isArray(val)) return [];
        return (val as Array<Record<string, unknown>>).filter((entry) => {
          const entryProjectIds = entry['projectIds'];
          if (!entryProjectIds) return false;
          if (Array.isArray(entryProjectIds)) {
            return entryProjectIds.includes(projectIdStr);
          }
          return false;
        });
      });

      engineOutputs[snap.engine] = filteredEntries;
    }

    // GAP 9: build report from engine-curated outputs
    const disclosureItems = engineOutputs['Reporting Engine'] ?? [];
    const indicators = engineOutputs['Indicator Library'] ?? [];
    const regulations = engineOutputs['Regulatory Rules Engine'] ?? [];
    const stakeholders = engineOutputs['Stakeholder Intelligence Engine'] ?? [];
    const mitigationMeasures = engineOutputs['Decision Support Engine'] ?? [];

    // Supplement with raw template data when no snapshot available
    const hasDisclosures = disclosureItems.length > 0;
    const hasIndicators = indicators.length > 0;
    const hasRegulations = regulations.length > 0;
    const hasStakeholders = stakeholders.length > 0;
    const hasMeasures = mitigationMeasures.length > 0;

    // GAP 9: fix 4 — include Section K insights for engines that were contributed to
    const engineContributions = (engineMap?.contributions ?? []).filter(
      (c) => c.contributed && c.mostValuableInsight
    );

    res.json({
      meta: {
        projectName: project.name,
        referenceCode: project.referenceCode,
        framework,
        generatedAt: new Date().toISOString(),
        preparedBy: 'Impact Driver × Uptonville Nigeria Limited',
        source: snapshotDocs.length > 0 ? 'engine-snapshots' : 'raw-template',
      },
      // From snapshots when available, else fallback to raw template
      disclosureItems: hasDisclosures
        ? disclosureItems
        : (template.sectionI ?? []).filter((d) => d.alignedFramework === framework),
      indicators: hasIndicators
        ? indicators
        : (template.sectionB ?? []).filter((b) => b.category === 'E' || b.category === 'S' || b.category === 'G'),
      regulations: hasRegulations ? regulations : (template.sectionC ?? []),
      stakeholders: hasStakeholders ? stakeholders : (template.sectionD ?? []),
      mitigationMeasures: hasMeasures ? mitigationMeasures : (template.sectionE ?? []),
      // GAP 9: G + H are narrative sections with no engine — always use raw template data
      evidence: template.sectionF ?? [],
      environmentalOutcomes: template.sectionG ?? {},
      socialImpacts: template.sectionH ?? {},
      engineContributions,
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
