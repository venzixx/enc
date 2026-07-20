import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

const EMOJI_REGEX = /(<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}])+/u;

export default class DevLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'devlock',
            aliases: ['dl'],
            description: {
                content: 'Dev shortcut to reactlock, uwulock, nsfwlock, or mommylock a user.',
                usage: 'devlock <react/uwu/nsfw/mommy> <@user> [emoji]',
                examples: ['devlock react @User 😂', 'devlock uwu @User', 'devlock nsfw @User', 'devlock mommy @User']
            },
            category: 'dev',
            cooldown: 3,
            slashCommand: false,
            hidden: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!await isDev(client, ctx.author.id)) {
            return ctx.replyV2({ description: 'Unknown command.', isAlert: true });
        }

        const msg = ctx.message;
        if (!msg) return;

        // Parse: devlock <react/uwu> <@user> [emoji]
        const match = msg.content.match(/(?:devlock|dl)\s+(react|uwu|nsfw|mommy)\s+([\s\S]+)/i);
        if (!match) {
            return ctx.replyV2({ description: '**Usage:** `devlock <react/uwu/nsfw/mommy> <@user> [emoji]`', isAlert: true });
        }

        const mode = match[1].toLowerCase();
        const rest = match[2].trim();

        // Extract user or channel mention
        const mentionMatch = rest.match(/<@!?(\d{17,20})>|<#(\d{17,20})>/);
        if (!mentionMatch) {
            return ctx.replyV2({ description: 'Please mention a user or channel.', isAlert: true });
        }

        const targetId = mentionMatch[1] || mentionMatch[2];
        const isChannel = !!mentionMatch[2];

        if (!isChannel && targetId === ctx.author.id) {
            return ctx.replyV2({ description: 'You cannot use this command on yourself!', isAlert: true });
        }

        let emoji: string | null = null;
        if (mode === 'react') {
            const afterMention = rest.slice(rest.indexOf('>') + 1).trim();
            if (!afterMention) {
                return ctx.replyV2({ description: 'Please provide an emoji.\n**Usage:** `devlock react <@user> <emoji>`', isAlert: true });
            }

            emoji = afterMention.trim();
            const isCustom = /^<a?:\w+:\d+>$/.test(emoji);
            const isUnicode = EMOJI_REGEX.test(emoji);
            if (!isCustom && !isUnicode) {
                return ctx.replyV2({ description: `\`${emoji}\` is not a valid emoji.`, isAlert: true });
            }
        }

        const existing = await (client.prisma as any).devLock.findUnique({
            where: { targetId }
        });

        if (existing) {
            const isSameLock = existing.lockType === mode && (mode !== 'react' || existing.emoji === emoji);
            if (isSameLock) {
                await (client.prisma as any).devLock.delete({
                    where: { targetId }
                });
                const embed = client.embed()
                    .setTitle('Dev Lock Removed')
                    .setDescription(`${isChannel ? `<#${targetId}>` : `<@${targetId}>`} has been freed from dev ${mode}lock.`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            } else {
                await (client.prisma as any).devLock.update({
                    where: { targetId },
                    data: {
                        lockType: mode,
                        emoji: mode === 'react' ? emoji : null
                    }
                });
                const embed = client.embed()
                    .setTitle('Dev Lock Updated')
                    .setDescription(`${isChannel ? `<#${targetId}>` : `<@${targetId}>`} devlock has been updated to **${mode}**lock.`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            }
        } else {
            await (client.prisma as any).devLock.create({
                data: {
                    targetId,
                    targetType: isChannel ? 'channel' : 'user',
                    lockType: mode,
                    emoji: mode === 'react' ? emoji : null
                }
            });

            if (mode !== 'react') {
                await (client.prisma as any).uwuLock.deleteMany({
                    where: { guildId: ctx.guild.id, userId: targetId }
                }).catch(() => {});
            } else {
                await (client.prisma as any).reactLock.deleteMany({
                    where: { guildId: ctx.guild.id, targetId }
                }).catch(() => {});
            }

            const embed = client.embed()
                .setTitle('Dev Lock Applied')
                .setDescription(`${isChannel ? `<#${targetId}>` : `<@${targetId}>`} is now devlocked with **${mode}**lock globally.`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        }
    }
}
