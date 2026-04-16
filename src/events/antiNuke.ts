import { Events, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../client';

// Track activity to detect nukes
const actionTracker = new Map<string, { count: number, lastAction: number }>();

async function punish(client: ExtendedClient, guildId: string, userId: string, reason: string) {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    const owner = await guild.fetchOwner();

    try {
        // 1. Strip all roles except @everyone
        await member.roles.set([]);
        
        // 2. Timeout for 24 hours
        await member.timeout(24 * 60 * 60 * 1000, `Anti-Nuke: ${reason}`);

        // 3. DM Owner
        const alertEmbed = new EmbedBuilder()
            .setTitle('⚠️ ANTI-NUKE ALERT')
            .setDescription(`A potential nuke attempt was detected and neutralized.`)
            .addFields(
                { name: 'Perpetrator', value: `${member.user.tag} (${member.id})` },
                { name: 'Action Taken', value: 'Stripped all roles & Applied 24h Timeout' },
                { name: 'Reason', value: reason }
            )
            .setColor(0xFF0000)
            .setTimestamp();

        await owner.send({ embeds: [alertEmbed] });
        console.log(`[Anti-Nuke] Punished ${member.user.tag} in ${guild.name} for ${reason}`);
    } catch (error) {
        console.error(`[Anti-Nuke Error] Failed to punish ${userId}:`, error);
    }
}

export default {
    name: Events.ChannelDelete,
    async execute(channel: any, client: ExtendedClient) {
        if (!channel.guild) return;
        const guild = channel.guild;

        // Fetch audit logs
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const entry = auditLogs.entries.first();
        if (!entry) return;

        const { executor, target } = entry;
        if (!executor || executor.bot || executor.id === guild.ownerId) return;

        // Basic rate limiting / threshold
        const now = Date.now();
        const userAction = actionTracker.get(executor.id) || { count: 0, lastAction: 0 };

        if (now - userAction.lastAction < 10000) { // 10 second window
            userAction.count++;
        } else {
            userAction.count = 1;
        }
        userAction.lastAction = now;
        actionTracker.set(executor.id, userAction);

        if (userAction.count > 3) {
            await punish(client, guild.id, executor.id, 'Mass Channel Deletion');
        }
    },
};
