import { Router, Request, Response } from 'express';
import db from '../services/database.service';
import logger from '../utils/logger';

const router = Router();

router.get('/:licenseId/players', async (req: Request, res: Response) => {
    try {
        const { licenseId } = req.params;

        if (!licenseId) {
            return res.status(400).json({ success: false, message: 'License ID is required' });
        }

        const result: any = await db.query(
            'SELECT "playerList", "updatedAt" FROM "Server_Infos" WHERE "id" = $1 LIMIT 1',
            [licenseId]
        );

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Server info not found' });
        }

        const { playerList, updatedAt } = result[0];

        // Check if the server is online (updated within the last 2 minutes)
        const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
        const online = updatedAt > twoMinutesAgo;

        if (!online) {
            return res.status(200).json({ success: true, players: [], message: 'Server is offline', offline: true });
        }

        return res.status(200).json({ success: true, players: playerList });
    } catch (error) {
        logger.error('Error retrieving server info', { error, licenseId: req.params.licenseId });
        return res.status(500).json({ success: false, message: 'Internal server error', players: [] });
    }
});

router.get('/:licenseId/bans', async (req: Request, res: Response) => {
    try {
        const { licenseId } = req.params;

        if (!licenseId) {
            return res.status(400).json({ success: false, message: 'License ID is required' });
        }

        const result: any = await db.query(
            'SELECT "banList", "updatedAt" FROM "Server_Infos" WHERE "id" = $1 LIMIT 1',
            [licenseId]
        );

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Server info not found' });
        }

        const { banList, updatedAt } = result[0];

        // Check if the server is online (updated within the last 2 minutes)
        const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
        const online = updatedAt > twoMinutesAgo;

        if (!online) {
            return res.status(200).json({ success: true, bans: [], message: 'Server is offline', offline: true });
        }

        return res.status(200).json({ success: true, bans: banList });
    } catch (error) {
        logger.error('Error retrieving server info', { error, licenseId: req.params.licenseId });
        return res.status(500).json({ success: false, message: 'Internal server error', bans: [] });
    }
});



export default router;
