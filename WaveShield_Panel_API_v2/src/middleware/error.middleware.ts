import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import discordService from '../services/discord.service';
import config from '../config';

export const errorHandler = async (error: Error, req: Request, res: Response, next: NextFunction) => {
    // Log error to console
    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        ip: req.clientIp || req.ip
    });

    // Send error to Discord
    try {
        await discordService.sendErrorLog({
            message: error.message,
            stack: error.stack,
            path: req.path,
            method: req.method,
            ip: req.clientIp || req.ip,
            requestBody: sanitizeRequestData(req.body),
            requestQuery: sanitizeRequestData(req.query),
            timestamp: new Date(),
            environment: config.env
        });
    } catch (discordError) {
        logger.error('Failed to send error to Discord', { error: discordError });
    }

    return res.status(500).json({
        error: 'Internal server error'
    });
};

export const notFoundHandler = (req: Request, res: Response) => {
    logger.warn('Route not found', {
        path: req.path,
        method: req.method,
        ip: req.clientIp || req.ip
    });

    return res.status(404).json({
        error: 'Resource not found'
    });
};

// Helper function to sanitize sensitive data before logging
function sanitizeRequestData(data: any): any {
    if (!data) return {};

    const sanitized = { ...data };

    // List of sensitive fields to redact
    const sensitiveFields = ['xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'];

    // Redact sensitive data
    Object.keys(sanitized).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeRequestData(sanitized[key]);
        }
    });

    return sanitized;
}