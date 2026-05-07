import { ColorResolvable, EmbedBuilder, Guild, TextChannel, AttachmentBuilder } from 'discord.js';
import { ExtendedClient } from '../client';

export enum AuditLogType {
    SECURITY = 'SECURITY',
    MODERATION = 'MODERATION',
    AUTOMOD = 'AUTOMOD',
    MEMBERS = 'MEMBERS',
    ROLES = 'ROLES',
    CHANNELS = 'CHANNELS',
    VOICE = 'VOICE',
    WEBHOOKS = 'WEBHOOKS',
    MESSAGES = 'MESSAGES',
    BOT = 'BOT',
    INVITES = 'INVITES',
    EMOJI = 'EMOJI',
    STICKER = 'STICKER',
    EVENTS = 'EVENTS',
    STAGE = 'STAGE',
    SERVER = 'SERVER',
    THREADS = 'THREADS',
    VANITY = 'VANITY',
}

export enum AuditLogStatus {
    INFO = 'INFO',
    MOD = 'MOD',
    CRITICAL = 'CRITICAL',
    SYSTEM = 'SYSTEM',
}

export class AuditLogger {
    public static async log(
        client: ExtendedClient,
        guild: Guild,
        data: {
            type: AuditLogType;
            event: string;
            status?: AuditLogStatus;
            executorId?: string | null;
            executorTag?: string | null;
            targetId?: string | null;
            targetName?: string | null;
            details?: string | null;
            color?: ColorResolvable;
            transcript?: string;
            files?: any[];
        }
    ) {
        try {
            // 1. Sovereign State Check: Verify if logging is enabled for this category
            const guildSettings = await client.prisma.guild.findUnique({
                where: { id: guild.id }
            });

            if (!guildSettings) return;

            let isEnabled = true;
            switch (data.type) {
                case AuditLogType.MESSAGES: isEnabled = guildSettings.logMessagesEnabled; break;
                case AuditLogType.CHANNELS: isEnabled = guildSettings.logChannelsEnabled; break;
                case AuditLogType.ROLES: isEnabled = guildSettings.logRolesEnabled; break;
                case AuditLogType.MEMBERS: isEnabled = guildSettings.logMembersEnabled; break;
                case AuditLogType.MODERATION: isEnabled = guildSettings.logModerationEnabled; break;
                case AuditLogType.AUTOMOD: isEnabled = (guildSettings as any).logAutomodEnabled ?? guildSettings.logModerationEnabled; break;
                case AuditLogType.SECURITY: isEnabled = guildSettings.logSecurityEnabled; break;
                case AuditLogType.VOICE: isEnabled = guildSettings.logVoiceEnabled; break;
                case AuditLogType.BOT: isEnabled = (guildSettings as any).logBotEnabled ?? true; break;
                case AuditLogType.INVITES: isEnabled = (guildSettings as any).logInvitesEnabled ?? true; break;
                case AuditLogType.EMOJI: isEnabled = (guildSettings as any).logEmojiEnabled ?? true; break;
                case AuditLogType.STICKER: isEnabled = (guildSettings as any).logStickerEnabled ?? true; break;
                case AuditLogType.EVENTS: isEnabled = (guildSettings as any).logEventsEnabled ?? true; break;
                case AuditLogType.STAGE: isEnabled = (guildSettings as any).logStageEnabled ?? true; break;
                case AuditLogType.SERVER: isEnabled = (guildSettings as any).logServerEnabled ?? true; break;
                case AuditLogType.THREADS: isEnabled = (guildSettings as any).logThreadsEnabled ?? true; break;
                case AuditLogType.VANITY: isEnabled = (guildSettings as any).logVanityEnabled ?? true; break;
                case AuditLogType.WEBHOOKS: isEnabled = (guildSettings as any).logWebhooksEnabled ?? true; break;
            }

            if (!isEnabled) return;

            // 2. Save to Database Manifest
            await client.prisma.auditLog.create({
                data: {
                    guildId: guild.id,
                    type: data.type,
                    event: data.event,
                    status: data.status || AuditLogStatus.INFO,
                    executorId: data.executorId,
                    executorTag: data.executorTag,
                    targetId: data.targetId,
                    targetName: data.targetName,
                    details: data.details,
                    transcript: data.transcript,
                },
            });

            // 3. Resolve the correct log channel
            const s = guildSettings as any;
            let specificChannelId = guildSettings.logChannelId;

            // In CATEGORY mode, use category-specific channels. In CORE mode, fallback to the core channel.
            if (s.logMode === 'CATEGORY' || specificChannelId) {
                switch (data.type) {
                    case AuditLogType.MESSAGES: specificChannelId = guildSettings.logChannelMessages || specificChannelId; break;
                    case AuditLogType.CHANNELS: specificChannelId = guildSettings.logChannelChannels || specificChannelId; break;
                    case AuditLogType.ROLES: specificChannelId = guildSettings.logChannelRoles || specificChannelId; break;
                    case AuditLogType.MEMBERS: specificChannelId = guildSettings.logChannelMembers || specificChannelId; break;
                    case AuditLogType.MODERATION: specificChannelId = guildSettings.logChannelModeration || specificChannelId; break;
                    case AuditLogType.AUTOMOD: specificChannelId = s.logChannelAutomod || guildSettings.logChannelModeration || specificChannelId; break;
                    case AuditLogType.SECURITY: specificChannelId = guildSettings.logChannelSecurity || specificChannelId; break;
                    case AuditLogType.VOICE: specificChannelId = guildSettings.logChannelVoice || specificChannelId; break;
                    case AuditLogType.BOT: specificChannelId = s.logChannelBot || specificChannelId; break;
                    case AuditLogType.INVITES: specificChannelId = s.logChannelInvites || specificChannelId; break;
                    case AuditLogType.EMOJI: specificChannelId = s.logChannelEmoji || specificChannelId; break;
                    case AuditLogType.STICKER: specificChannelId = s.logChannelSticker || specificChannelId; break;
                    case AuditLogType.EVENTS: specificChannelId = s.logChannelEvents || specificChannelId; break;
                    case AuditLogType.STAGE: specificChannelId = s.logChannelStage || specificChannelId; break;
                    case AuditLogType.SERVER: specificChannelId = s.logChannelServer || specificChannelId; break;
                    case AuditLogType.THREADS: specificChannelId = s.logChannelThreads || specificChannelId; break;
                    case AuditLogType.VANITY: specificChannelId = s.logChannelVanity || specificChannelId; break;
                    case AuditLogType.WEBHOOKS: specificChannelId = s.logChannelWebhooks || specificChannelId; break;
                }
            }

            if (specificChannelId) {
                let logChannel = guild.channels.cache.get(specificChannelId) as TextChannel;
                if (!logChannel) {
                    try {
                        logChannel = await guild.channels.fetch(specificChannelId) as TextChannel;
                    } catch {
                        // Channel might have been deleted or bot lacks access
                        return;
                    }
                }

                if (logChannel && logChannel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle(` Audit Log // ${data.event}`)
                        .setColor(data.color || client.color.main)
                        .addFields(
                            { name: 'Category', value: `\`${data.type}\``, inline: true },
                            { name: 'Status', value: `\`${data.status || 'INFO'}\``, inline: true }
                        )
                        .setTimestamp();

                    if (data.executorId) {
                        embed.addFields({ name: 'Executor', value: `<@${data.executorId}> (\`${data.executorId}\`)`, inline: true });
                    }

                    if (data.targetName) {
                        embed.addFields({ name: 'Target', value: `\`${data.targetName}\`${data.targetId ? ` (\`${data.targetId}\`)` : ''}`, inline: true });
                    }

                    if (data.details) {
                        const sanitizedDetails = data.details.length > 1000 ? data.details.substring(0, 1000) + '...' : data.details;
                        embed.addFields({ name: 'Details', value: `\`\`\`${sanitizedDetails}\`\`\``, inline: false });
                    }

                    await logChannel.send({ embeds: [embed], files: data.files }).catch(() => null);
                }
            }
        } catch (error) {
            console.error('Audit Logging Error:', error);
        }
    }
}
