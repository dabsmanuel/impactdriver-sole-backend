import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectMeta,
  approveAnonymisation,
} from '../controllers/projects.controller';
import { getTemplate, patchSection } from '../controllers/templates.controller';
import { getEngineMap, updateEngineMap } from '../controllers/engineMap.controller';
import { getSignOff, patchSignOff } from '../controllers/signOff.controller';
import { triggerPipeline, getJobStatus, retryJob, resolveConflict } from '../controllers/pipeline.controller';
import { authenticate, requireRole, requireSectionEditRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/meta', getProjectMeta);
router.get('/', listProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// GAP 4c: Anonymisation approval
router.patch('/:id/anonymise', requireRole('admin', 'steering_committee'), approveAnonymisation);

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

export default router;
