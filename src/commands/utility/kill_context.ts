import { 
    ApplicationCommandType, 
    UserContextMenuCommandInteraction 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import SocialUtils from '../../utils/SocialUtils';

export default class KillContext extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'Kill',
            type: ApplicationCommandType.User, // Right-click a user
            category: 'utility',
            slashCommand: true,
            // @ts-ignore
            integration_types: [0, 1],
            // @ts-ignore
            contexts: [0, 1, 2]
        });
    }

    public async run(client: ExtendedClient, ctx: Context): Promise<any> {
        const targetUser = ctx.targetUser;
        if (!targetUser) return;

        if (targetUser.id === ctx.author.id) {
            return ctx.replyV2({ description: `You can't kill yourself with this command! Use Suicide instead.`, isAlert: true });
        }

        await ctx.deferReply();

        try {
            const gifUrl = await SocialUtils.fetchGif(client, 'kill');
            if (!gifUrl) {
                return ctx.replyV2({ description: `Could not find a GIF for **kill**.`, isAlert: true });
            }

            // Increment database count
            const pair = await (client.prisma as any).socialAction.upsert({
                where: { userId_fromId_action: { userId: targetUser.id, fromId: ctx.author.id, action: 'kill' } },
                update: { count: { increment: 1 } },
                create: { userId: targetUser.id, fromId: ctx.author.id, action: 'kill', count: 1 }
            });

            const total = await (client.prisma as any).socialAction.aggregate({
                where: { userId: targetUser.id, action: 'kill' },
                _sum: { count: true }
            });

            const countText = `\n\n*That's **${pair.count}** times you've killed them! (${total._sum.count || 0} total)*`;

            await ctx.sendMessage({
                content: `${targetUser}`,
                embeds: [
                    client.embed()
                        .setDescription(`${client.emoji.duel_swords} **${ctx.author.username}** killed **${targetUser.username}**!${countText}`)
                        .setImage(gifUrl)
                        .setColor(client.color.main)
                ]
            });
        } catch (error) {
            console.error('[KillContext] Error running command:', error);
            return ctx.replyV2({ description: `Failed to kill user. Try again!`, isAlert: true });
        }
    }
}
