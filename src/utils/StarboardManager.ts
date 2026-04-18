import { MessageReaction, TextChannel, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../client';

export class StarboardManager {
    public static async handle(reaction: MessageReaction, client: ExtendedClient): Promise<void> {
        if (reaction.emoji.name !== '⭐') return;
        
        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
        } catch (e) {
            return;
        }

        const message = reaction.message;
        const guild = message.guild;
        if (!guild || !message.author) return;

        // Skip self-stars maybe? The user didn't mention it, but generally handled loosely or let happen.
        // if (reaction.users.cache.has(message.author.id)) ...

        const guildConf = await client.prisma.guild.findUnique({ where: { id: guild.id } });
        if (!guildConf || !guildConf.starboardChannelId || !guildConf.starboardCount) return;

        const count = reaction.count || 0;
        if (count < guildConf.starboardCount && count > 0) {
            // Might need to update star count if it already exists, decreasing.
            await this.updateStarboardMessage(client, guild.id, guildConf.starboardChannelId, message as any, count);
            return;
        }

        if (count >= guildConf.starboardCount) {
            await this.updateStarboardMessage(client, guild.id, guildConf.starboardChannelId, message as any, count);
        }
    }

    private static async updateStarboardMessage(client: ExtendedClient, guildId: string, starboardChannelId: string, message: any, count: number): Promise<void> {
        const starboardChannel = client.channels.cache.get(starboardChannelId) as TextChannel;
        if (!starboardChannel) return;

        const starRecord = await client.prisma.starboardMessage.findUnique({
            where: { originalMessageId: message.id }
        });

        // 0 stars, delete
        if (count === 0 && starRecord) {
            await client.prisma.starboardMessage.delete({ where: { originalMessageId: message.id } });
            const oldMsg = await starboardChannel.messages.fetch(starRecord.starboardMessageId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => null);
            return;
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content || '*No text content*')
            .addFields(
                { name: 'Original', value: `[Jump to message](${message.url})`, inline: true }
            )
            .setColor('#ffd700')
            .setFooter({ text: message.id })
            .setTimestamp(message.createdAt);
        
        const attachment = message.attachments.first();
        if (attachment) {
            embed.setImage(attachment.url);
        }

        const content = `⭐ **${count}** <#${message.channelId}>`;

        if (!starRecord && count >= (await this.getRequiredStars(client, guildId))) {
            const sent = await starboardChannel.send({ content, embeds: [embed] });
            await client.prisma.starboardMessage.create({
                data: {
                    guildId,
                    originalMessageId: message.id,
                    starboardMessageId: sent.id,
                    starCount: count
                }
            });
        } else if (starRecord) {
            const oldMsg = await starboardChannel.messages.fetch(starRecord.starboardMessageId).catch(() => null);
            if (oldMsg) {
                await oldMsg.edit({ content, embeds: [embed] }).catch(() => null);
            }
            await client.prisma.starboardMessage.update({
                where: { originalMessageId: message.id },
                data: { starCount: count }
            });
            // If count falls below threshold? Keep it or delete it? We updated the count and edited. The user might want it deleted.
            const req = await this.getRequiredStars(client, guildId);
            if (count < req && count > 0) {
                // Dimscord starboard logic - usually if it drops below, sometimes we delete or leave untouched. Leaving it but updating count is fine.
            }
        }
    }

    private static async getRequiredStars(client: ExtendedClient, guildId: string): Promise<number> {
        const conf = await client.prisma.guild.findUnique({ where: { id: guildId } });
        return conf?.starboardCount || 10;
    }
}
