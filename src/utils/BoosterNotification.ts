import { EmbedBuilder, Guild, GuildMember, Message, MessageType } from 'discord.js';
import { ExtendedClient } from '../client';
import { PlaceholderManager } from './PlaceholderManager';
import { V2Helper } from './V2Helper';

// Deduplication caches:
// 1. Set of Discord system message IDs processed
const recentMessageIds = new Set<string>();
// 2. Map of "guildId:memberId" -> timestamp to prevent double announcements within 15 seconds
const recentMemberBoosts = new Map<string, number>();

export class BoosterNotification {
    /**
     * Dispatches the booster card / announcement for a server boost.
     * Can be invoked from:
     * - MessageCreate (catches EVERY boost, including 2nd/3rd boosts by the same member)
     * - guildMemberUpdate (catches first-time boosts via premiumSince transition)
     */
    public static async dispatchBoost(
        client: ExtendedClient,
        member: GuildMember,
        guild: Guild,
        options?: { sourceMessage?: Message }
    ): Promise<boolean> {
        try {
            const now = Date.now();
            const dedupeKey = `${guild.id}:${member.id}`;

            // If triggered by a Discord system message (MessageType.GuildBoost, etc.)
            if (options?.sourceMessage) {
                if (recentMessageIds.has(options.sourceMessage.id)) {
                    return false;
                }
                recentMessageIds.add(options.sourceMessage.id);
                // Keep set bounded
                if (recentMessageIds.size > 500) {
                    const firstItem = recentMessageIds.values().next().value;
                    if (firstItem) recentMessageIds.delete(firstItem);
                }
                recentMemberBoosts.set(dedupeKey, now);
            } else {
                // Triggered by guildMemberUpdate
                const lastSent = recentMemberBoosts.get(dedupeKey);
                if (lastSent && (now - lastSent < 15000)) {
                    // Already dispatched recently by MessageCreate or previous event
                    return false;
                }
                recentMemberBoosts.set(dedupeKey, now);
            }

            // Clean up stale member timestamps
            if (recentMemberBoosts.size > 200) {
                for (const [key, timestamp] of recentMemberBoosts.entries()) {
                    if (now - timestamp > 60000) recentMemberBoosts.delete(key);
                }
            }

            // Fetch guild configuration
            const guildData = await client.prisma.guild.findUnique({
                where: { id: guild.id }
            });

            const isBoosterEnabled = (guildData as any)?.boosterEnabled ?? !!guildData?.boosterChannelId;
            if (!isBoosterEnabled) return false;

            // Determine target channel (configured boosterChannelId or fall back to systemChannel or message channel)
            const channelId = guildData?.boosterChannelId || guild.systemChannelId || options?.sourceMessage?.channelId;
            const channel = channelId ? (guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)) as any : null;

            if (!channel || !channel.isTextBased()) return false;

            const rawBoosterMsg = guildData?.boosterMessage || `🎉 Huge shoutout to {booster} for boosting **{server}**! We are now at **{server.boost_count}** boosts (Tier {server.boost_tier})! 🚀`;
            const resolved = await PlaceholderManager.resolve(client, rawBoosterMsg, member, guild);
            const shouldPing = rawBoosterMsg.includes('{userMention}') || rawBoosterMsg.includes('{user_mention}') || rawBoosterMsg.includes('{user.mention}') || rawBoosterMsg.includes('{mentionID}') || rawBoosterMsg.includes('{user}') || rawBoosterMsg.includes('{booster}') || rawBoosterMsg.includes('{booster.mention}');

            if ((resolved.embeds && resolved.embeds.length > 0) || (resolved.components && resolved.components.length > 0)) {
                // Custom embeds configured
                const finalContent = resolved.content ? resolved.content : (shouldPing ? `<@${member.id}>` : undefined);
                await channel.send({
                    content: finalContent,
                    embeds: resolved.embeds,
                    components: resolved.components,
                    allowedMentions: shouldPing ? { users: [member.id], parse: [], roles: [] } : { parse: [], users: [], roles: [] }
                }).catch(() => {});
                return true;
            }

            if (guildData?.boosterCardEnabled !== false) {
                // V2 Modern Borderless Booster Card
                const pingHeader = `<@${member.id}>`;

                let description: string;
                if (resolved.content && resolved.content.trim()) {
                    description = resolved.content;
                } else {
                    description = `Thank you so much ${member.toString()} for boosting **${guild.name}**! 🚀\nWe have reached **${guild.premiumSubscriptionCount || 1}** boosts (Level ${guild.premiumTier}).\nYour support unlocks premium perks for everyone!`;
                }

                // Banner image resolution
                let bannerUrl: string | undefined = undefined;
                const boosterBg = guildData?.boosterCardBackground;
                const welcomeBg = guildData?.welcomeCardBackground;
                if (boosterBg && (boosterBg.startsWith('http') || boosterBg.startsWith('/'))) {
                    bannerUrl = boosterBg.startsWith('http') ? boosterBg : `https://bot.encl.asia${boosterBg}`;
                } else if (welcomeBg && (welcomeBg.startsWith('http') || welcomeBg.startsWith('/'))) {
                    bannerUrl = welcomeBg.startsWith('http') ? welcomeBg : `https://bot.encl.asia${welcomeBg}`;
                }

                const defaultBoosterFooter = `${guild.name} • Boost #${guild.premiumSubscriptionCount || 1} • Tier ${guild.premiumTier}`;
                const boosterFooterRaw = (guildData as any)?.boosterCardFooter || defaultBoosterFooter;
                const footerText = PlaceholderManager.simpleResolve(boosterFooterRaw, member, guild) || defaultBoosterFooter;

                const defaultBoosterTitle = `🚀 ${member.user.username} Boosted the Server!`;
                const boosterTitleRaw = guildData?.boosterCardTitle || defaultBoosterTitle;
                const boosterTitleText = PlaceholderManager.simpleResolve(boosterTitleRaw, member, guild) || defaultBoosterTitle;

                const v2Layout = V2Helper.createLayout({
                    borderless: true,
                    color: (guildData?.boosterCardColor as any) || '#f47fff',
                    title: boosterTitleText,
                    description: description,
                    thumbnail: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                    image: bannerUrl,
                    footer: footerText,
                    timestamp: true,
                    allowedMentions: { users: [member.id], parse: [], roles: [] }
                });

                await channel.send({
                    components: v2Layout.components,
                    flags: v2Layout.flags,
                    allowedMentions: { users: [member.id], parse: [], roles: [] }
                }).catch(async (v2Err: any) => {
                    console.error('[BOOSTER_V2_SEND_ERROR]', v2Err);
                    // Fallback to standard embed if V2 components fail
                    const fallbackEmbed = new EmbedBuilder()
                        .setTitle(boosterTitleText)
                        .setDescription(description)
                        .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
                        .setColor(guildData?.boosterCardColor ? parseInt(guildData.boosterCardColor.replace('#', ''), 16) : 0xF47FFF)
                        .setFooter({ text: footerText })
                        .setTimestamp();

                    if (bannerUrl) {
                        fallbackEmbed.setImage(bannerUrl);
                    }

                    await channel.send({
                        content: pingHeader,
                        embeds: [fallbackEmbed],
                        allowedMentions: { users: [member.id], parse: [], roles: [] }
                    }).catch(() => {});
                });
                return true;
            } else {
                // Plain text mode
                const pingHeader = shouldPing ? `<@${member.id}>` : '';
                await channel.send({
                    content: `${pingHeader} ${resolved.content || rawBoosterMsg}`.trim(),
                    allowedMentions: shouldPing ? { users: [member.id], parse: [], roles: [] } : { parse: [], users: [], roles: [] }
                }).catch(() => {});
                return true;
            }
        } catch (err) {
            console.error('[BOOSTER_DISPATCH_ERROR]', err);
            return false;
        }
    }
}
