import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';
import discordService from './discord.service';
import licenseService from './license.service';
import versionService from './version.service';
import { onPlayerBan, onPlayerUnban, onUnbanAll, updateBanList, updatePlayerList, updateServerInfos } from '../socket/handlers/server-infos.handler';

export class WebSocketService {
    private static instance: WebSocketService;
    private io: SocketIOServer | null = null;
    private connectedServers: Map<string, string> = new Map();
    private connectedClients: Map<string, string> = new Map();
    private connectedDiscords: Map<string, string> = new Map();

    private constructor() { }

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    public initialize(httpServer: HttpServer): void {
        try {
            this.io = new SocketIOServer(httpServer, {
                cors: {
                    origin: "*", // You might want to restrict this in production
                    methods: ["GET", "POST"],
                    allowedHeaders: ["User-Agent", "Content-Type"],
                    credentials: true
                },
                connectTimeout: 10000,
            });

            this.io.use(async (socket, next) => {
                try {
                    const query = socket.handshake.query;
                    const userAgent = socket.handshake.headers['user-agent'];
                    const clientIp = (socket.handshake.address || '').replace('::1', '127.0.0.1').replace('::ffff:', '');

                    const isServer = userAgent && userAgent === 'WaveShield_Server';

                    if (isServer) {
                        const licenseKey = query.licenseKey as string;
                        const version = query.version as string;

                        if (!licenseKey) {
                            logger.warn('Server connection attempt without license key', { socketId: socket.id });
                            return next(new Error('License key required'));
                        }

                        if (!version) {
                            logger.warn('Server connection attempt without version', { socketId: socket.id, licenseKey });
                            return next(new Error('Version required'));
                        }

                        const latestVersion = await versionService.getVersion();
                        if (version !== latestVersion && version !== latestVersion + "-beta") {
                            logger.warn('Version mismatch', { socketId: socket.id, licenseKey, version, latestVersion });
                            return next(new Error(`Version mismatch. Latest: ${latestVersion}`));
                        }

                        const validationResult = await licenseService.validateLicense(licenseKey, clientIp);
                        if (!validationResult.valid) {
                            logger.warn('License validation failed', { socketId: socket.id, validationResult });
                            return next(new Error(`License validation failed: ${validationResult.message}, code: ${validationResult.code}`));
                        }

                        socket.data.isServer = true;
                        socket.data.licenseKey = licenseKey;
                        socket.data.licenseId = validationResult.license.id;
                        socket.data.version = version;

                        return next();
                    } else {
                        const discordId = query.discordId as string;
                        if (!discordId) {
                            logger.warn('Client connection attempt without Discord ID', { socketId: socket.id });
                            return next(new Error('Discord ID required for website clients'));
                        }

                        socket.data.isServer = false;
                        socket.data.discordId = discordId;

                        return next();
                    }
                } catch (error) {
                    logger.error('Error in socket authentication middleware', {
                        error,
                        address: socket.handshake.address
                    });
                    return next(new Error('Internal server error during authentication'));
                }
            });

            this.setupSocketEvents();
            logger.info('WebSocket server initialized successfully');
        } catch (error) {
            logger.error('Error initializing WebSocket server', { error });
            discordService.sendErrorLog({
                message: 'Failed to initialize WebSocket server',
                stack: error instanceof Error ? error.stack : String(error),
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date()
            });
        }
    }

    private setupSocketEvents(): void {
        if (!this.io) return;

        this.io.on('connection', (socket) => {
            if (socket.data.isServer) {
                const { licenseKey, version, licenseId } = socket.data;

                this.connectedServers.set(socket.id, licenseId);
                socket.join(`server:${licenseId}`);

                socket.emit('authenticated', { success: true });
                logger.info('Server connected', { socketId: socket.id, licenseId });

                socket.on('subscribe-server-updates', () => {
                    const licenseId = this.connectedServers.get(socket.id);
                    if (licenseId) {
                        socket.join(`server:${licenseId}`);
                        logger.info('Server subscribed to server updates', { socketId: socket.id, licenseId });
                    } else {
                        socket.emit('error', { message: 'Authentication required' });
                    }
                });

                socket.on("unsubscribe-server-updates", () => {
                    const licenseId = this.connectedServers.get(socket.id);
                    if (licenseId) {
                        socket.leave(`server:${licenseId}`);
                        logger.info('Server unsubscribed from server updates', { socketId: socket.id, licenseId });
                    } else {
                        socket.emit('error', { message: 'Authentication required' });
                    }
                })

                socket.on("updateServerInfos", updateServerInfos)
                socket.on("updatePlayerList", updatePlayerList)
                socket.on("updateBanList", updateBanList)
                socket.on("onPlayerBan", onPlayerBan)
                socket.on("onPlayerUnban", onPlayerUnban)
                socket.on("onUnbanAll", onUnbanAll)
            } else {
                const { discordId } = socket.data;

                this.connectedClients.set(discordId, socket.id);
                this.connectedDiscords.set(socket.id, discordId);

                socket.emit('authenticated', { success: true, discordId });
                logger.info('Client connected', { socketId: socket.id, discordId });

                socket.on('subscribe-license-updates', (licenseId: string) => {
                    console.log('subscribe-license-updates', licenseId);
                    const discordId = this.connectedDiscords.get(socket.id);
                    if (discordId) {
                        socket.join(`license:${licenseId}`);
                        logger.info('Client subscribed to license updates', { discordId, licenseId });
                    } else {
                        socket.emit('error', { message: 'Authentication required' });
                    }
                });

                socket.on("unsubscribe-license-updates", (licenseId: string) => {
                    socket.leave(`license:${licenseId}`);
                    logger.info('Client unsubscribed from license updates', { discordId, licenseId });
                })

                socket.on("requestUpdatePlayerList", (licenseId: string) => {
                    //todo verification qu'il a les droits de trigger cette license
                    this.io?.to(`server:${licenseId}`).emit('requestUpdatePlayerList');
                })

                socket.on("requestUpdateBanList", (licenseId: string) => {
                    //todo verification qu'il a les droits de trigger cette license
                    this.io?.to(`server:${licenseId}`).emit('requestUpdateBanList');
                })

                socket.on("configUpdated", (licenseId: string) => {
                    //todo verification qu'il a les droits de trigger cette license
                    this.io?.to(`server:${licenseId}`).emit('configUpdated');
                })

                socket.on("unbanAllPlayers", (licenseId: string) => {
                    //todo verification qu'il a les droits de trigger cette license
                    this.io?.to(`server:${licenseId}`).emit('unbanAllPlayers');
                })
            }

            // Handle disconnection
            socket.on('disconnect', () => {
                if (socket.data.isServer) {
                    const licenseId = socket.data.licenseId;
                    this.connectedServers.delete(socket.id);
                    logger.info('Server disconnected', { socketId: socket.id, licenseId });
                } else {
                    const discordId = socket.data.discordId;
                    this.connectedClients.delete(discordId);
                    this.connectedDiscords.delete(socket.id);
                    logger.info('Client disconnected', { socketId: socket.id, discordId });
                }
            });
        });
    }

    // Method to emit events to specific servers
    public emitToServer(licenseId: string, event: string, data: any): void {
        if (!this.io) return;
        this.io.to(`server:${licenseId}`).emit(event, data);
    }

    // Method to emit events to specific clients
    public emitToDiscordId(discordId: string, event: string, data: any): void {
        if (!this.io) return;
        const socketId = this.connectedClients.get(discordId);
        if (!socketId) return;
        this.io.to(socketId).emit(event, data);
    }

    // Method to emit events to all connected users
    public emitToAll(event: string, data: any): void {
        if (!this.io) return;
        this.io.emit(event, data);
    }

    public emitToAllServers(event: string, data: any): void {
        if (!this.io) return;
        for (const [socketId, licenseId] of this.connectedServers) {
            this.io.to(`server:${licenseId}`).emit(event, data);
        }
    }

    public emitToAllClients(event: string, data: any): void {
        if (!this.io) return;
        for (const [discordId, socketId] of this.connectedClients) {
            this.io.to(socketId).emit(event, data);
        }
    }

    // Get number of connected servers
    public getConnectedServersCount(): number {
        return this.connectedServers.size;
    }

    // Get all connected servers
    public getConnectedServers(): string[] {
        return [...new Set(this.connectedServers.values())];
    }

    // Get number of connected clients
    public getConnectedClientsCount(): number {
        return this.connectedClients.size;
    }

    // Get all connected clients
    public getConnectedClients(): string[] {
        return [...new Set(this.connectedClients.values())];
    }
}

export const websocketService = WebSocketService.getInstance();
