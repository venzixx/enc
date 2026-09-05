import { ApplicationCommandOptionType, User } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { StreakHelper } from '../../utils/StreakHelper';

export default class StreaksCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'streaks',
            aliases: ['streak', 'stk', 'mystreak'],
            description: {
                content: 'View your message streaks and server streak leaderboard.',
                usage: 'streaks [user | top]',
                examples: ['streaks', 'streaks @user', 'streaks top']
            },
            category: 'general',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'The user to view streaks for',
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: 'leaderboard',
                    description: 'View the server streak leaderboard instead',
                    type: ApplicationCommandOptionType.Boolean,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) {
            return ctx.replyV2({
                title: `${client.emoji.cross} Server Only`,
                description: 'Streak tracking is server-specific. Please run this command inside a server!',
                isAlert: true,
                borderless: true,
                color: null
            });
        }

        const showLeaderboard = ctx.isInteraction
            ? ctx.options.getBoolean('leaderboard')
            : (args[0]?.toLowerCase() === 'top' || args[0]?.toLowerCase() === 'lb' || args[0]?.toLowerCase() === 'leaderboard');

        if (showLeaderboard) {
            const lbLayout = await StreakHelper.buildLeaderboardLayout(client, ctx.guild.id, ctx.author.id);
            return ctx.replyV2(lbLayout as any);
        }

        let target: User = ctx.author;
        if (ctx.isInteraction) {
            target = ctx.options.getUser('user') || ctx.author;
        } else {
            if (args[0]) {
                const cleaned = args[0].replace(/[<@!>]/g, '');
                let found = client.users.cache.get(cleaned);
                if (!found && /^\d{17,20}$/.test(cleaned)) {
                    try {
                        found = await client.users.fetch(cleaned);
                    } catch {}
                }
                if (found) target = found;
            }
        }

        const layout = await StreakHelper.buildUserStreaksLayout(client, ctx.guild.id, target, ctx.author.id);
        return ctx.replyV2(layout as any);
    }
}

