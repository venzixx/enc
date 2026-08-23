import { ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Vote extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'vote',
            description: {
                content: 'Vote for the bot on Top.gg and manage your 12-hour vote reminders.',
                usage: 'vote',
                examples: ['vote']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            aliases: ['topgg', 'votelink', 'remindvote']
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const userId = ctx.author.id;
        const botId = client.user?.id || '1493482964246593556';
        const voteUrl = `https://top.gg/bot/${botId}/vote`;

        // Fetch user vote status
        const voteRecord = await client.prisma.userVote.findUnique({
            where: { userId }
        });

        const totalVotes = voteRecord?.totalVotes || 0;
        const remindEnabled = voteRecord ? voteRecord.remindMe : true;

        let statusText = 'You can vote right now!';
        let canVoteNow = true;

        if (voteRecord?.lastVotedAt) {
            const nextVoteTime = new Date(voteRecord.lastVotedAt.getTime() + 12 * 60 * 60 * 1000);
            if (Date.now() < nextVoteTime.getTime()) {
                canVoteNow = false;
                const nextUnix = Math.floor(nextVoteTime.getTime() / 1000);
                statusText = `You already voted recently! You can vote again <t:${nextUnix}:R> (<t:${nextUnix}:t>).`;
            }
        }

        const voteButton = new ButtonBuilder()
            .setLabel('Vote on Top.gg')
            .setStyle(ButtonStyle.Link)
            .setURL(voteUrl);

        const remindToggleId = `vote_toggle_remind_${userId}_${Date.now()}`;
        const remindButton = new ButtonBuilder()
            .setCustomId(remindToggleId)
            .setLabel(remindEnabled ? 'Reminders: ON' : 'Reminders: OFF')
            .setStyle(remindEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(client.emoji.mention_bell?.match(/\d+/)?.[0] || '🔔');

        const description = [
            `Support **${client.user?.username || 'Enc'}** by voting on **Top.gg** every **12 hours**!`,
            '',
            `**Status:** ${canVoteNow ? `${client.emoji.check_success} ${statusText}` : `${client.emoji.clock_time} ${statusText}`}`,
            `**Total Votes:** \`${totalVotes}\``,
            `**12h DM Reminder:** \`${remindEnabled ? 'Enabled' : 'Disabled'}\``,
            '',
            '-# Votes reset every 12 hours. Top.gg awards double votes on weekends!'
        ].join('\n');

        await ctx.replyV2({
            title: `${client.emoji.starboard_star} Vote for ${client.user?.username || 'Enc'}`,
            description,
            buttons: [voteButton, remindButton],
            color: client.color.main,
            footer: 'Top.gg Vote Integration • Enc Utility'
        });

        if (!ctx.channel) return;

        // Button collector for toggling reminders
        const collector = ctx.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.customId === remindToggleId && i.user.id === userId,
            time: 60000
        });

        collector.on('collect', async (interaction) => {
            try {
                const current = await client.prisma.userVote.findUnique({
                    where: { userId }
                });

                const newRemind = current ? !current.remindMe : false;

                await client.prisma.userVote.upsert({
                    where: { userId },
                    update: { remindMe: newRemind },
                    create: { userId, remindMe: newRemind, totalVotes: 0 }
                });

                const updatedRemindButton = new ButtonBuilder()
                    .setCustomId(remindToggleId)
                    .setLabel(newRemind ? 'Reminders: ON' : 'Reminders: OFF')
                    .setStyle(newRemind ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(client.emoji.mention_bell?.match(/\d+/)?.[0] || '🔔');

                const updatedDesc = [
                    `Support **${client.user?.username || 'Enc'}** by voting on **Top.gg** every **12 hours**!`,
                    '',
                    `**Status:** ${canVoteNow ? `${client.emoji.check_success} ${statusText}` : `${client.emoji.clock_time} ${statusText}`}`,
                    `**Total Votes:** \`${totalVotes}\``,
                    `**12h DM Reminder:** \`${newRemind ? 'Enabled' : 'Disabled'}\``,
                    '',
                    `-# ${newRemind ? 'You will receive a DM when your vote is ready in 12 hours!' : '12-hour vote reminders are turned off.'}`
                ].join('\n');

                await interaction.update({
                    components: [
                        {
                            type: 17,
                            accent_color: 0xFFFFFF,
                            components: [
                                {
                                    type: 10,
                                    content: `### ${client.emoji.starboard_star} Vote for ${client.user?.username || 'Enc'}\n${updatedDesc}`
                                },
                                {
                                    type: 1,
                                    components: [voteButton.toJSON(), updatedRemindButton.toJSON()]
                                }
                            ]
                        }
                    ] as any
                });
            } catch (err) {
                console.error('[VoteToggle] Error:', err);
            }
        });
    }
}
