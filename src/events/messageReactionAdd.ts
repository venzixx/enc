import { Events, MessageReaction, User } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';

export default class MessageReactionAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.MessageReactionAdd,
        });
    }

    public async run(reaction: MessageReaction, user: User): Promise<void> {
        if (user.bot) return;
        const guild = reaction.message.guild;
        if (!guild) return;

        // TRACK ACTIVITY
        const today = new Date().toISOString().split('T')[0];
        this.client.prisma.reactionDailyActivity.upsert({
            where: { guildId_date: { guildId: guild.id, date: today } },
            update: { reactionCount: { increment: 1 } },
            create: { guildId: guild.id, date: today, reactionCount: 1 }
        }).catch(() => {});

        // Fetch partials if needed
        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
        } catch (e) {
            console.error(`[ReactionRole] Failed to fetch partials for message ${reaction.message.id}:`, e);
            return;
        }

        const emojiKey = reaction.emoji.id || reaction.emoji.name;
        
        // Find ALL roles linked to this message and emoji
        const rrs = await this.client.prisma.reactionRole.findMany({
            where: {
                messageId: reaction.message.id,
                emoji: emojiKey || undefined
            }
        });

        if (!rrs.length) return;

        try {
            // Ensure member is fetched properly
            const member = reaction.message.member || await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                console.error(`[ReactionRole] Could not find member for user ${user.id} in guild ${guild.id}`);
                return;
            }

            for (const rr of rrs) {
                const role = guild.roles.cache.get(rr.roleId) || await guild.roles.fetch(rr.roleId).catch(() => null);
                if (role) {
                    if (member.roles.cache.has(role.id)) continue;
                    
                    await member.roles.add(role).then(() => {
                        member.send(`You got the **${role.name}** role!`).catch(() => {});
                    }).catch(e => {
                        console.error(`[ReactionRole] Failed to add role ${role.name} to ${user.tag}:`, e.message);
                    });
                } else {
                    console.warn(`[ReactionRole] Role ${rr.roleId} not found in guild ${guild.id}`);
                }
            }
        } catch (e) {
            console.error('[ReactionRole] Unexpected error during role assignment:', e);
        }

        // Starboard Hook
        const { StarboardManager } = await import('../utils/StarboardManager');
        await StarboardManager.handle(reaction, this.client).catch(() => {});
    }
}

