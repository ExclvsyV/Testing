import { Request, Response } from 'express';
import licenseService from '../services/license.service';
import logger from '../utils/logger';

export const getServerConfig = async (req: Request, res: Response) => {
  const licenseKey = req.query.license as string;
  const clientIp = req.clientIp!;
  
  if (!licenseKey || licenseKey === '') {
    return res.status(404).json({});
  }
  
  try {
    const defaultConfig = require('../defaultConfig.json');
    
    const config = await licenseService.getServerConfiguration(licenseKey, clientIp);
    
    // If no config found, use default
    if (!config || config === undefined || config === null || 
        Object.keys(config).length === 0 || config.Client) {
      return res.json(defaultConfig);
    }
    
    // Ensure Premium and Beta sections exist
    if (!config.Premium) {
      config.Premium = {};
    }
    
    if (!config.Beta) {
      config.Beta = {};
    }
    
    return res.json(config);
  } catch (error) {
    logger.error('Error fetching server configuration', { error, licenseKey, clientIp });
    return res.status(404).json({});
  }
};
