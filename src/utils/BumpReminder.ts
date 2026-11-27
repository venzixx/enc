import { InteractionType, type Message } from 'discord.js';
import type { BumpReminder as Reminder } from '@prisma/client';
import type { ExtendedClient } from '../client';
import logger from '../structures/Logger';
import { V2Helper, type V2Options } from './V2Helper';

const DISBOARD_ID = '302050872383242240';
const cooldownMs = 2 * 60 * 60 * 1000;

export class BumpReminder {
    public static layout(settings: Reminder | null, preview = false): V2Options {
        const role = settings?.roleId;
        const user = settings?.userId;
        const mentions = [role && `<@&${role}>`, user && `<@${user}>`].filter(Boolean).join(' ');
        return {
            title: settings?.title ?? 'Time to bump!',
            description: [mentions, settings?.message ?? 'Use `/bump` to bump this server on DISBOARD.']
                .filter(Boolean).join('\n'),
            footer: settings?.footer ?? undefined,
            borderless: true,
            ephemeral: preview,
            allowedMentions: { parse: [], roles: !preview && role ? [role] : [], users: !preview && user ? [user] : [] }
        };
    }

    public static async observe(client: ExtendedClient, message: Message) {
        if (!message.guildId || message.author.id !== DISBOARD_ID) return;
        const text = [message.content, ...message.embeds.flatMap(embed => [embed.title, embed.description])]
            .filter(Boolean).join(' ');
        if (!/\bbump done\b/i.test(text)) return;

        const dueAt = new Date(message.createdTimestamp + cooldownMs);
        const guildId = message.guildId;
        const metadata = message.interactionMetadata;
        const userId = metadata?.type === InteractionType.ApplicationCommand ? metadata.user.id : undefined;
        const accepted = await client.prisma.$transaction(async tx => {
            const { count } = await tx.bumpReminder.updateMany({
                where: {
                    guildId,
                    enabled: true,
                    OR: [{ lastBumpAt: null }, { lastBumpAt: { lt: message.createdAt } }]
                },
                data: { lastBumpAt: message.createdAt, dueAt }
            });
            if (count && userId && !metadata?.user.bot) {
                await tx.bumpScore.upsert({
                    where: { guildId_userId: { guildId, userId } },
                    create: { guildId, userId, count: 1 },
                    update: { count: { increment: 1 } }
                });
            }
            return count > 0;
        });
        if (accepted && message.channel.isSendable()) {
            await message.channel.send(V2Helper.createLayout({
                description: `Bump done! I’ll remind you <t:${Math.floor(dueAt.getTime() / 1000)}:R>.`,
                borderless: true
            }));
        }
    }

    public static init(client: ExtendedClient) {
        let running = false;
        const check = async () => {
            if (running) return;
            running = true;
            try {
                const pending = await client.prisma.bumpReminder.findMany({
                    where: { enabled: true, dueAt: { lte: new Date() } }
                });
                for (const { guildId, dueAt } of pending) {
                    const guild = client.guilds.cache.get(guildId);
                    if (!guild?.available || !dueAt) continue;
                    try {
                        const current = await client.prisma.bumpReminder.findFirst({
                            where: { guildId, enabled: true, dueAt }
                        });
                        if (!current?.channelId) continue;
                        const channel = await guild.channels.fetch(current.channelId);
                        if (!channel?.isSendable()) continue;
                        await channel.send({
                            ...V2Helper.createLayout(this.layout(current)),
                            nonce: `${BigInt(guildId).toString(36)}-${dueAt.getTime().toString(36)}`,
                            enforceNonce: true
                        });
                        await client.prisma.bumpReminder.updateMany({
                            where: { guildId, dueAt },
                            data: { dueAt: null }
                        });
                    } catch (error) {
                        logger.error(`Bump reminder failed for guild ${guildId}:`, error);
                    }
                }
            } catch (error) {
                logger.error('Failed to check bump reminders:', error);
            } finally {
                running = false;
            }
        };
        setInterval(check, 30_000).unref();
        void check();
    }
}
