import { Router } from 'express';
import { submitClientProject } from '../controllers/clientFlow.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Flow B: client_data_submitter initiates a new project for ESG scoring
router.post('/submit', requireRole('client_data_submitter', 'admin'), submitClientProject);

export default router;
