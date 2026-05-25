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

        if (mode === 'uwu' || mode === 'nsfw' || mode === 'mommy') {
            // Toggle text lock
            const lockType = mode;
            const labels: Record<string, { title: string; emoji: string }> = {
                uwu: { title: 'UwU', emoji: ':3' },
                nsfw: { title: 'NSFW', emoji: '😏' },
                mommy: { title: 'Mommy', emoji: '💕' }
            };
            const label = labels[lockType];

            const existing = await (client.prisma as any).uwuLock.findUnique({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
            });

            if (existing && existing.lockType === lockType) {
                await (client.prisma as any).uwuLock.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
                });
                const embed = client.embed()
                    .setTitle(`${label.title} Lock Removed`)
                    .setDescription(`${isChannel ? `<#${targetId}>` : `<@${targetId}>`} has been freed from ${lockType}lock.`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            } else {
                await (client.prisma as any).uwuLock.upsert({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                    update: { lockType },
                    create: { guildId: ctx.guild.id, userId: targetId, lockType }
                });
                const embed = client.embed()
                    .setTitle(`${label.title} Lock Applied`)
                    .setDescription(`${isChannel ? `<#${targetId}>` : `<@${targetId}>`} is now ${lockType}locked~ ${label.emoji}`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            }

        } else if (mode === 'react') {
            // Extract emoji from rest (after the mention)
            const afterMention = rest.slice(rest.indexOf('>') + 1).trim();
            if (!afterMention) {
                return ctx.replyV2({ description: 'Please provide an emoji.\n**Usage:** `devlock react <@user> <emoji>`', isAlert: true });
            }

            const emoji = afterMention.trim();
            const isCustom = /^<a?:\w+:\d+>$/.test(emoji);
            const isUnicode = EMOJI_REGEX.test(emoji);
            if (!isCustom && !isUnicode) {
                return ctx.replyV2({ description: `\`${emoji}\` is not a valid emoji.`, isAlert: true });
            }

            // Toggle reactlock for user
            const existing = await (client.prisma as any).reactLock.findUnique({
                where: { guildId_targetId_emoji: { guildId: ctx.guild.id, targetId, emoji } }
            });

            if (existing) {
                await (client.prisma as any).reactLock.delete({
                    where: { guildId_targetId_emoji: { guildId: ctx.guild.id, targetId, emoji } }
                });
                const embed = client.embed()
                    .setTitle('React Lock Removed')
                    .setDescription(`Removed ${emoji} reactlock from <@${targetId}>.`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            } else {
                await (client.prisma as any).reactLock.create({
                    data: { guildId: ctx.guild.id, targetId, targetType: 'user', emoji }
                });
                const embed = client.embed()
                    .setTitle('React Lock Applied')
                    .setDescription(`<@${targetId}> will now get ${emoji} on every message.`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            }
        }
    }
}
