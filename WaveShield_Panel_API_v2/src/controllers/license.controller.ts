import { Request, Response } from 'express';
import licenseService from '../services/license.service';
import fileService from '../services/file.service';
import config from '../config';
import logger from '../utils/logger';
import tokenService from '../services/token.service';

export const authenticateLicense = async (req: Request, res: Response) => {
  const licenseKey = req.query.license as string;
  const useBeta = req.query.beta !== undefined;
  const serverName = req.body.serverName as string;
  const bannerUrl = req.body.bannerUrl as string;
  const version = req.body.version as string;
  const clientIp = req.clientIp!;

  if (!licenseKey || licenseKey === '') {
    return res.status(404).send();
  }

  const fileToAccess = req.body.fileToAccess;
  if (!fileToAccess) {
    return res.status(404).send();
  }

  // Validate license
  const validation = await licenseService.validateLicense(licenseKey, clientIp);
  if (!validation.valid) {
    return res.status(validation.code).send();
  }

  // Handle server load request specifically
  if (fileToAccess === 'serverLoad') {
    const isBlacklisted = await licenseService.isIpBlacklisted(clientIp);
    if (isBlacklisted) {
      return res.status(912).send();
    }

    // If IP is empty, update it
    if (!validation.license.serverIp || validation.license.serverIp === '') {
      await licenseService.updateServerIp(licenseKey, clientIp);
    }

    // Update server name if provided
    if (serverName && serverName !== '' && serverName !== validation.license.serverName) {
      await licenseService.updateServerName(licenseKey, serverName);
    }

    // Update server banner if provided
    if (bannerUrl && bannerUrl !== '' && bannerUrl !== validation.license.bannerUrl) {
      await licenseService.updateServerBanner(licenseKey, bannerUrl);
    }

    if (version && Number(version.replace(/\./g, '').replace(/-beta$/, '')) >= 4469) {
      const authToken = tokenService.generateToken(licenseKey, version);
      res.setHeader('x-ws-token', authToken);
    } else {
      res.setHeader('x-ws-token', 'damnthisisafakeauthlemmefuckyourcompnowlmao');
    }
  }

  // Get requested file content
  const fileContent = await fileService.getFile(fileToAccess, useBeta);
  if (!fileContent) {
    return res.status(404).send();
  }

  return res.send(fileContent);
};