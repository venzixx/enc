import { ApplicationCommandOptionType as Option, ChannelType, PermissionFlagsBits, type APIApplicationCommandChannelOption } from 'discord.js';
import type { Prisma } from '@prisma/client';
import type { ExtendedClient } from '../../client';
import { Command, Context } from '../../structures';
import { BumpReminder } from '../../utils/BumpReminder';

const channelOption: APIApplicationCommandChannelOption = {
    name: 'channel',
    description: 'Channel where Enc posts bump reminders',
    type: Option.Channel,
    channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
};

export default class Bump extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'bump',
            description: {
                content: 'Manage DISBOARD bump reminders and view the leaderboard.',
                usage: 'bump <enable|disable|edit|leaderboard>',
                examples: ['bump enable', 'bump edit']
            },
            category: 'config',
            slashCommand: true,
            options: [
                { name: 'leaderboard', description: 'Show the most and fewest bumps and your rank', type: Option.Subcommand },
                { name: 'enable', description: 'Start tracking successful DISBOARD bumps', type: Option.Subcommand, options: [channelOption] },
                { name: 'disable', description: 'Turn off bump reminders', type: Option.Subcommand },
                {
                    name: 'edit',
                    description: 'Edit the reminder layout, channel, and mentions',
                    type: Option.Subcommand,
                    options: [
                        channelOption,
                        { name: 'title', description: 'Reminder title', type: Option.String, max_length: 256 },
                        { name: 'message', description: 'Reminder message', type: Option.String, max_length: 3000 },
                        { name: 'footer', description: 'Small text at the bottom', type: Option.String, max_length: 256 },
                        { name: 'role', description: 'Role to ping', type: Option.Role },
                        { name: 'user', description: 'Person to ping', type: Option.User },
                        { name: 'clear_mentions', description: 'Clear existing role and user pings', type: Option.Boolean },
                        { name: 'reset_text', description: 'Restore the default message layout', type: Option.Boolean }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context) {
        if (!ctx.guild || !ctx.isInteraction) {
            return ctx.replyV2({ description: 'Use `/bump leaderboard` or configure reminders with `/bump enable`, `/bump disable`, or `/bump edit` in a server.', borderless: true });
        }

        const guildId = ctx.guild.id;
        const subcommand = ctx.options.getSubcommand();
        if (subcommand === 'leaderboard') {
            await ctx.deferReply();
            const scores = await client.prisma.bumpScore.findMany({
                where: { guildId, count: { gt: 0 } },
                orderBy: [{ count: 'desc' }, { userId: 'asc' }]
            });
            let rank = 0;
            const ranked = scores.map((score, index) => {
                if (scores[index - 1]?.count !== score.count) rank = index + 1;
                return { ...score, rank };
            });
            const format = (score: typeof ranked[number]) => `**#${score.rank}** <@${score.userId}> · ${score.count}`;
            const own = ranked.find(score => score.userId === ctx.author.id);
            return ctx.replyV2({
                title: 'Bump leaderboard',
                description: ranked.length ? [
                    '**Most bumps**', ...ranked.slice(0, 5).map(format),
                    '', '**Fewest bumps**', ...ranked.slice(-5).reverse().map(format),
                    '', own ? `**Your position** · #${own.rank} of ${ranked.length} · ${own.count} bumps` : '**Your position** · Unranked'
                ].join('\n') : 'No bumps have been recorded yet.',
                borderless: true,
                allowedMentions: { parse: [], roles: [], users: [], repliedUser: false }
            });
        }
        if (!ctx.interaction?.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return ctx.replyV2({ description: 'You need Manage Server to change bump settings.', borderless: true, ephemeral: true });
        }
        const settings = await client.prisma.bumpReminder.findUnique({ where: { guildId } });
        if (subcommand === 'disable') {
            await client.prisma.bumpReminder.updateMany({
                where: { guildId },
                data: { enabled: false, dueAt: null }
            });
            return ctx.replyV2({ description: 'Bump reminders disabled.', borderless: true, ephemeral: true });
        }

        const channelId = ctx.options.getChannel('channel')?.id ?? settings?.channelId
            ?? (subcommand === 'enable' ? ctx.channel?.id : undefined);
        if (channelId && (subcommand === 'enable' || ctx.options.getChannel('channel'))) {
            const channel = await ctx.guild.channels.fetch(channelId);
            if (!channel?.isSendable() || channel.isThread() || !ctx.guild.members.me ||
                !channel.permissionsFor(ctx.guild.members.me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                return ctx.replyV2({ description: 'Choose a channel Enc can view and send messages in.', borderless: true, ephemeral: true });
            }
        }

        if (subcommand === 'enable') {
            if (!channelId) {
                return ctx.replyV2({ description: 'Choose a reminder channel to enable bump reminders.', borderless: true, ephemeral: true });
            }
            await client.prisma.bumpReminder.upsert({
                where: { guildId },
                create: { guildId, channelId, enabled: true },
                update: { channelId, enabled: true }
            });
            return ctx.replyV2({
                description: `Bump reminders enabled in <#${channelId}>. The timer starts after the next successful DISBOARD bump Enc sees.`,
                borderless: true,
                ephemeral: true
            });
        }

        const role = ctx.options.getRole('role');
        if (role?.id === guildId) {
            return ctx.replyV2({ description: 'Choose a specific role to ping.', borderless: true, ephemeral: true });
        }

        const clearMentions = ctx.options.getBoolean('clear_mentions');
        const resetText = ctx.options.getBoolean('reset_text');
        const changes: Omit<Prisma.BumpReminderCreateInput, 'guildId'> = {
            channelId: ctx.options.getChannel('channel')?.id,
            roleId: role?.id ?? (clearMentions ? null : undefined),
            userId: ctx.options.getUser('user')?.id ?? (clearMentions ? null : undefined),
            title: ctx.options.getString('title')?.trim() || (resetText ? null : undefined),
            message: ctx.options.getString('message')?.trim() || (resetText ? null : undefined),
            footer: ctx.options.getString('footer')?.trim() || (resetText ? null : undefined)
        };
        const updated = Object.values(changes).some(value => value !== undefined)
            ? await client.prisma.bumpReminder.upsert({ where: { guildId }, create: { guildId, ...changes }, update: changes })
            : settings;
        return ctx.replyV2(BumpReminder.layout(updated, true));
    }
}
