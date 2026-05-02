import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_SSL === 'true'
  },
  auth: {
    userAgent: 'AYZNNNISTHEBEST',
    webhookUrl: 'https://discord.com/api/webhooks/893845061941477428/0FhwyypxxNwImR_V0iF-UDbGpqzKoIIIWBSPUrdCqtLy0E4S9xaPqUEFjsJnF9d7bD2D',
    errorWebhookUrl: 'https://discordapp.com/api/webhooks/1352259401691697183/j9-eU0sv0fv_9Ba2z1JS9ELXVrbpGqcZoFj7M2wJJmGpf_ZHd6nBGs6z_vaabIcEzVVy',
  },
  files: {
    paths: {
      updater: path.resolve(__dirname, '../updater'),
      updaterBeta: path.resolve(__dirname, '../updaterBETA'),
    }
  }
};

export default config;