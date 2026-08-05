import { Router } from 'express';
import { login, registerClient, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', registerClient); // public — creates pending client account
router.get('/me', authenticate, me);

export default router;
