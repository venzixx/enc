import { Events, MessageReaction, User } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';

export default class MessageReactionRemove extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.MessageReactionRemove,
        });
    }

    public async run(reaction: MessageReaction, user: User): Promise<void> {
        if (user.bot) return;

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

        const guild = reaction.message.guild;
        if (!guild) return;

        try {
            // Ensure member is fetched properly
            const member = reaction.message.member || await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            for (const rr of rrs) {
                const role = guild.roles.cache.get(rr.roleId) || await guild.roles.fetch(rr.roleId).catch(() => null);
                if (role) {
                    if (!member.roles.cache.has(role.id)) continue;
                    
                    await member.roles.remove(role).then(() => {
                        member.send(`You lost the **${role.name}** role!`).catch(() => {});
                    }).catch(e => {
                        console.error(`[ReactionRole] Failed to remove role ${role.name} from ${user.tag}:`, e.message);
                    });
                }
            }
        } catch (e) {
            console.error('[ReactionRole] Unexpected error during role removal:', e);
        }
    }
}
