import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectMeta,
  approveAnonymisation,
  approveReportDraft,
  reviewSubmission,
} from '../controllers/projects.controller';
import { getTemplate, patchSection } from '../controllers/templates.controller';
import { getEngineMap, updateEngineMap } from '../controllers/engineMap.controller';
import { getSignOff, patchSignOff } from '../controllers/signOff.controller';
import { triggerPipeline, getJobStatus, retryJob, resolveConflict } from '../controllers/pipeline.controller';
import { classifyProject, validateESGClassification, markClientReportReady } from '../controllers/clientFlow.controller';
import { authenticate, requireRole, requireSectionEditRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/meta', getProjectMeta);
router.get('/', listProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Anonymisation approval (JSC governance)
router.patch('/:id/anonymise', requireRole('steering_committee'), approveAnonymisation);

// Analyst review: approve or return for revision
router.post('/:id/review', requireRole('impact_driver_analyst', 'admin', 'steering_committee'), reviewSubmission);

// Report draft approval (FR-7.4)
router.patch('/:id/report-approval', requireRole('impact_driver_analyst', 'admin', 'steering_committee'), approveReportDraft);

// Template
router.get('/:projectId/template', getTemplate);
router.patch('/:projectId/template/section/:section', requireSectionEditRole, patchSection);

// Engine map (Section K)
router.get('/:projectId/engine-map', getEngineMap);
router.put('/:projectId/engine-map', updateEngineMap);

// Sign-off (Section L)
router.get('/:projectId/signoff', getSignOff);
router.patch('/:projectId/signoff', patchSignOff);

// GAP 8c/8d: Pipeline routes
router.post('/:projectId/pipeline', triggerPipeline);
router.get('/:projectId/pipeline/:jobId', getJobStatus);
router.post('/:projectId/pipeline/:jobId/retry', retryJob);
router.patch('/:projectId/pipeline/:jobId/conflicts/:conflictIdx', resolveConflict);

// Flow B: auto-classification → ESG Lead validation → report ready
router.patch('/:id/classify', requireRole('uptonville_reviewer', 'admin'), classifyProject);
router.patch('/:id/esg-validate', requireRole('uptonville_reviewer', 'admin'), validateESGClassification);
router.patch('/:id/report-ready', requireRole('impact_driver_analyst', 'admin', 'steering_committee'), markClientReportReady);

export default router;
