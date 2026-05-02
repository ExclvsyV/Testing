/**
 * WaveShield Panel API v2
 * Server creation and lifecycle management
 */

import http from 'http';
import app from './app';
import config from './config';
import logger from './utils/logger';
import db from './services/database.service';
import discordService from './services/discord.service';
import { websocketService } from './services/websocket.service';

const httpServer = http.createServer(app);
websocketService.initialize(httpServer);

// Start the server
const server = httpServer.listen(config.port, () => {
  logger.info(`Server is running at http://localhost:${config.port}`);
  logger.info(`Environment: ${config.env}`);
  logger.info('WebSocket server initialized');
});

/**
 * Graceful shutdown handler
 * Properly closes database connections and server before exiting
 */
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    // Close database connection
    await db.end();
    logger.info('Database connections closed');

    // Close server
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(async () => {
      const errorMessage = 'Could not close connections in time, forcefully shutting down';
      logger.error(errorMessage);

      try {
        await discordService.sendErrorLog({
          message: `SHUTDOWN ERROR: ${errorMessage}`,
          timestamp: new Date(),
          environment: config.env
        });
      } catch (discordError) {
        logger.error('Failed to send shutdown error to Discord', { error: discordError });
      }

      // Small delay to allow Discord webhook to complete
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }, 10000).unref();
  } catch (error) {
    logger.error('Error during shutdown', { error });

    try {
      await discordService.sendErrorLog({
        message: `SHUTDOWN ERROR: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        timestamp: new Date(),
        environment: config.env
      });
    } catch (discordError) {
      logger.error('Failed to send shutdown error to Discord', { error: discordError });
    }

    // Small delay to allow Discord webhook to complete
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
};

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);