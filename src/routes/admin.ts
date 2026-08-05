import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { listUsers, createUser, updateUser, resetPassword, deleteUser, approveUser } from '../controllers/admin.controller';
import { exportProjects, exportIndicators } from '../controllers/exports.controller';
import { backfillSectionA } from '../controllers/admin.controller';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/users', listUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/status', approveUser);
router.post('/users/:id/reset-password', resetPassword);
router.delete('/users/:id', deleteUser);

router.get('/exports/projects', exportProjects);
router.get('/exports/indicators', exportIndicators);

// One-time data repair: backfill sectionA from Project fields
router.post('/backfill-section-a', backfillSectionA);

export default router;
