export default {
  token: process.env.DISCORD_BOT_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID || '', // Optional: for guild-specific commands
  adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID || '', // Role ID that can use admin commands
  ownerId: process.env.DISCORD_OWNER_ID || '', // Role ID that can use admin commands
}