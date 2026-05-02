import config from '../config';
import logger from '../utils/logger';

interface CrackAttemptData {
  licenseKey: string;
  ip: string;
  reason: string;
  details: string;
  version: string;
}

interface ErrorLogData {
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  ip?: string;
  requestBody?: any;
  requestQuery?: any;
  timestamp: Date;
  environment: string;
}

class DiscordService {
  async sendCrackAttemptAlert(data: CrackAttemptData): Promise<boolean> {
    try {
      const webhookUrl = config.auth.webhookUrl;
      
      const hookObject = {
        content: "@everyone",
        username: "Anti Crackar",
        tts: true,
        embeds: [
          {
            title: "Someone tried to crack waveshield (v4) :/",
            type: "rich",
            description: `**License: ${data.licenseKey}\nIP: ${data.ip}\nVersion: ${data.version}\nReason: ${data.reason}\nDetails: \`\`\`${data.details}\`\`\`**`,
            color: parseInt("FFFFFF", 16),
            timestamp: new Date().toISOString(),
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hookObject)
      });
      
      if (!response.ok) {
        logger.warn('Discord webhook failed', {
          status: response.status,
          statusText: response.statusText
        });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending Discord alert', { error });
      return false;
    }
  }

  async sendErrorLog(data: ErrorLogData): Promise<boolean> {
    try {
      // Use a different webhook URL for errors if you want
      const webhookUrl = config.auth.errorWebhookUrl;
      
      // Format request data if present
      let requestInfo = '';
      if (data.path) {
        requestInfo += `**Path:** ${data.path}\n`;
        requestInfo += `**Method:** ${data.method || 'N/A'}\n`;
        requestInfo += `**IP:** ${data.ip || 'Unknown'}\n`;
        
        if (data.requestQuery && Object.keys(data.requestQuery).length > 0) {
          requestInfo += `**Query Params:**\n\`\`\`json\n${JSON.stringify(data.requestQuery, null, 2)}\n\`\`\`\n`;
        }
        
        if (data.requestBody && Object.keys(data.requestBody).length > 0) {
          requestInfo += `**Request Body:**\n\`\`\`json\n${JSON.stringify(data.requestBody, null, 2)}\n\`\`\`\n`;
        }
      }
      
      // Create the Discord embed
      const hookObject = {
        username: "WaveShield Error Monitor",
        embeds: [
          {
            title: `❌ Error in ${data.environment} environment`,
            color: 15158332, // Red color
            description: `**Error:** ${data.message}\n\n${requestInfo}`,
            fields: data.stack ? [
              {
                name: "Stack Trace",
                value: `\`\`\`\n${data.stack.substring(0, 1000)}${data.stack.length > 1000 ? '...' : ''}\n\`\`\``,
              }
            ] : [],
            timestamp: data.timestamp.toISOString(),
            footer: {
              text: `WaveShield Panel API v2 • ${data.environment}`
            }
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hookObject)
      });
      
      if (!response.ok) {
        logger.warn('Discord error webhook failed', {
          status: response.status,
          statusText: response.statusText
        });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending Discord error alert', { error });
      return false;
    }
  }
}

export default new DiscordService();