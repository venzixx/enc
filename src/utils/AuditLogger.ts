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
                case AuditLogType.AUTOMOD: isEnabled = guildSettings.logModerationEnabled; break;
                case AuditLogType.SECURITY: isEnabled = guildSettings.logSecurityEnabled; break;
                case AuditLogType.VOICE: isEnabled = guildSettings.logVoiceEnabled; break;
                case AuditLogType.WEBHOOKS: isEnabled = true; break; // Webhooks currently always logged if enabled
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

            // 3. High-Fidelity Discord Manifestation (Optional)
            let specificChannelId = guildSettings.logChannelId;
            switch (data.type) {
                case AuditLogType.MESSAGES: specificChannelId = guildSettings.logChannelMessages || specificChannelId; break;
                case AuditLogType.CHANNELS: specificChannelId = guildSettings.logChannelChannels || specificChannelId; break;
                case AuditLogType.ROLES: specificChannelId = guildSettings.logChannelRoles || specificChannelId; break;
                case AuditLogType.MEMBERS: specificChannelId = guildSettings.logChannelMembers || specificChannelId; break;
                case AuditLogType.MODERATION: specificChannelId = guildSettings.logChannelModeration || specificChannelId; break;
                case AuditLogType.AUTOMOD: specificChannelId = guildSettings.logChannelModeration || specificChannelId; break;
                case AuditLogType.SECURITY: specificChannelId = guildSettings.logChannelSecurity || specificChannelId; break;
                case AuditLogType.VOICE: specificChannelId = guildSettings.logChannelVoice || specificChannelId; break;
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
