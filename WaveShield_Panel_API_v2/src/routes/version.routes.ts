import { Router } from 'express';
import { getVersion } from '../controllers/version.controller';
import { validateUserAgent } from '../middleware/auth.middleware';

const router = Router();

router.get('/', validateUserAgent, getVersion);

export default router;
