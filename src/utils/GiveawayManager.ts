import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    Guild, 
    GuildTextBasedChannel, 
    Message, 
    TextChannel 
} from 'discord.js';
import { ExtendedClient } from '../client';
import logger from '../structures/Logger';

export class GiveawayManager {
    /**
     * Builds the standard Discord Embed for active and ended giveaways.
     */
    public static buildEmbed(client: ExtendedClient, giveaway: any, entriesCount: number, isEnded: boolean = false, winners: string[] = []): EmbedBuilder {
        const embed = new EmbedBuilder();

        if (!isEnded) {
            const endTimestamp = Math.floor(new Date(giveaway.endTime).getTime() / 1000);
            let desc = `Click the **Enter** button below to participate!\n\n` +
                       `${client.emoji.clock_time} **Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n` +
                       `${client.emoji.crown_owner} **Hosted by:** <@${giveaway.hostId}>\n` +
                       `${client.emoji.level_trophy} **Winners:** **${giveaway.winnersCount}**\n` +
                       `${client.emoji.ticket_pass} **Entries:** **${entriesCount}**`;

            if (giveaway.reqRoleId) {
                desc += `\n${client.emoji.mod_lock} **Required Role:** <@&${giveaway.reqRoleId}>`;
            }
            if (giveaway.reqInvites && giveaway.reqInvites > 0) {
                desc += `\n${client.emoji.confession_letter} **Required Invites:** **${giveaway.reqInvites}+**`;
            }

            embed
                .setTitle(`${client.emoji.giveaway_gift} ${giveaway.prize}`)
                .setDescription(desc)
                .setColor(client.color.main || 0x5865F2)
                .setFooter({ text: `Giveaway ID: ${giveaway.messageId}` })
                .setTimestamp(new Date(giveaway.endTime));
        } else {
            const winnerText = winners && winners.length > 0
                ? `${client.emoji.level_trophy} **Winner(s):** ${winners.map(id => `<@${id}>`).join(', ')}\n`
                : `${client.emoji.cross} **No winners could be determined** (no eligible entries).\n`;

            embed
                .setTitle(`${client.emoji.giveaway_end} Giveaway Ended: ${giveaway.prize}`)
                .setDescription(
                    `${winnerText}` +
                    `${client.emoji.crown_owner} **Hosted by:** <@${giveaway.hostId}>\n` +
                    `${client.emoji.ticket_pass} **Total Entries:** **${entriesCount}**`
                )
                .setColor(winners && winners.length > 0 ? (client.color.main || 0x22c55e) : 0xef4444)
                .setFooter({ text: `Ended | Giveaway ID: ${giveaway.messageId}` })
                .setTimestamp(new Date());
        }

        return embed;
    }

    /**
     * Builds the interactive ActionRow button for giveaway entry.
     */
    public static buildButtons(entriesCount: number, isEnded: boolean = false, client?: ExtendedClient): ActionRowBuilder<ButtonBuilder> {
        const emojiId = client?.emoji?.giveaway_gift?.match(/\d+/)?.[0] || '🎉';
        const endEmojiId = client?.emoji?.giveaway_end?.match(/\d+/)?.[0] || '🏁';

        if (!isEnded) {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel(`Enter (${entriesCount})`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(emojiId)
            );
        } else {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_ended')
                    .setLabel(`Ended (${entriesCount})`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(endEmojiId)
                    .setDisabled(true)
            );
        }
    }

    /**
     * Ends an active giveaway, picks winners, edits message, and announces in channel.
     */
    public static async endGiveaway(client: ExtendedClient, giveawayIdOrMessageId: string | number): Promise<{ success: boolean; giveaway?: any; winners?: string[]; error?: string }> {
        try {
            const whereClause = typeof giveawayIdOrMessageId === 'number'
                ? { id: giveawayIdOrMessageId }
                : { messageId: String(giveawayIdOrMessageId) };

            const giveaway = await client.prisma.giveaway.findFirst({
                where: whereClause,
                include: { entries: true }
            });

            if (!giveaway) {
                return { success: false, error: 'Giveaway not found.' };
            }

            if (!giveaway.isActive) {
                return { success: false, error: 'This giveaway is already ended.' };
            }

            // Mark as inactive in DB
            await client.prisma.giveaway.update({
                where: { id: giveaway.id },
                data: { isActive: false, endTime: new Date() }
            });

            const guild = client.guilds.cache.get(giveaway.guildId);
            const channel = guild?.channels.cache.get(giveaway.channelId) as GuildTextBasedChannel | undefined;
            const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;

            const entries = giveaway.entries;
            const entriesCount = entries.length;

            if (entriesCount === 0) {
                if (message) {
                    const embed = this.buildEmbed(client, giveaway, 0, true, []);
                    const buttons = this.buildButtons(0, true);
                    await message.edit({ embeds: [embed], components: [buttons] }).catch(() => null);
                }
                if (channel) {
                    await channel.send({
                        content: `🎉 **Giveaway Ended:** No one entered for **${giveaway.prize}**.\n` +
                                 `👑 **Hosted by:** <@${giveaway.hostId}>\n` +
                                 `🔗 https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
                    }).catch(() => null);
                }
                return { success: true, giveaway, winners: [] };
            }

            // Fetch bonus entries for this guild to calculate weight
            const bonusEntriesMap = await client.prisma.giveawayBonusEntry.findMany({
                where: { guildId: giveaway.guildId }
            });

            // Build weighted entry pool
            const pool: string[] = [];
            for (const entry of entries) {
                let weight = 1;
                if (guild) {
                    const member = guild.members.cache.get(entry.userId);
                    if (member) {
                        for (const bonus of bonusEntriesMap) {
                            if (bonus.type === 'ROLE' && member.roles.cache.has(bonus.targetId)) {
                                weight += Math.max(0, bonus.entries);
                            } else if (bonus.type === 'USER' && entry.userId === bonus.targetId) {
                                weight += Math.max(0, bonus.entries);
                            }
                        }
                    }
                }
                for (let i = 0; i < weight; i++) {
                    pool.push(entry.userId);
                }
            }

            // Pick unique winners
            const shuffledPool = pool.sort(() => Math.random() - 0.5);
            const uniqueWinners = Array.from(new Set(shuffledPool)).slice(0, Math.min(giveaway.winnersCount, entriesCount));

            // Update giveaway message
            if (message) {
                const embed = this.buildEmbed(client, giveaway, entriesCount, true, uniqueWinners);
                const buttons = this.buildButtons(entriesCount, true);
                await message.edit({ embeds: [embed], components: [buttons] }).catch(() => null);
            }

            // Announce winners
            if (channel) {
                const winnerMentions = uniqueWinners.map(id => `<@${id}>`).join(', ');
                await channel.send({
                    content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!\n` +
                             `👑 **Hosted by:** <@${giveaway.hostId}>\n` +
                             `🔗 https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
                }).catch(() => null);
            }

            logger.info(`[Giveaway] Ended giveaway "${giveaway.prize}" (${giveaway.messageId}). Winners: ${uniqueWinners.join(', ')}`);
            return { success: true, giveaway, winners: uniqueWinners };
        } catch (err: any) {
            logger.error(`[Giveaway] Error in endGiveaway:`, err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Rerolls winner(s) for an already ended giveaway.
     */
    public static async rerollGiveaway(client: ExtendedClient, messageId: string, winnersCount: number = 1): Promise<{ success: boolean; winners?: string[]; error?: string }> {
        try {
            const giveaway = await client.prisma.giveaway.findUnique({
                where: { messageId },
                include: { entries: true }
            });

            if (!giveaway) {
                return { success: false, error: 'Giveaway not found with that Message ID.' };
            }

            const entries = giveaway.entries;
            if (entries.length === 0) {
                return { success: false, error: 'No entries were found for this giveaway to reroll from.' };
            }

            const guild = client.guilds.cache.get(giveaway.guildId);
            const channel = guild?.channels.cache.get(giveaway.channelId) as GuildTextBasedChannel | undefined;

            // Fetch bonus entries for this guild to calculate weight
            const bonusEntriesMap = await client.prisma.giveawayBonusEntry.findMany({
                where: { guildId: giveaway.guildId }
            });

            const pool: string[] = [];
            for (const entry of entries) {
                let weight = 1;
                if (guild) {
                    const member = guild.members.cache.get(entry.userId);
                    if (member) {
                        for (const bonus of bonusEntriesMap) {
                            if (bonus.type === 'ROLE' && member.roles.cache.has(bonus.targetId)) {
                                weight += Math.max(0, bonus.entries);
                            } else if (bonus.type === 'USER' && entry.userId === bonus.targetId) {
                                weight += Math.max(0, bonus.entries);
                            }
                        }
                    }
                }
                for (let i = 0; i < weight; i++) {
                    pool.push(entry.userId);
                }
            }

            const countToPick = winnersCount || giveaway.winnersCount || 1;
            const shuffledPool = pool.sort(() => Math.random() - 0.5);
            const newWinners = Array.from(new Set(shuffledPool)).slice(0, Math.min(countToPick, entries.length));

            if (channel) {
                const winnerMentions = newWinners.map(id => `<@${id}>`).join(', ');
                await channel.send({
                    content: `🎉 **Giveaway Rerolled!**\n` +
                             `New Winner(s) for **${giveaway.prize}**: ${winnerMentions}! Congratulations!\n` +
                             `👑 **Hosted by:** <@${giveaway.hostId}>\n` +
                             `🔗 https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
                }).catch(() => null);
            }

            return { success: true, winners: newWinners };
        } catch (err: any) {
            logger.error(`[Giveaway] Error in rerollGiveaway:`, err);
            return { success: false, error: err.message };
        }
    }
}
