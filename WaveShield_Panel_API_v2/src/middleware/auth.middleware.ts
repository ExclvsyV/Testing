import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../utils/logger';

export const validateUserAgent = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'];
  
  if (userAgent !== config.auth.userAgent) {
    logger.warn('Invalid user agent detected', { 
      ip: req.ip, 
      userAgent,
      path: req.path
    });
    return res.status(667).send();
  }
  
  next();
};

export const getClientIp = (req: Request, res: Response, next: NextFunction) => {
  let clientIp = req.ip;

  if (req.headers['x-forwarded-for']) {
    const xForwardedFor = req.headers['x-forwarded-for'];

    if (typeof xForwardedFor === 'string') {
      clientIp = xForwardedFor.split(',')[0];
    } else if (Array.isArray(xForwardedFor)) {
      clientIp = xForwardedFor[0] || req.ip;
    }
  }
  
  req.clientIp = (clientIp || '').replace('::1', '127.0.0.1').replace('::ffff:', '');
  next();
};