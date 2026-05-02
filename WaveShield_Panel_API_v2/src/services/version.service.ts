import db from './database.service';
import logger from '../utils/logger';

interface VersionRecord {
    version: string;
    updatedAt: Date;
}

class VersionService {
    private versionCache: string | null = null;
    private lastCheck: number = 0;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Start the update interval as soon as the service is instantiated
        this.startUpdateInterval();
    }

    private startUpdateInterval() {
        // Clear any existing interval first
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Set interval to update version every minute
        this.updateInterval = setInterval(async () => {
            await this.refreshVersionCache();
        }, 60 * 1000); // 1 minute

        // Initial fetch
        this.refreshVersionCache().catch(err => {
            logger.error('Failed to perform initial version cache refresh', { error: err });
        });
    }

    private async refreshVersionCache(): Promise<void> {
        try {
            const result = await db.query<VersionRecord>(
                'SELECT "version", "updatedAt" FROM "Version" ORDER BY "updatedAt" DESC LIMIT 1'
            );

            if (result.length > 0) {
                this.versionCache = result[0].version;
                this.lastCheck = Date.now();
                logger.debug('Version cache updated', { version: this.versionCache });
            } else {
                // No version found in database
                logger.warn('No version record found in database');
                this.versionCache = '1.0.0'; // Fallback version
            }
        } catch (error) {
            logger.error('Error updating version cache', { error });
            // Don't update cache on error
        }
    }

    async getVersion(): Promise<string> {
        // If no cache or it's been more than 5 minutes, force refresh
        if (!this.versionCache || (Date.now() - this.lastCheck > 5 * 60 * 1000)) {
            await this.refreshVersionCache();
        }

        return this.versionCache || '1.0.0';
    }

    // Clean up method to stop interval when service is no longer needed
    shutdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            logger.debug('Version service update interval stopped');
        }
    }
}

export default new VersionService();
