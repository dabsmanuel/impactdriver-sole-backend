import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectMeta,
} from '../controllers/projects.controller';
import { getTemplate, patchSection } from '../controllers/templates.controller';
import { getEngineMap, updateEngineMap } from '../controllers/engineMap.controller';
import { getSignOff, patchSignOff } from '../controllers/signOff.controller';
import { authenticate, requireSectionEditRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/meta', getProjectMeta);
router.get('/', listProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Template
router.get('/:projectId/template', getTemplate);
router.patch('/:projectId/template/section/:section', requireSectionEditRole, patchSection);

// Engine map (Section K)
router.get('/:projectId/engine-map', getEngineMap);
router.put('/:projectId/engine-map', updateEngineMap);

// Sign-off (Section L)
router.get('/:projectId/signoff', getSignOff);
router.patch('/:projectId/signoff', patchSignOff);

export default router;
