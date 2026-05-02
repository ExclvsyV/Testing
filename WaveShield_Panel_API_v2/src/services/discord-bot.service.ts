import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    CommandInteraction,
    TextChannel,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    GuildMemberRoleManager,
    ActivityType
} from 'discord.js';
import { randomBytes } from 'crypto';
import discordBotConfig from '../config/discord-bot.config';
import licenseService from './license.service';
import versionService from './version.service';

import db from './database.service';
import logger from '../utils/logger';

function generateUUID() {
    var d = new Date().getTime();
    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;

    return 'xxxxxxxx-yxxx-yxxx-yxxx-xxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16;
        if (d > 0) {
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else {
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

class DiscordBotService {
    private client: Client;
    private commands: any[] = [];
    private statusUpdateInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages
            ]
        });

        this.registerCommands();
        this.setupEventHandlers();
    }

    private registerCommands() {
        // Ban command
        this.commands.push(
            new SlashCommandBuilder()
                .setName('ban')
                .setDescription('Ban a license key')
                .addStringOption(option =>
                    option.setName('license_key')
                        .setDescription('The license key to ban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for banning')
                        .setRequired(true))
        );

        // Unban command
        this.commands.push(
            new SlashCommandBuilder()
                .setName('unban')
                .setDescription('Unban a license key')
                .addStringOption(option =>
                    option.setName('license_key')
                        .setDescription('The license key to unban')
                        .setRequired(true))
        );

        // Create version command
        this.commands.push(
            new SlashCommandBuilder()
                .setName('createversion')
                .setDescription('Create a new version')
                .addStringOption(option =>
                    option.setName('version')
                        .setDescription('The version to create')
                        .setRequired(true))
        );

        // Generate command
        this.commands.push(
            new SlashCommandBuilder()
                .setName('generate')
                .setDescription('Generate new license keys')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('License type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Monthly', value: 'monthly' },
                            { name: 'Quarterly', value: 'quarterly' },
                            { name: 'Yearly', value: 'yearly' },
                            { name: 'Lifetime', value: 'lifetime' }
                        ))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of keys to generate')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(40))
        );
    }

    private setupEventHandlers() {
        this.client.once('ready', async () => {
            logger.info('Discord bot is ready!');

            await this.updateBotStatus();

            // Set up status update interval (every 10 minutes)
            this.statusUpdateInterval = setInterval(() => {
                this.updateBotStatus();
            }, 10 * 60 * 1000); // 10 minutes
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            // Check if user has admin role
            const member = interaction.member;
            const isOwner = member?.user.id === discordBotConfig.ownerId;
            const hasAdminRole = (member?.roles as GuildMemberRoleManager).cache.has(discordBotConfig.adminRoleId);

            if (!isOwner) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            await this.handleCommand(interaction as ChatInputCommandInteraction);
        });
    }

    private async updateBotStatus() {
        try {
            const version = await versionService.getVersion();

            this.client.user?.setActivity({
                name: `v${version}`,
                type: ActivityType.Watching
            });

            logger.debug('Updated bot status with version', { version });
        } catch (error) {
            logger.error('Failed to update bot status', { error });
        }
    }

    private async handleCommand(interaction: ChatInputCommandInteraction) {
        const commandName = interaction.commandName;

        switch (commandName) {
            case 'ban':
                await this.handleBanCommand(interaction);
                break;
            case 'unban':
                await this.handleUnbanCommand(interaction);
                break;
            case 'generate':
                await this.handleGenerateCommand(interaction);
                break;
            case 'createversion':
                await this.handleCreateVersionCommand(interaction);
                break;
            default:
                await interaction.reply({ content: 'Unknown command', ephemeral: true });
        }
    }

    private async handleCreateVersionCommand(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false });
        
        const version = interaction.options.getString('version', true);
        
        // Validate version format - basic validation for x.y.z format
        const versionRegex = /^\d+(\.\d+){0,2}$/;
        if (!versionRegex.test(version)) {
            await interaction.editReply('Invalid version format. Please use a format like 1.2.3');
            return;
        }
        
        try {
            // First check if version already exists
            const existingVersionQuery = 'SELECT * FROM "Version" WHERE "version" = $1';
            const existingVersions: any = await db.query(existingVersionQuery, [version]);
            
            if (existingVersions.length > 0) {
                await interaction.editReply(`Version ${version} already exists in the database.`);
                return;
            }
            
            // Insert the new version
            const updatedAt = new Date();
            await db.query(
                'INSERT INTO "Version" ("version", "updatedAt") VALUES ($1, $2)',
                [version, updatedAt]
            );
            
            await interaction.editReply(`Version ${version} has been created successfully.`);
            logger.info('New version created via Discord', { 
                version, 
                createdBy: interaction.user.tag 
            });
        } catch (error) {
            logger.error('Error creating new version via Discord', { error, version });
            await interaction.editReply('Failed to create new version. Check logs for details.');
        }
    }

    private async handleBanCommand(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const licenseKey = interaction.options.getString('license_key', true);
        const reason = interaction.options.getString('reason', true);

        try {
            // Check if license exists
            const queryString = 'SELECT "licenseKey", "isBanned" FROM "License" WHERE "licenseKey" = $1';
            const licenses: any = await db.query(queryString, [licenseKey]);

            if (licenses.length === 0) {
                await interaction.editReply('License key not found.');
                return;
            }

            if (licenses[0].isBanned) {
                await interaction.editReply('License is already banned.');
                return;
            }

            // Ban the license
            await db.query(
                'UPDATE "License" SET "isBanned" = $1 WHERE "licenseKey" = $2',
                [true, licenseKey]
            );

            await interaction.editReply(`License key \`${licenseKey}\` has been banned. Reason: ${reason}`);
            logger.info('License banned via Discord', { licenseKey, reason, bannedBy: interaction.user.tag });
        } catch (error) {
            logger.error('Error banning license via Discord', { error, licenseKey });
            await interaction.editReply('Failed to ban license. Check logs for details.');
        }
    }

    private async handleUnbanCommand(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false });

        const licenseKey = interaction.options.getString('license_key', true);

        try {
            // Check if license exists
            const queryString = 'SELECT "licenseKey", "isBanned" FROM "License" WHERE "licenseKey" = $1';
            const licenses: any = await db.query(queryString, [licenseKey]);

            if (licenses.length === 0) {
                await interaction.editReply('License key not found.');
                return;
            }

            if (!licenses[0].isBanned) {
                await interaction.editReply('License is not banned.');
                return;
            }

            // Unban the license
            await db.query(
                'UPDATE "License" SET "isBanned" = $1 WHERE "licenseKey" = $2',
                [false, licenseKey]
            );

            await db.query(
                'DELETE FROM "Blacklisted_Id" WHERE "licenseKey" = $1',
                [licenseKey]
            );

            await interaction.editReply(`License key \`${licenseKey}\` has been unbanned.`);
            logger.info('License unbanned via Discord', { licenseKey, unbannedBy: interaction.user.tag });
        } catch (error) {
            logger.error('Error unbanning license via Discord', { error, licenseKey });
            await interaction.editReply('Failed to unban license. Check logs for details.');
        }
    }

    private async handleGenerateCommand(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const licenseType = interaction.options.getString('type', true);
        const amount = interaction.options.getInteger('amount', true);

        try {
            const keys: string[] = [];

            // Generate and insert keys
            for (let i = 0; i < amount; i++) {
                // Generate a random license key
                const licenseKey = `waveshield-${licenseType}-${generateUUID()}`

                // Insert into database
                await db.query(
                    'INSERT INTO "Redeemable" ("expirationType", "generatedBy", "licenseKey") VALUES ($1, $2, $3)',
                    [licenseType, interaction.user.tag, licenseKey]
                );

                keys.push(licenseKey);
            }

            // Format the response
            const formattedKeys = keys.map(key => `\`${key}\``).join('\n');

            await interaction.editReply(`Generated ${amount} ${licenseType} license key(s):\n${formattedKeys}`);
            logger.info('License keys generated via Discord', {
                amount,
                licenseType,
                generatedBy: interaction.user.id
            });
        } catch (error) {
            logger.error('Error generating license keys via Discord', { error, licenseType, amount });
            await interaction.editReply('Failed to generate license keys. Check logs for details.');
        }
    }

    async registerSlashCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(discordBotConfig.token);

            // Convert SlashCommandBuilder instances to JSON
            const commandsJson = this.commands.map(command => command.toJSON());

            logger.info('Started refreshing application commands.');

            // Register commands globally or to a specific guild
            let data;
            if (discordBotConfig.guildId) {
                data = await rest.put(
                    Routes.applicationGuildCommands(
                        discordBotConfig.clientId,
                        discordBotConfig.guildId
                    ),
                    { body: commandsJson }
                );
            } else {
                data = await rest.put(
                    Routes.applicationCommands(discordBotConfig.clientId),
                    { body: commandsJson }
                );
            }

            logger.info(`Successfully reloaded application commands.`);
            return true;
        } catch (error) {
            logger.error('Error registering slash commands', { error });
            return false;
        }
    }

    async start() {
        try {
            // Register slash commands
            await this.registerSlashCommands();

            // Login the bot
            await this.client.login(discordBotConfig.token);
            return true;
        } catch (error) {
            logger.error('Failed to start Discord bot', { error });
            return false;
        }
    }

    async stop() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }

        if (this.client) {
            this.client.destroy();
            logger.info('Discord bot stopped');
        }
    }
}

export default new DiscordBotService();
