import { Router } from 'express';
import { handleCrackAttempt } from '../controllers/security.controller';
import { validateUserAgent, getClientIp } from '../middleware/auth.middleware';

const router = Router();

router.post('/', [validateUserAgent, getClientIp], handleCrackAttempt);

export default router;
