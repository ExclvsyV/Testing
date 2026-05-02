import { Request, Response } from 'express';
import versionService from '../services/version.service';

export const getVersion = async (req: Request, res: Response) => {
  const version = await versionService.getVersion();

  if (!version) {
    return res.status(404).send();
  }

  return res.send(version);
};