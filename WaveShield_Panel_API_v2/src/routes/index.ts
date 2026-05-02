import { Router } from 'express';
import versionRoutes from './version.routes';
import configRoutes from './config.routes';
import licenseRoutes from './license.routes';
import securityRoutes from './security.routes';
import serverInfosRoutes from './server-infos.routes';
import waveshieldInfosRoutes from './waveshield-infos.routes';

const router = Router();

router.use('/version', versionRoutes);
router.use('/getServerConfiguration', configRoutes);
router.use('/licenseAuth', licenseRoutes);
router.use('/retardedAuth', securityRoutes);
router.use('/server', serverInfosRoutes);
router.use('/waveshield-infos', waveshieldInfosRoutes);

export default router;
