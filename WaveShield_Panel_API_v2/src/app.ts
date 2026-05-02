/**
 * WaveShield Panel API v2
 * Express application configuration
 */

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import logger from './utils/logger';
import discordService from './services/discord.service';
import discordBotService from './services/discord-bot.service';
import config from './config';

// Initialize Express app
const app = express();

app.use(cors({
    origin: ['http://localhost:3000', 'https://waveshield.xyz', 'https://cloud.waveshield.xyz'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(bodyParser.json());

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// API routes
app.use('/', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start the Discord bot
discordBotService.start().then(success => {
    if (success) {
        console.log('Discord bot started successfully');
    } else {
        console.error('Failed to start Discord bot');
    }
});

// Uncaught exception handler
process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });

    try {
        await discordService.sendErrorLog({
            message: `UNCAUGHT EXCEPTION: ${error.message}`,
            stack: error.stack,
            timestamp: new Date(),
            environment: config.env
        });
    } catch (discordError) {
        logger.error('Failed to send uncaught exception to Discord', { error: discordError });
    }

    // Give Discord webhook a chance to complete before exiting
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', async (reason, promise) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : 'No stack trace available';

    logger.error('Unhandled promise rejection', { reason: errorMessage, stack: errorStack });

    try {
        await discordService.sendErrorLog({
            message: `UNHANDLED REJECTION: ${errorMessage}`,
            stack: errorStack,
            timestamp: new Date(),
            environment: config.env
        });
    } catch (discordError) {
        logger.error('Failed to send unhandled rejection to Discord', { error: discordError });
    }

    // Give Discord webhook a chance to complete before exiting
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

export default app;
