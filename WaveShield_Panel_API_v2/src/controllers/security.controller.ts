import { Request, Response } from 'express';
import licenseService from '../services/license.service';
import logger from '../utils/logger';

export const handleCrackAttempt = async (req: Request, res: Response) => {
  const licenseKey = req.query.license as string;
  const clientIp = req.clientIp!;
  
  if (!licenseKey || licenseKey === '') {
    return res.status(404).json({});
  }
  
  const { details, reason, version } = req.body;
  
  try {
    await licenseService.banLicense(
      licenseKey,
      reason || 'Unknown reason',
      clientIp,
      details || 'No details provided',
      version || 'Unknown'
    );
    
    return res.status(404).send();
  } catch (error) {
    logger.error('Error handling crack attempt', { error, licenseKey, clientIp });
    return res.status(404).send();
  }
};
