import { ColorResolvable, EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { ExtendedClient } from '../client';

export enum AuditLogType {
    SECURITY = 'SECURITY',
    MODERATION = 'MODERATION',
    MEMBERS = 'MEMBERS',
    ROLES = 'ROLES',
    CHANNELS = 'CHANNELS',
    VOICE = 'VOICE',
    WEBHOOKS = 'WEBHOOKS',
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
            executorId?: string;
            executorTag?: string;
            targetId?: string;
            targetName?: string;
            details?: string;
            color?: ColorResolvable;
        }
    ) {
        try {
            // 1. Save to Database Manifest
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
                },
            });

            // 2. High-Fidelity Discord Manifestation (Optional)
            const guildData = await client.prisma.guild.findUnique({
                where: { id: guild.id },
                select: { logChannelId: true }
            });

            if (guildData?.logChannelId) {
                const logChannel = guild.channels.cache.get(guildData.logChannelId) as TextChannel;
                if (logChannel && logChannel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Event Log // ${data.event}`)
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

                    await logChannel.send({ embeds: [embed] }).catch(() => null);
                }
            }
        } catch (error) {
            console.error('Audit Logging Error:', error);
        }
    }
}
