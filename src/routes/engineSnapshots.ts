import { Router } from 'express';
import { listSnapshots, getSnapshot } from '../controllers/engineSnapshot.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listSnapshots);
router.get('/:id', getSnapshot);

export default router;
