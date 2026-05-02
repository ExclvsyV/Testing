import { Router, Request, Response } from 'express';
import db from '../services/database.service';
import logger from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';

const router = Router();

// Get server info by license ID
router.get('/', async (req: Request, res: Response) => {
    try {
        const webSocketService = WebSocketService.getInstance();
        const onlineServers = webSocketService.getConnectedServersCount();
        const onlineUsers = webSocketService.getConnectedClientsCount();

        //onlinePlayers = db "Server_Infos" sum of all playerCount
        const twoMinutesAgo = new Date(Date.now() - (2 * 60 * 1000));
        const _onlinePlayers: any = await db.query(
            'SELECT SUM("playerCount") FROM "Server_Infos" WHERE "updatedAt" > $1',
            [twoMinutesAgo]
        );


        const onlinePlayers = Number(_onlinePlayers[0]?.sum) || 0;

        return res.status(200).json({
            success: true, data: {
                online: true,
                onlineServers,
                onlinePlayers,
                onlineUsers,
            }
        });
    } catch (error) {
        logger.error('Error retrieving waveshield infos', { error });
        return res.status(500).json({
            success: false, data: {
                online: false
            }
        });
    }
});

export default router;
