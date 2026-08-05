import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { IngestionJob, IIngestionJob, PipelineStep, PIPELINE_STEPS, StepRecord } from '../models/IngestionJob';
import { EngineContributionMap, ENGINE_NAMES, EngineName } from '../models/EngineContributionMap';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { RegulatoryDefinition } from '../models/RegulatoryDefinition';
import { EngineSnapshot } from '../models/EngineSnapshot';
import { SignOff } from '../models/SignOff';
import { createSnapshot } from './engineSnapshot.controller';
import { stringSimilarity } from '../utils/similarity';

// ─── Internal helpers ────────────────────────────────────────────────────────

function getStepIndex(step: PipelineStep | 'complete'): number {
  if (step === 'complete') return PIPELINE_STEPS.length;
  return PIPELINE_STEPS.indexOf(step as PipelineStep);
}

function nextStep(step: PipelineStep): PipelineStep | 'complete' {
  const idx = PIPELINE_STEPS.indexOf(step);
  if (idx === -1 || idx >= PIPELINE_STEPS.length - 1) return 'complete';
  return PIPELINE_STEPS[idx + 1] as PipelineStep;
}

async function markStepRunning(job: IIngestionJob, step: PipelineStep): Promise<void> {
  const record = job.steps.find((s) => s.step === step);
  if (!record) throw new Error(`Step ${step} not found on job`);
  record.status = 'running';
  record.startedAt = new Date();
  await job.save();
}

async function markStepComplete(
  job: IIngestionJob,
  step: PipelineStep,
  notes: string,
  outputRef: string
): Promise<void> {
  const record = job.steps.find((s) => s.step === step);
  if (!record) throw new Error(`Step ${step} not found on job`);
  record.status = 'complete';
  record.completedAt = new Date();
  record.notes = notes;
  record.outputRef = outputRef;
  job.currentStep = nextStep(step);
  await job.save();
}

async function markStepFailed(job: IIngestionJob, step: PipelineStep, error: string): Promise<void> {
  const record = job.steps.find((s) => s.step === step);
  if (!record) throw new Error(`Step ${step} not found on job`);
  record.status = 'failed';
  record.completedAt = new Date();
  record.error = error;
  job.status = 'failed';
  await job.save();
}

// ─── The 7-step pipeline ─────────────────────────────────────────────────────

async function stepTag(job: IIngestionJob, projectId: string): Promise<void> {
  const step: PipelineStep = 'tag';
  await markStepRunning(job, step);

  try {
    const engineMap = await EngineContributionMap.findOne({ project: projectId }).lean();
    const inputRef = `enginemap:${projectId}`;

    // Auto-detect which engines have data
    const template = await ProjectTemplate.findOne({ project: projectId }).lean();
    const detected: string[] = [];

    if (template) {
      if (template.sectionB && template.sectionB.length > 0) {
        detected.push('Indicator Library', 'Benchmarking Engine');
      }
      if (template.sectionC && template.sectionC.length > 0) {
        detected.push('Regulatory Rules Engine');
      }
      if (template.sectionD && template.sectionD.length > 0) {
        detected.push('Materiality Engine', 'Stakeholder Intelligence Engine');
      }
      if (template.sectionE && template.sectionE.length > 0) {
        detected.push('Decision Support Engine');
      }
      if (template.sectionI && template.sectionI.length > 0) {
        detected.push('Reporting Engine');
      }
      // Project Classification is always relevant
      detected.push('Project Classification Engine');
    }

    const attestedEngines = (engineMap?.contributions ?? [])
      .filter((c) => c.contributed)
      .map((c) => c.engine);

    const allEngines = Array.from(new Set([...detected, ...attestedEngines]));
    const outputRef = `tagged-engines:${allEngines.join(',')}`;

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = inputRef;

    await markStepComplete(job, step, `Tagged ${allEngines.length} engines with data`, outputRef);
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function stepNormalise(job: IIngestionJob, projectId: string): Promise<void> {
  const step: PipelineStep = 'normalise';
  await markStepRunning(job, step);

  try {
    // Fetch as a Mongoose Document so we can call .save()
    const template = await ProjectTemplate.findOne({ project: projectId }).exec();
    if (!template) throw new Error(`Template not found for project ${projectId}`);

    // Trim all string fields across sections B, C, D, E
    let changedCount = 0;

    template.sectionB = template.sectionB.map((entry) => {
      changedCount++;
      return {
        ...entry,
        indicatorName: entry.indicatorName.trim(),
        unit: entry.unit.trim(),
        measurementMethod: entry.measurementMethod.replace(/\s+/g, ' ').trim(),
        whyItMattered: entry.whyItMattered.replace(/\s+/g, ' ').trim(),
      };
    }) as typeof template.sectionB;

    template.sectionC = template.sectionC.map((entry) => {
      changedCount++;
      return {
        ...entry,
        category: entry.category.trim(),
        regulationStandard: entry.regulationStandard.trim(),
        issuingBody: entry.issuingBody.trim(),
        howItApplied: entry.howItApplied.replace(/\s+/g, ' ').trim(),
      };
    }) as typeof template.sectionC;

    template.sectionD = template.sectionD.map((entry) => {
      changedCount++;
      return {
        ...entry,
        stakeholderGroup: entry.stakeholderGroup.trim(),
        interestConcern: entry.interestConcern.replace(/\s+/g, ' ').trim(),
        reportingFormatNeeded: entry.reportingFormatNeeded.trim(),
        engagementOutcome: entry.engagementOutcome.replace(/\s+/g, ' ').trim(),
      };
    }) as typeof template.sectionD;

    template.sectionE = template.sectionE.map((entry) => {
      changedCount++;
      return {
        ...entry,
        mitigationMeasure: entry.mitigationMeasure.replace(/\s+/g, ' ').trim(),
        expertReasoning: entry.expertReasoning.replace(/\s+/g, ' ').trim(),
        evidenceForRating: entry.evidenceForRating.replace(/\s+/g, ' ').trim(),
        recommendedFuture: entry.recommendedFuture.replace(/\s+/g, ' ').trim(),
      };
    }) as typeof template.sectionE;

    await template.save();

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = `template:${projectId}:sections-B,C,D,E`;

    await markStepComplete(
      job,
      step,
      `Normalised ${changedCount} section rows (trim + whitespace collapse)`,
      `template:${projectId}:normalised`
    );
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function stepMerge(job: IIngestionJob, projectId: string): Promise<void> {
  const step: PipelineStep = 'merge';
  await markStepRunning(job, step);

  try {
    const template = await ProjectTemplate.findOne({ project: projectId }).lean();
    if (!template) throw new Error(`Template not found for project ${projectId}`);

    // Check each engine's active snapshot and compare project's data against it
    let matchCount = 0;
    let newCount = 0;

    for (const engineName of ENGINE_NAMES) {
      const activeSnapshot = await EngineSnapshot.findOne({ engine: engineName, isActive: true }).lean();
      if (!activeSnapshot) continue;

      const snapshotData = activeSnapshot.data as Record<string, unknown>;

      // Compare indicator names from sectionB against snapshot indicator entries
      if (engineName === 'Indicator Library' || engineName === 'Benchmarking Engine') {
        const snapshotEntries = Array.isArray(snapshotData['indicators'])
          ? (snapshotData['indicators'] as Array<{ _id?: { indicatorName?: string } }>)
          : [];

        for (const projectEntry of template.sectionB) {
          const projectName = projectEntry.indicatorName;
          let isMatch = false;

          for (const snapEntry of snapshotEntries) {
            const snapName = snapEntry._id?.indicatorName ?? '';
            const similarity = stringSimilarity(projectName, snapName);
            if (similarity > 0.85) {
              isMatch = true;
              matchCount++;
              break;
            }
          }
          if (!isMatch) newCount++;
        }
      }
    }

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = `template:${projectId}:all-sections`;

    await markStepComplete(
      job,
      step,
      `Merge analysis: ${matchCount} matches found, ${newCount} new entries identified`,
      `merge-result:matches=${matchCount},new=${newCount}`
    );
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function stepResolveConflicts(job: IIngestionJob, projectId: string): Promise<void> {
  const step: PipelineStep = 'resolve-conflicts';
  await markStepRunning(job, step);

  try {
    const template = await ProjectTemplate.findOne({ project: projectId }).lean();
    if (!template) throw new Error(`Template not found for project ${projectId}`);

    const conflicts: IIngestionJob['conflicts'] = [];

    for (const engineName of ENGINE_NAMES) {
      const activeSnapshot = await EngineSnapshot.findOne({ engine: engineName, isActive: true }).lean();
      if (!activeSnapshot) continue;

      const snapshotData = activeSnapshot.data as Record<string, unknown>;

      // sectionB: Indicator Library + Benchmarking — name similarity + unit mismatch
      if (engineName === 'Indicator Library' || engineName === 'Benchmarking Engine') {
        const snapshotEntries = Array.isArray(snapshotData['indicators'])
          ? (snapshotData['indicators'] as Array<{ _id?: { indicatorName?: string; unit?: string } }>)
          : [];

        for (const projectEntry of template.sectionB) {
          for (const snapEntry of snapshotEntries) {
            const snapName = snapEntry._id?.indicatorName ?? '';
            const similarity = stringSimilarity(projectEntry.indicatorName, snapName);

            if (similarity >= 0.5 && similarity < 0.85) {
              conflicts.push({
                engineName,
                field: 'indicatorName',
                existingValue: snapName,
                newValue: projectEntry.indicatorName,
                similarity,
                resolution: 'pending',
              });
            }

            if (similarity > 0.85 && snapEntry._id?.unit && snapEntry._id.unit !== projectEntry.unit) {
              conflicts.push({
                engineName,
                field: 'unit',
                existingValue: snapEntry._id.unit,
                newValue: projectEntry.unit,
                similarity,
                resolution: 'pending',
              });
            }
          }
        }
      }

      // sectionC: Regulatory Rules — regulation standard name similarity
      if (engineName === 'Regulatory Rules Engine') {
        const snapRules = Array.isArray(snapshotData['sectionC'])
          ? (snapshotData['sectionC'] as Array<{ regulationStandard?: string; issuingBody?: string }>)
          : [];

        for (const projectEntry of template.sectionC) {
          for (const snapRule of snapRules) {
            const snapStd = snapRule.regulationStandard ?? '';
            const similarity = stringSimilarity(projectEntry.regulationStandard, snapStd);

            if (similarity >= 0.5 && similarity < 0.85) {
              conflicts.push({
                engineName,
                field: 'regulationStandard',
                existingValue: snapStd,
                newValue: projectEntry.regulationStandard,
                similarity,
                resolution: 'pending',
              });
            }
          }
        }
      }

      // sectionD: Stakeholder Intelligence — stakeholder group similarity
      if (engineName === 'Stakeholder Intelligence Engine' || engineName === 'Materiality Engine') {
        const snapGroups = Array.isArray(snapshotData['sectionD'])
          ? (snapshotData['sectionD'] as Array<{ stakeholderGroup?: string }>)
          : [];

        for (const projectEntry of template.sectionD) {
          for (const snapGroup of snapGroups) {
            const snapGroupName = snapGroup.stakeholderGroup ?? '';
            const similarity = stringSimilarity(projectEntry.stakeholderGroup, snapGroupName);

            if (similarity >= 0.5 && similarity < 0.85) {
              conflicts.push({
                engineName,
                field: 'stakeholderGroup',
                existingValue: snapGroupName,
                newValue: projectEntry.stakeholderGroup,
                similarity,
                resolution: 'pending',
              });
            }
          }
        }
        // Only detect once per project entry pair (Stakeholder Intelligence takes precedence)
        if (engineName === 'Materiality Engine') continue;
      }

      // sectionE: Decision Support — mitigation measure similarity
      if (engineName === 'Decision Support Engine') {
        const snapMeasures = Array.isArray(snapshotData['sectionE'])
          ? (snapshotData['sectionE'] as Array<{ mitigationMeasure?: string; effectiveness?: string }>)
          : [];

        for (const projectEntry of template.sectionE) {
          for (const snapMeasure of snapMeasures) {
            const snapMeasureName = snapMeasure.mitigationMeasure ?? '';
            const similarity = stringSimilarity(projectEntry.mitigationMeasure, snapMeasureName);

            if (similarity >= 0.5 && similarity < 0.85) {
              conflicts.push({
                engineName,
                field: 'mitigationMeasure',
                existingValue: snapMeasureName,
                newValue: projectEntry.mitigationMeasure,
                similarity,
                resolution: 'pending',
              });
            }

            // Effectiveness mismatch on near-identical measures
            if (
              similarity > 0.85 &&
              snapMeasure.effectiveness &&
              snapMeasure.effectiveness !== projectEntry.effectiveness
            ) {
              conflicts.push({
                engineName,
                field: 'effectiveness',
                existingValue: snapMeasure.effectiveness,
                newValue: projectEntry.effectiveness,
                similarity,
                resolution: 'pending',
              });
            }
          }
        }
      }
    }

    // Store conflicts on the job
    job.conflicts = conflicts as IIngestionJob['conflicts'];

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = `template:${projectId}:sectionB,sectionC,sectionD,sectionE`;

    await markStepComplete(
      job,
      step,
      `Conflict detection complete: ${conflicts.length} conflicts flagged`,
      `conflicts:${conflicts.length}-flagged`
    );
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function stepCompileRules(job: IIngestionJob, projectId: string): Promise<void> {
  const step: PipelineStep = 'compile-rules';
  await markStepRunning(job, step);

  try {
    const template = await ProjectTemplate.findOne({ project: projectId }).lean();
    if (!template) throw new Error(`Template not found for project ${projectId}`);

    // Combine sectionC (regulation + issuing body + how applied) with sectionF (evidence)
    const compiledRules: Array<{
      regulationStandard: string;
      issuingBody: string;
      howItApplied: string;
      category: string;
      evidence: Array<{
        evidenceType: string;
        formatFrequency: string;
        acceptedWithoutDispute: boolean;
        disputeNotes?: string;
      }>;
    }> = [];

    for (const rule of template.sectionC) {
      const matchingEvidence = template.sectionF.filter(
        (f) =>
          f.regulationStandard === rule.regulationStandard &&
          (f.issuingBody === rule.issuingBody || !f.issuingBody)
      );

      compiledRules.push({
        regulationStandard: rule.regulationStandard,
        issuingBody: rule.issuingBody,
        howItApplied: rule.howItApplied,
        category: rule.category,
        evidence: matchingEvidence.map((e) => ({
          evidenceType: e.evidenceType,
          formatFrequency: e.formatFrequency,
          acceptedWithoutDispute: e.acceptedWithoutDispute,
          disputeNotes: e.disputeNotes,
        })),
      });
    }

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = `template:${projectId}:sectionC,sectionF`;

    await markStepComplete(
      job,
      step,
      `Compiled ${compiledRules.length} regulatory rules with ${compiledRules.reduce((acc, r) => acc + r.evidence.length, 0)} evidence records`,
      `compiled-rules:${compiledRules.length}-rules`
    );
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function stepValidate(job: IIngestionJob, projectId: string): Promise<void> {
  const step: PipelineStep = 'validate';
  await markStepRunning(job, step);

  try {
    const template = await ProjectTemplate.findOne({ project: projectId }).lean();
    if (!template) throw new Error(`Template not found for project ${projectId}`);

    // Determine project type from sectionA
    const projectType = template.sectionA?.projectType ?? '';

    // Load all regulatory definitions that apply to this project type
    const allDefinitions = await RegulatoryDefinition.find({}).lean();
    const applicableDefinitions = allDefinitions.filter((def) => {
      // Empty applicableProjectTypes means applies to all
      if (def.applicableProjectTypes.length === 0) return true;
      return def.applicableProjectTypes.includes(projectType);
    });

    const validationReport: IIngestionJob['validationReport'] = [];
    let passCount = 0;
    let failCount = 0;

    // Get extraction status as a plain object
    const extractionStatus = template.extractionStatus as unknown as Record<string, string>;

    for (const def of applicableDefinitions) {
      for (const requiredSection of def.requiredSections) {
        const sectionStatus = extractionStatus?.[requiredSection] ?? 'not-started';
        const passed = sectionStatus === 'complete';

        validationReport.push({
          definitionCode: def.code,
          framework: def.framework,
          field: `section${requiredSection.toUpperCase()}`,
          status: passed ? 'pass' : def.mandatory ? 'fail' : 'warning',
          message: passed
            ? `Section ${requiredSection.toUpperCase()} is complete for ${def.code}`
            : `Section ${requiredSection.toUpperCase()} is '${sectionStatus}' but required by ${def.code} (${def.title})`,
        });

        if (passed) passCount++;
        else failCount++;
      }
    }

    job.validationReport = validationReport;

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = `template:${projectId}:extractionStatus`;

    await markStepComplete(
      job,
      step,
      `Validation complete: ${passCount} passed, ${failCount} failed/warned across ${applicableDefinitions.length} definitions`,
      `validation:pass=${passCount},fail=${failCount}`
    );
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function stepLockVersion(job: IIngestionJob, projectId: string, userId: string): Promise<void> {
  const step: PipelineStep = 'lock-version';
  await markStepRunning(job, step);

  try {
    const template = await ProjectTemplate.findOne({ project: projectId }).lean();
    if (!template) throw new Error(`Template not found for project ${projectId}`);

    const engineMap = await EngineContributionMap.findOne({ project: projectId }).lean();
    const snapshotIds: Types.ObjectId[] = [];

    // Determine which engines this project contributes to
    const contributingEngines: EngineName[] = [];
    if (template.sectionB?.length > 0) {
      contributingEngines.push('Indicator Library', 'Benchmarking Engine');
    }
    if (template.sectionC?.length > 0) {
      contributingEngines.push('Regulatory Rules Engine');
    }
    if (template.sectionD?.length > 0) {
      contributingEngines.push('Materiality Engine', 'Stakeholder Intelligence Engine');
    }
    if (template.sectionE?.length > 0) {
      contributingEngines.push('Decision Support Engine');
    }
    if (template.sectionI?.length > 0) {
      contributingEngines.push('Reporting Engine');
    }
    contributingEngines.push('Project Classification Engine');

    // Also include attested engines
    const attested = (engineMap?.contributions ?? [])
      .filter((c) => c.contributed)
      .map((c) => c.engine as EngineName);

    const uniqueEngines = Array.from(new Set([...contributingEngines, ...attested]));

    for (const engineName of uniqueEngines) {
      // Build a minimal snapshot data object for this project+engine combination
      const snapshotData: Record<string, unknown> = {
        projectId,
        engine: engineName,
        lockedAt: new Date().toISOString(),
        sectionB: template.sectionB ?? [],
        sectionC: template.sectionC ?? [],
        sectionD: template.sectionD ?? [],
        sectionE: template.sectionE ?? [],
        sectionF: template.sectionF ?? [],
        sectionG: template.sectionG ?? {},
        sectionH: template.sectionH ?? {},
        sectionI: template.sectionI ?? [],
      };

      const snapshotId = await createSnapshot(
        engineName,
        snapshotData,
        [projectId],
        userId,
        job._id
      );
      snapshotIds.push(snapshotId);
    }

    job.snapshotIds = snapshotIds;
    job.status = 'complete';

    const stepRecord = job.steps.find((s) => s.step === step) as StepRecord;
    stepRecord.inputRef = `template:${projectId}:all-sections`;

    await markStepComplete(
      job,
      step,
      `Locked ${snapshotIds.length} engine snapshots`,
      `snapshot-ids:${snapshotIds.map((id) => id.toString()).join(',')}`
    );

    job.status = 'complete';
    await job.save();
  } catch (err) {
    await markStepFailed(job, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Main pipeline runner ────────────────────────────────────────────────────

export async function runPipeline(
  projectId: string,
  userId: string,
  jobId?: string
): Promise<void> {
  const job = await IngestionJob.findOne(
    jobId ? { _id: jobId } : { project: projectId, status: { $in: ['pending', 'running'] } }
  );
  if (!job) throw new Error(`No pending/running job found for project ${projectId}`);

  job.status = 'running';
  await job.save();

  // Find the step to start from (first non-complete step)
  const startStep = job.currentStep === 'complete'
    ? null
    : job.steps.find((s) => s.status === 'pending' || s.status === 'failed')?.step;

  if (!startStep) {
    job.status = 'complete';
    await job.save();
    return;
  }

  const startIdx = getStepIndex(startStep as PipelineStep);

  const stepFunctions: Array<(job: IIngestionJob, projectId: string, userId: string) => Promise<void>> = [
    (j, p) => stepTag(j, p),
    (j, p) => stepNormalise(j, p),
    (j, p) => stepMerge(j, p),
    (j, p) => stepResolveConflicts(j, p),
    (j, p) => stepCompileRules(j, p),
    (j, p) => stepValidate(j, p),
    (j, p, u) => stepLockVersion(j, p, u),
  ];

  for (let i = startIdx; i < stepFunctions.length; i++) {
    const fn = stepFunctions[i];
    if (!fn) break;
    try {
      await fn(job, projectId, userId);
    } catch {
      // Step already marked failed inside the step function; stop pipeline.
      return;
    }
  }
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

export async function triggerPipeline(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params as { projectId: string };
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    // Spec: aggregation runs only after all parties have signed off
    const signOff = await SignOff.findOne({ project: projectId }).lean();
    const allSigned =
      !!signOff &&
      signOff.signatures.length > 0 &&
      signOff.signatures.every((s) => s.signed && !!s.name && !!s.date);
    if (!allSigned) {
      res.status(409).json({
        error: 'Pipeline cannot be triggered until all three parties have signed off (Section L).',
      });
      return;
    }

    const job = await IngestionJob.create({
      project: new Types.ObjectId(projectId),
      triggeredBy: new Types.ObjectId(userId),
      status: 'pending',
      currentStep: 'tag',
    });

    // Fire and forget — respond immediately with 202
    runPipeline(projectId, userId, job._id.toString()).catch((err) => {
      console.error(`[pipeline] Job ${job._id} failed:`, err);
    });

    res.status(202).json({ jobId: job._id });
  } catch (err) {
    next(err);
  }
}

export async function getJobStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, jobId } = req.params as { projectId: string; jobId: string };
    const job = await IngestionJob.findOne({ _id: jobId, project: projectId }).lean();
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function retryJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, jobId } = req.params as { projectId: string; jobId: string };
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const job = await IngestionJob.findOne({ _id: jobId, project: projectId });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (job.status !== 'failed') {
      res.status(400).json({ error: 'Job is not in a failed state' });
      return;
    }

    // Find the failed step and reset it to pending
    const failedStep = job.steps.find((s) => s.status === 'failed');
    if (!failedStep) {
      res.status(400).json({ error: 'No failed step found' });
      return;
    }

    failedStep.status = 'pending';
    failedStep.error = undefined;
    failedStep.startedAt = undefined;
    failedStep.completedAt = undefined;
    job.status = 'running';
    job.currentStep = failedStep.step;
    await job.save();

    // Re-run pipeline from the failed step
    runPipeline(projectId, userId, jobId).catch((err) => {
      console.error(`[pipeline] Retry of job ${jobId} failed:`, err);
    });

    res.status(202).json({ jobId: job._id, retryingFrom: failedStep.step });
  } catch (err) {
    next(err);
  }
}

export async function resolveConflict(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, jobId, conflictIdx } = req.params as {
      projectId: string;
      jobId: string;
      conflictIdx: string;
    };
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const idx = parseInt(conflictIdx, 10);
    if (isNaN(idx) || idx < 0) {
      res.status(400).json({ error: 'Invalid conflict index' });
      return;
    }

    const job = await IngestionJob.findOne({ _id: jobId, project: projectId });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

    if (idx >= job.conflicts.length) {
      res.status(404).json({ error: `Conflict index ${idx} out of range (${job.conflicts.length} conflicts)` });
      return;
    }

    const validResolutions = ['accepted-new', 'confirmed-existing', 'escalated'] as const;
    const { resolution } = req.body as { resolution: string };

    if (!validResolutions.includes(resolution as (typeof validResolutions)[number])) {
      res.status(400).json({ error: `resolution must be one of: ${validResolutions.join(', ')}` });
      return;
    }

    const conflict = job.conflicts[idx];
    if (!conflict) {
      res.status(404).json({ error: 'Conflict not found' });
      return;
    }
    conflict.resolution = resolution as IIngestionJob['conflicts'][number]['resolution'];
    conflict.resolvedBy = new Types.ObjectId(userId);
    conflict.resolvedAt = new Date();

    await job.save();
    res.json({ conflict, idx });
  } catch (err) {
    next(err);
  }
}
