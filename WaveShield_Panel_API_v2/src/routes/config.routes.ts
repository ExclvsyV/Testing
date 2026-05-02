import { Router } from 'express';
import { getServerConfig } from '../controllers/config.controller';
import { validateUserAgent, getClientIp } from '../middleware/auth.middleware';

const router = Router();

router.get('/', [validateUserAgent, getClientIp], getServerConfig);

export default router;
