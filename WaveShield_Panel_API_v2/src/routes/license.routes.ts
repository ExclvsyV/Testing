import { Router } from 'express';
import { authenticateLicense } from '../controllers/license.controller';
import { validateUserAgent, getClientIp } from '../middleware/auth.middleware';

const router = Router();

router.post('/', [validateUserAgent, getClientIp], authenticateLicense);

export default router;
