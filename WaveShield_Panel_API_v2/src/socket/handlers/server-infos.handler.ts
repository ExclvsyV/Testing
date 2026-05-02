import { Socket } from 'socket.io';
import logger from '../../utils/logger';
import { WebSocketService } from '../../services/websocket.service';
import db from '../../services/database.service';

interface ServerInfos {
  playerCount: number,
  slots: number,
  playerList: { [id: string]: string },
  banCount: number,
  banList: {
    [id: string]: {
      name: string,
      reason: string,
      screenshot: string,
      date: number
    }
  },
  timestamp: number
};

/**
 * Handler for the updateServerInfos event
 */
export async function updateServerInfos(this: Socket, data: ServerInfos) {
  try {
    const licenseId = this.data.licenseId;
    if (!licenseId) return;

    // Your updateServerInfos logic here
    // For example:
    // const webSocketService = WebSocketService.getInstance();

    // First, check if an entry exists
    const existingInfo = await db.query('SELECT * FROM "Server_Infos" WHERE "id" = $1', [licenseId]);

    if (existingInfo.length > 0) {
      // Update existing entry
      await db.query(
        'UPDATE "Server_Infos" SET "playerCount" = $1, "slots" = $2, "playerList" = $3, "banCount" = $4, "banList" = $5, "updatedAt" = $6 WHERE "id" = $7',
        [data.playerCount || 0, data.slots || 0, JSON.stringify(data.playerList) || {}, data.banCount || 0, JSON.stringify(data.banList) || {}, new Date(), licenseId]
      );
    } else {
      // Insert new entry
      await db.query(
        'INSERT INTO "Server_Infos" ("id", "licenseKey", "playerCount", "slots", "playerList", "banCount", "banList", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [licenseId, this.data.licenseKey, data.playerCount || 0, data.slots || 0, JSON.stringify(data.playerList) || {}, data.banCount || 0, JSON.stringify(data.banList) || {}, new Date()]
      );
    }

    logger.debug(`Updated server info for licenseId ${licenseId}`, {
      socketId: this.id,
      data
    });

    this.to(`license:${licenseId}`).emit('updatedPlayerList', licenseId, data.playerList);
    this.to(`license:${licenseId}`).emit('updatedBanList', licenseId, data.banList);
  } catch (error) {
    logger.error('Error in updateServerInfos handler', { error, socketId: this.id });
  }
}

export async function updatePlayerList(this: Socket, playerList: any) {
  const licenseId = this.data.licenseId;

  try {
    await db.query(
      'UPDATE "Server_Infos" SET "playerList" = $1, "playerCount" = $2 WHERE "id" = $3',
      [JSON.stringify(playerList) || [], playerList.length || 0, licenseId]
    );

    this.to(`license:${licenseId}`).emit('updatedPlayerList', licenseId, playerList);
  } catch (error) {
    logger.error('Error in updatePlayerList handler', { error, socketId: this.id });
  }
}

export async function updateBanList(this: Socket, banList: any) {
  const licenseId = this.data.licenseId;
  try {
    await db.query(
      'UPDATE "Server_Infos" SET "banList" = $1, "banCount" = $2 WHERE "id" = $3',
      [JSON.stringify(banList) || {}, Object.keys(banList).length || 0, licenseId]
    );

    this.to(`license:${licenseId}`).emit('updatedBanList', licenseId, banList);
  } catch (error) {
    logger.error('Error in updateBanList handler', { error, socketId: this.id });
  }
}

export async function onPlayerBan(this: Socket, banData: any) {
  const licenseId = this.data.licenseId;
  if (!licenseId) return;

  try {
    // Get current ban list and count
    const serverInfo: any = await db.query('SELECT "banList" FROM "Server_Infos" WHERE "id" = $1', [licenseId]);

    if (serverInfo.length > 0) {
      const banList = serverInfo[0].banList || {};

      // Add new ban to the list
      const banId = `waveshield_ban_${banData.id}`;
      banList[banId] = banData

      // Update the database with new ban list and incremented count
      await db.query(
        'UPDATE "Server_Infos" SET "banList" = $1, "banCount" = $2, "updatedAt" = $3 WHERE "id" = $4',
        [JSON.stringify(banList), Object.keys(banList).length, new Date(), licenseId]
      );
      // Emit event to notify connected clients
      this.to(`license:${licenseId}`).emit('updatedBanList', licenseId, banList);
      this.to(`license:${licenseId}`).emit('playerBanned', licenseId, banData);

      logger.debug(`Added new ban for licenseId ${licenseId}`, {
        socketId: this.id,
        banId,
        banData
      });
    }
  } catch (error) {
    logger.error('Error in onPlayerBan handler', { error, socketId: this.id });
  }
}

export async function onPlayerUnban(this: Socket, banId: any) {
  const fullBanId = `waveshield_ban_${banId}`;
  const licenseId = this.data.licenseId;
  if (!licenseId) return;

  try {
    // Get current ban list and count
    const serverInfo: any = await db.query('SELECT "banList", "banCount" FROM "Server_Infos" WHERE "id" = $1', [licenseId]);

    if (serverInfo.length > 0) {
      const banList = serverInfo[0].banList || {};
      const banCount = serverInfo[0].banCount || 0;

      // Check if the ban exists
      if (banList[fullBanId]) {
        // Remove the ban
        delete banList[fullBanId];

        // Update the database with modified ban list and decremented count
        await db.query(
          'UPDATE "Server_Infos" SET "banList" = $1, "banCount" = $2, "updatedAt" = $3 WHERE "id" = $4',
          [JSON.stringify(banList), Math.max(0, banCount - 1), new Date(), licenseId]
        );

        // Emit event to notify connected clients
        this.to(`license:${licenseId}`).emit('playerUnbanned', licenseId, fullBanId);

        logger.debug(`Removed ban ${fullBanId} for licenseId ${licenseId}`, {
          socketId: this.id
        });
      }
    }
  } catch (error) {
    logger.error('Error in onPlayerUnban handler', { error, socketId: this.id });
  }
}

export async function onUnbanAll(this: Socket) {
  const licenseId = this.data.licenseId;
  if (!licenseId) return;
  
  try {
    // Update the database to clear all bans
    await db.query(
      'UPDATE "Server_Infos" SET "banList" = $1, "banCount" = $2, "updatedAt" = $3 WHERE "id" = $4',
      [JSON.stringify({}), 0, new Date(), licenseId]
    );
    
    // Emit events to notify connected clients
    this.to(`license:${licenseId}`).emit('allPlayersUnbanned', licenseId);
    
    logger.debug(`All bans cleared for licenseId ${licenseId}`, {
      socketId: this.id
    });
  } catch (error) {
    logger.error('Error in onUnbanAll handler', { error, socketId: this.id });
  }
}
