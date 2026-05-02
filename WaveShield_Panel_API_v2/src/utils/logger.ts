import discordService from "../services/discord.service";

const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta ? meta : '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[ERROR] ${message}`, meta ? meta : '');

    try {
      // Extract error object if present in meta
      const error = meta?.error || meta;

      // Format message to include meta information if available
      let formattedMessage = message;
      if (meta && typeof meta === 'object' && !meta.error) {
        formattedMessage += ` | Additional context: ${JSON.stringify(meta)}`;
      }

      discordService.sendErrorLog({
        message: formattedMessage,
        stack: error instanceof Error ? error.stack :
          (typeof error === 'object' ? JSON.stringify(error) : String(error || '')),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date()
      });
    } catch (discordError) {
      // Avoid recursive error reporting
      console.error(`[ERROR] Failed to send error to Discord:`, discordError);
    }
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta ? meta : '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, meta ? meta : '');
    }
  }
};

export default logger;
