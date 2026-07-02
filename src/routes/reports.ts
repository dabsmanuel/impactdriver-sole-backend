import { Router } from 'express';
import { generatePdf } from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/pdf', generatePdf);

export default router;
