import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class NsfwLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'nsfwlock',
            aliases: [],
            description: {
                content: 'Toggle nsfwlock on a user or channel.',
                usage: 'nsfwlock <@user> or nsfwlock add/remove <#channel>',
                examples: ['nsfwlock @User', 'nsfwlock add #general', 'nsfwlock remove #general']
            },
            category: 'dev',
            cooldown: 3,
            slashCommand: false,
            hidden: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const msg = ctx.message;
        if (!msg) return;

        // Resolve targetId from args or mentions to check if they are devlocked
        let checkTargetId: string | undefined;
        if (args[0]?.toLowerCase() === 'add' || args[0]?.toLowerCase() === 'remove') {
            checkTargetId = args[1]?.replace(/[<#>]/g, '');
        } else {
            const channelMatch = msg.content.match(/<#(\d{17,20})>/);
            if (channelMatch) {
                checkTargetId = channelMatch[1];
            } else {
                const userMatch = msg.content.match(/<@!?(\d{17,20})>/);
                if (userMatch) {
                    checkTargetId = userMatch[1];
                }
            }
        }

        if (checkTargetId) {
            const isDevLocked = await (client.prisma as any).devLock.findUnique({
                where: { targetId: checkTargetId }
            });
            if (isDevLocked) {
                return ctx.replyV2({ description: 'This target is devlocked and cannot be modified by normal lock commands.', isAlert: true });
            }
        }

        // Check if there is an "add" or "remove" subcommand for channels
        if (args[0]?.toLowerCase() === 'add') {
            const targetChannelId = args[1]?.replace(/[<#>]/g, '');
            if (!targetChannelId || !/^\d{17,20}$/.test(targetChannelId)) {
                return ctx.replyV2({ description: 'Please provide a valid channel to lock.\n**Usage:** `nsfwlock add <#channel>`', isAlert: true });
            }

            await (client.prisma as any).uwuLock.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetChannelId } },
                update: { lockType: 'nsfw' },
                create: { guildId: ctx.guild.id, userId: targetChannelId, lockType: 'nsfw' }
            });

            const embed = client.embed()
                .setTitle('Channel Lock Applied')
                .setDescription(`<#${targetChannelId}> is now locked with **nsfw** lock. All messages sent in this channel will be nsfw-ified~ 😏`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        }

        if (args[0]?.toLowerCase() === 'remove') {
            const targetChannelId = args[1]?.replace(/[<#>]/g, '');
            if (!targetChannelId || !/^\d{17,20}$/.test(targetChannelId)) {
                return ctx.replyV2({ description: 'Please provide a valid channel to unlock.\n**Usage:** `nsfwlock remove <#channel>`', isAlert: true });
            }

            await (client.prisma as any).uwuLock.deleteMany({
                where: { guildId: ctx.guild.id, userId: targetChannelId }
            });

            const embed = client.embed()
                .setTitle('Channel Lock Removed')
                .setDescription(`Removed lock from <#${targetChannelId}>.`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        }

        // Check for channel mention toggle
        const channelMentionMatch = msg.content.match(/<#(\d{17,20})>/);
        if (channelMentionMatch) {
            const targetChannelId = channelMentionMatch[1];
            const existing = await (client.prisma as any).uwuLock.findUnique({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetChannelId } }
            });

            if (existing && existing.lockType === 'nsfw') {
                await (client.prisma as any).uwuLock.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetChannelId } }
                });

                const embed = client.embed()
                    .setTitle('Channel Lock Removed')
                    .setDescription(`Removed lock from <#${targetChannelId}>.`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            } else {
                await (client.prisma as any).uwuLock.upsert({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetChannelId } },
                    update: { lockType: 'nsfw' },
                    create: { guildId: ctx.guild.id, userId: targetChannelId, lockType: 'nsfw' }
                });

                const embed = client.embed()
                    .setTitle('Channel Lock Applied')
                    .setDescription(`<#${targetChannelId}> is now locked with **nsfw** lock. All messages sent in this channel will be nsfw-ified~ 😏`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            }
        }

        // User mention toggle
        const userMentionMatch = msg.content.match(/<@!?(\d{17,20})>/);
        if (!userMentionMatch) {
            return ctx.replyV2({ description: 'Please mention a user or channel.\n**Usage:** `nsfwlock <@user>` or `nsfwlock add/remove <#channel>`', isAlert: true });
        }

        const targetId = userMentionMatch[1];

        if (targetId === ctx.author.id) {
            return ctx.replyV2({ description: 'You cannot use this command on yourself!', isAlert: true });
        }

        const existing = await (client.prisma as any).uwuLock.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
        });

        if (existing && existing.lockType === 'nsfw') {
            await (client.prisma as any).uwuLock.delete({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
            });

            const embed = client.embed()
                .setTitle('NSFW Lock Removed')
                .setDescription(`<@${targetId}> has been freed from nsfwlock.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });
        } else {
            await (client.prisma as any).uwuLock.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                update: { lockType: 'nsfw' },
                create: { guildId: ctx.guild.id, userId: targetId, lockType: 'nsfw' }
            });

            const embed = client.embed()
                .setTitle('NSFW Lock Applied')
                .setDescription(`<@${targetId}> is now nsfwlocked~ 😏`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });
        }
    }
}
