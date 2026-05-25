import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class UwuLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'uwulock',
            aliases: [],
            description: {
                content: 'Toggle uwulock on a user or channel.',
                usage: 'uwulock <@user> or uwulock add/remove <#channel>',
                examples: ['uwulock @User', 'uwulock add #general', 'uwulock remove #general']
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

        // Check if there is an "add" or "remove" subcommand for channels
        if (args[0]?.toLowerCase() === 'add') {
            const targetChannelId = args[1]?.replace(/[<#>]/g, '');
            if (!targetChannelId || !/^\d{17,20}$/.test(targetChannelId)) {
                return ctx.replyV2({ description: 'Please provide a valid channel to lock.\n**Usage:** `uwulock add <#channel>`', isAlert: true });
            }

            await (client.prisma as any).uwuLock.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetChannelId } },
                update: { lockType: 'uwu' },
                create: { guildId: ctx.guild.id, userId: targetChannelId, lockType: 'uwu' }
            });

            const embed = client.embed()
                .setTitle('Channel Lock Applied')
                .setDescription(`<#${targetChannelId}> is now locked with **uwu** lock. All messages sent in this channel will be uwu-ified~ :3`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        }

        if (args[0]?.toLowerCase() === 'remove') {
            const targetChannelId = args[1]?.replace(/[<#>]/g, '');
            if (!targetChannelId || !/^\d{17,20}$/.test(targetChannelId)) {
                return ctx.replyV2({ description: 'Please provide a valid channel to unlock.\n**Usage:** `uwulock remove <#channel>`', isAlert: true });
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

            if (existing && existing.lockType === 'uwu') {
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
                    update: { lockType: 'uwu' },
                    create: { guildId: ctx.guild.id, userId: targetChannelId, lockType: 'uwu' }
                });

                const embed = client.embed()
                    .setTitle('Channel Lock Applied')
                    .setDescription(`<#${targetChannelId}> is now locked with **uwu** lock. All messages sent in this channel will be uwu-ified~ :3`)
                    .setColor(client.color.main);
                return ctx.reply({ embeds: [embed] });
            }
        }

        // User mention toggle
        const userMentionMatch = msg.content.match(/<@!?(\d{17,20})>/);
        if (!userMentionMatch) {
            return ctx.replyV2({ description: 'Please mention a user or channel.\n**Usage:** `uwulock <@user>` or `uwulock add/remove <#channel>`', isAlert: true });
        }

        const targetId = userMentionMatch[1];

        if (targetId === ctx.author.id) {
            return ctx.replyV2({ description: 'You cannot use this command on yourself!', isAlert: true });
        }

        const existing = await (client.prisma as any).uwuLock.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
        });

        if (existing && existing.lockType === 'uwu') {
            await (client.prisma as any).uwuLock.delete({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
            });

            const embed = client.embed()
                .setTitle('UwU Lock Removed')
                .setDescription(`<@${targetId}> has been freed from uwulock.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });
        } else {
            await (client.prisma as any).uwuLock.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                update: { lockType: 'uwu' },
                create: { guildId: ctx.guild.id, userId: targetId, lockType: 'uwu' }
            });

            const embed = client.embed()
                .setTitle('UwU Lock Applied')
                .setDescription(`<@${targetId}> is now uwulocked. All their messages will be uwu-ified~ :3`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });
        }
    }
}
