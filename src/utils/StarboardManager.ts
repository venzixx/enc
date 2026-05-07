import { MessageReaction, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { ExtendedClient } from '../client';

export class StarboardManager {
    public static async handle(reaction: MessageReaction, client: ExtendedClient): Promise<void> {
        // Listen to ALL emojis — no filter
        
        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
        } catch (e) {
            return;
        }

        const message = reaction.message as Message;
        const guild = message.guild;
        if (!guild || !message.author) return;

        const guildConf = await client.prisma.guild.findUnique({ where: { id: guild.id } });
        if (!guildConf || !guildConf.starboardChannelId || !guildConf.starboardCount) return;

        // Don't track messages in the starboard channel itself
        if (message.channelId === guildConf.starboardChannelId) return;

        // Count ALL reactions on this message (total across all emojis)
        let totalReactions = 0;
        let topEmoji = '⭐';
        let topCount = 0;

        for (const [, r] of message.reactions.cache) {
            const count = r.count || 0;
            totalReactions += count;
            if (count > topCount) {
                topCount = count;
                topEmoji = r.emoji.toString();
            }
        }

        const threshold = guildConf.starboardCount;

        // Build all emoji counts for display
        const emojiBreakdown = message.reactions.cache
            .filter(r => (r.count || 0) > 0)
            .sort((a, b) => (b.count || 0) - (a.count || 0))
            .map(r => `${r.emoji.toString()} **${r.count}**`)
            .slice(0, 5) // Show top 5 emojis
            .join('  ');

        if (totalReactions === 0) {
            // All reactions removed — delete starboard post if exists
            const starRecord = await client.prisma.starboardMessage.findUnique({
                where: { originalMessageId: message.id }
            });
            if (starRecord) {
                await client.prisma.starboardMessage.delete({ where: { originalMessageId: message.id } });
                const starboardChannel = client.channels.cache.get(guildConf.starboardChannelId) as TextChannel;
                if (starboardChannel) {
                    const oldMsg = await starboardChannel.messages.fetch(starRecord.starboardMessageId).catch(() => null);
                    if (oldMsg) await oldMsg.delete().catch(() => null);
                }
            }
            return;
        }

        await this.updateStarboardMessage(client, guild.id, guildConf.starboardChannelId, message, totalReactions, threshold, topEmoji, emojiBreakdown);
    }

    private static async updateStarboardMessage(
        client: ExtendedClient,
        guildId: string,
        starboardChannelId: string,
        message: Message,
        totalCount: number,
        threshold: number,
        topEmoji: string,
        emojiBreakdown: string
    ): Promise<void> {
        const starboardChannel = client.channels.cache.get(starboardChannelId) as TextChannel;
        if (!starboardChannel) return;

        const starRecord = await client.prisma.starboardMessage.findUnique({
            where: { originalMessageId: message.id }
        });

        // Build the embed
        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content || '*No text content*')
            .addFields(
                { name: 'Original', value: `[Jump to message](${message.url})`, inline: true },
                { name: 'Reactions', value: emojiBreakdown || 'None', inline: true }
            )
            .setColor('#ffd700')
            .setFooter({ text: `${message.id} • Total: ${totalCount} reactions` })
            .setTimestamp(message.createdAt);

        const attachment = message.attachments.first();
        if (attachment) {
            if (attachment.contentType?.startsWith('image/')) {
                embed.setImage(attachment.url);
            } else {
                embed.addFields({ name: 'Attachment', value: `[${attachment.name}](${attachment.url})`, inline: false });
            }
        }

        const headerContent = `${topEmoji} **${totalCount}** <#${message.channelId}>`;

        if (!starRecord && totalCount >= threshold) {
            // First time hitting threshold — create starboard post
            const sent = await starboardChannel.send({ content: headerContent, embeds: [embed] });
            await client.prisma.starboardMessage.create({
                data: {
                    guildId,
                    originalMessageId: message.id,
                    starboardMessageId: sent.id,
                    starCount: totalCount
                }
            });
        } else if (starRecord) {
            // Already on starboard — update it
            if (totalCount < threshold) {
                // Dropped below threshold — remove from starboard
                await client.prisma.starboardMessage.delete({ where: { originalMessageId: message.id } });
                const oldMsg = await starboardChannel.messages.fetch(starRecord.starboardMessageId).catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => null);
            } else {
                // Update the count
                const oldMsg = await starboardChannel.messages.fetch(starRecord.starboardMessageId).catch(() => null);
                if (oldMsg) {
                    await oldMsg.edit({ content: headerContent, embeds: [embed] }).catch(() => null);
                }
                await client.prisma.starboardMessage.update({
                    where: { originalMessageId: message.id },
                    data: { starCount: totalCount }
                });
            }
        }
    }
}
