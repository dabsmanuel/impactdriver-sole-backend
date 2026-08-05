import { Router } from 'express';
import { list, create, update, remove } from '../controllers/regulatoryDefinitions.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.post('/', requireRole('admin'), create);
router.patch('/:id', requireRole('admin'), update);
router.delete('/:id', requireRole('admin'), remove);

export default router;
