import { Events, GuildMember, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildMemberUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberUpdate,
        });
    }

    public async run(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        const client = this.client;

        // 1. Role Change Logging
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
            // Fetch audit logs to find who did it
            const auditLog = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate }).then(logs => logs.entries.first()).catch(() => null);
            const executor = (auditLog && (Date.now() - auditLog.createdTimestamp) < 15000) ? auditLog.executor : null;

            let details = '';
            if (addedRoles.size > 0) details += `+ Added: ${addedRoles.map(r => r.name).join(', ')}\n`;
            if (removedRoles.size > 0) details += `- Removed: ${removedRoles.map(r => r.name).join(', ')}`;

            await AuditLogger.log(client, newMember.guild, {
                type: AuditLogType.ROLES,
                event: 'Member Roles Updated',
                status: AuditLogStatus.INFO,
                executorId: executor?.id,
                executorTag: executor?.tag,
                targetId: newMember.id,
                targetName: newMember.user.tag,
                details: details.trim(),
                color: client.color.main
            });
        }

        // 2. Nickname Change Logging
        if (oldMember.nickname !== newMember.nickname) {
            const auditLog = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }).then(logs => logs.entries.first()).catch(() => null);
            const executor = (auditLog && (Date.now() - auditLog.createdTimestamp) < 10000) ? auditLog.executor : null;

            await AuditLogger.log(client, newMember.guild, {
                type: AuditLogType.MEMBERS,
                event: 'Nickname Updated',
                status: AuditLogStatus.INFO,
                executorId: executor?.id,
                executorTag: executor?.tag,
                targetId: newMember.id,
                targetName: newMember.user.tag,
                details: `Old: ${oldMember.nickname || '[Default Name]'}\nNew: ${newMember.nickname || '[Default Name]'}`,
                color: client.color.main
            });
        }

        // 3. Detect New Boost
        if (!oldMember.premiumSince && newMember.premiumSince) {
            const guild = newMember.guild;
            const channel = guild.systemChannel;
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle(' New Server Boost!')
                    .setDescription(`Wow! ${newMember.user} just boosted the server! Thank you so much for the support! `)
                    .setThumbnail(newMember.user.displayAvatarURL())
                    .setColor(0xFF73FA) // Pinkish boost color
                    .setFooter({ text: `Total Boosts: ${guild.premiumSubscriptionCount || 0}` })
                    .setTimestamp();
                
                await channel.send({ content: `${newMember.user}`, embeds: [embed] });
            }
        }

        // 4. Role Connections Logic
        if (addedRoles.size > 0) {
            for (const [roleId] of addedRoles) {
                const connections = await client.prisma.roleConnection.findMany({
                    where: { guildId: newMember.guild.id, triggerRoleId: roleId }
                });

                if (connections.length > 0) {
                    const rolesToGive = connections
                        .map(c => c.connectedRoleId)
                        .filter(id => !newMember.roles.cache.has(id));

                    if (rolesToGive.length > 0) {
                        try {
                            await newMember.roles.add(rolesToGive, 'Role Connection Triggered');
                        } catch (err) {
                            console.error(`Failed to add connected roles for ${newMember.user.tag}: ${err}`);
                        }
                    }
                }
            }
        }

        if (removedRoles.size > 0) {
            for (const [roleId] of removedRoles) {
                const connections = await client.prisma.roleConnection.findMany({
                    where: { guildId: newMember.guild.id, triggerRoleId: roleId }
                });

                if (connections.length > 0) {
                    const rolesToRemove = connections
                        .map(c => c.connectedRoleId)
                        .filter(id => newMember.roles.cache.has(id));

                    if (rolesToRemove.length > 0) {
                        try {
                            await newMember.roles.remove(rolesToRemove, 'Role Connection Removed');
                        } catch (err) {
                            console.error(`Failed to remove connected roles for ${newMember.user.tag}: ${err}`);
                        }
                    }
                }
            }
        }

        // 5. Detect Timeout (Mute)
        if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
            const now = Date.now();
            if (newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > now) {
                const auditLog = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }).then(logs => logs.entries.first()).catch(() => null);
                const isRecent = auditLog && (now - auditLog.createdTimestamp) < 10000;
                const executorId = isRecent ? auditLog.executorId : null;

                if (executorId !== client.user?.id) {
                    const { Appeals } = await import('../utils/Appeals');
                    await Appeals.sendAppealDM(client, newMember.user, newMember.guild, 'MUTE', auditLog?.reason || 'No reason provided');
                }
            }
        }
    }
}
