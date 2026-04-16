import { Events, Presence } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';

export default class PresenceUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.PresenceUpdate,
        });
    }

    public async run(oldPresence: Presence | null, newPresence: Presence): Promise<void> {
        if (!newPresence.guild || !newPresence.member) return;

        const guildData = await this.client.prisma.guild.findUnique({
            where: { id: newPresence.guild.id }
        });

        if (!guildData?.vanityString || !guildData?.vanityRoleId) return;

        const customStatus = newPresence.activities.find(a => a.type === 4); // 4 is Custom Status
        const statusText = customStatus?.state || "";

        const hasVanity = statusText.includes(guildData.vanityString);
        const role = newPresence.guild.roles.cache.get(guildData.vanityRoleId);
        
        if (!role) return;

        try {
            const hasRole = newPresence.member.roles.cache.has(role.id);

            if (hasVanity && !hasRole) {
                await newPresence.member.roles.add(role);
                console.log(`[Vanity] Added role to ${newPresence.member.user.tag}`);
            } else if (!hasVanity && hasRole) {
                await newPresence.member.roles.remove(role);
                console.log(`[Vanity] Removed role from ${newPresence.member.user.tag}`);
            }
        } catch (e) {
            console.error('Vanity Role Error:', e);
        }
    }
}

