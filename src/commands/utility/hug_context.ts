import { 
    ApplicationCommandType, 
    UserContextMenuCommandInteraction 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import axios from 'axios';

export default class GiveHug extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'Give Hug',
            type: ApplicationCommandType.User, // Right-click a user
            category: 'utility',
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
            return ctx.replyV2({ description: `You hugged yourself! You feel a little warmer.`, isAlert: true });
        }

        await ctx.deferReply();

        try {
            const res = await axios.get('https://api.otakugifs.xyz/gif?reaction=hug');
            const gifUrl = res.data.url;

            // Increment database count
            const pair = await client.prisma.socialAction.upsert({
                where: { userId_fromId_action: { userId: targetUser.id, fromId: ctx.author.id, action: 'hug' } },
                update: { count: { increment: 1 } },
                create: { userId: targetUser.id, fromId: ctx.author.id, action: 'hug', count: 1 }
            });

            await ctx.sendMessage({
                content: `${targetUser}`,
                embeds: [
                    client.embed()
                        .setDescription(`🤗 **${ctx.author.username}** gave **${targetUser.username}** a big hug!\n\n*That's **${pair.count}** times now!*`)
                        .setImage(gifUrl)
                        .setColor(client.color.main)
                ]
            });
        } catch (error) {
            return ctx.replyV2({ description: `Failed to give a hug. Try again!`, isAlert: true });
        }
    }
}
