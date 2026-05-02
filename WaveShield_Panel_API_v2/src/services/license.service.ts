import db from './database.service';
import discordService from './discord.service';
import logger from '../utils/logger';

interface License {
  licenseKey: string;
  serverIp: string;
  serverExpiration: number;
  isBanned: boolean;
  serverName: string;
  serverConfiguration: any;
}

class LicenseService {
  async validateLicense(licenseKey: string, clientIp: string): Promise<any> {
    try {
      const queryString = 'SELECT "id", "serverIp", "serverExpiration", "isBanned", "serverName", "bannerUrl" FROM "License" WHERE "licenseKey" = $1';
      const licenses = await db.query<License>(queryString, [licenseKey]);

      if (licenses.length === 0) {
        return { valid: false, code: 909, message: 'License not found' };
      }

      const license = licenses[0];

      if (license.isBanned) {
        return { valid: false, code: 912, message: 'License banned' };
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime >= license.serverExpiration) {
        return { valid: false, code: 910, message: 'License expired' };
      }

      if (license.serverIp && license.serverIp.length > 0 && clientIp !== license.serverIp) {
        console.log(license.serverIp, clientIp)
        return { valid: false, code: 911, message: 'IP mismatch' };
      }

      return { valid: true, license };
    } catch (error) {
      logger.error('Error validating license', { error, licenseKey, clientIp });
      return { valid: false, code: 500, message: 'Database error' };
    }
  }

  async updateServerIp(licenseKey: string, serverIp: string): Promise<boolean> {
    try {
      await db.query(
        'UPDATE "License" SET "serverIp" = $1 WHERE "licenseKey" = $2',
        [serverIp, licenseKey]
      );
      return true;
    } catch (error) {
      logger.error('Error updating server IP', { error, licenseKey, serverIp });
      return false;
    }
  }

  async updateServerName(licenseKey: string, serverName: string): Promise<boolean> {
    try {
      await db.query(
        'UPDATE "License" SET "serverName" = $1 WHERE "licenseKey" = $2',
        [serverName, licenseKey]
      );
      return true;
    } catch (error) {
      logger.error('Error updating server name', { error, licenseKey, serverName });
      return false;
    }
  }

  async updateServerBanner(licenseKey: string, bannerUrl: string): Promise<boolean> {
    try {
      await db.query(
        'UPDATE "License" SET "bannerUrl" = $1 WHERE "licenseKey" = $2',
        [bannerUrl, licenseKey]
      );
      return true;
    } catch (error) {
      logger.error('Error updating server banner', { error, licenseKey, bannerUrl });
      return false;
    }
  }

  async banLicense(licenseKey: string, reason: string, ip: string, details: string, version: string): Promise<void> {
    try {
      // Ban the license
      await db.query(
        'UPDATE "License" SET "isBanned" = $1 WHERE "licenseKey" = $2',
        [true, licenseKey]
      );

      await db.query(
        'INSERT INTO "Blacklisted_Id" ("HWID", "licenseKey", "reason") VALUES ($1, $2, $3) ON CONFLICT ("HWID") DO NOTHING',
        [ip, licenseKey, reason]
      );

      // Send Discord notification
      await discordService.sendCrackAttemptAlert({
        licenseKey,
        ip,
        reason,
        details,
        version
      });

      logger.info('License banned successfully', { licenseKey, reason, ip });
    } catch (error) {
      logger.error('Error banning license', { error, licenseKey, reason });
    }
  }

  async getServerConfiguration(licenseKey: string, clientIp: string): Promise<any> {
    try {
      const queryString = 'SELECT "serverConfiguration" FROM "License" WHERE "licenseKey" = $1 AND "serverIp" = $2';
      const result = await db.query<License>(queryString, [licenseKey, clientIp]);

      if (!result || result.length === 0 || !result[0].serverConfiguration) {
        return null;
      }

      return result[0].serverConfiguration;
    } catch (error) {
      logger.error('Error getting server configuration', { error, licenseKey, clientIp });
      return null;
    }
  }

  async isIpBlacklisted(ip: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT * FROM "Blacklisted_Id" WHERE "HWID" = $1 LIMIT 1',
        [ip]
      );

      return result.length > 0;
    } catch (error) {
      logger.error('Error checking blacklisted IP', { error, ip });
      return false;
    }
  }
}

export default new LicenseService();
