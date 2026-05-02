import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';

class FileService {
  private validFiles = ['serverLoad', 'sharedFile', 'sharedFileJS', 'serverFileJS', 'indexHTML', 'clientMain', 'serverAuth', "serverExports", "fxmanifest"];

  async getFile(fileName: string, useBeta: boolean = false): Promise<string | null> {
    if (!this.validFiles.includes(fileName)) {
      logger.warn('Invalid file access attempt', { fileName });
      return null;
    }

    let filePath: string;
    let fileExtension = 'lua';

    // Set the correct file extension
    if (fileName === 'sharedFileJS' || fileName === 'serverFileJS') {
      fileExtension = 'js';
    } else if (fileName === 'indexHTML') {
      fileExtension = 'html';
    }

    // Build the path
    const basePath = useBeta ? config.files.paths.updaterBeta : config.files.paths.updater;
    filePath = path.join(basePath, `${fileName}.${fileExtension}`);

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      logger.error('Error reading file', { error, fileName, filePath });
      return null;
    }
  }
}

export default new FileService();
