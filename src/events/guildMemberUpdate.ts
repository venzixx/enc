import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../client';

export default {
    name: Events.GuildMemberUpdate,
    async execute(oldMember: GuildMember, newMember: GuildMember, client: ExtendedClient) {
        // Detect New Boost
        if (!oldMember.premiumSince && newMember.premiumSince) {
            const guild = newMember.guild;
            
            // Logic for a global thank you message (could be set via a command later, using system channel for now)
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

        // Role Connections Logic
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0) {
            for (const [roleId] of addedRoles) {
                const connections = await client.prisma.roleConnection.findMany({
                    where: {
                        guildId: newMember.guild.id,
                        triggerRoleId: roleId
                    }
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

        // (Optional: Add removal logic here if trigger role is removed)
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        if (removedRoles.size > 0) {
            for (const [roleId] of removedRoles) {
                const connections = await client.prisma.roleConnection.findMany({
                    where: {
                        guildId: newMember.guild.id,
                        triggerRoleId: roleId
                    }
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
        // Detect Timeout (Mute)
        if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
            // Check if it's a new timeout and not just an update
            const now = Date.now();
            if (newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > now) {
                const auditLog = await newMember.guild.fetchAuditLogs({ limit: 1, type: 24 }).then(logs => logs.entries.first()).catch(() => null);
                const isRecent = auditLog && (now - auditLog.createdTimestamp) < 5000;
                const executorId = isRecent ? auditLog.executorId : null;

                if (executorId !== client.user?.id) {
                    const { Appeals } = await import('../utils/Appeals');
                    await Appeals.sendAppealDM(client, newMember.user, newMember.guild, 'MUTE', auditLog?.reason || 'No reason provided');
                }
            }
        }
    },
};
