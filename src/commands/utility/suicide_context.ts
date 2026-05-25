import { 
    ApplicationCommandType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import SocialUtils from '../../utils/SocialUtils';

export default class SuicideContext extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'Suicide',
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
        await ctx.deferReply();

        try {
            const gifUrl = await SocialUtils.fetchGif(client, 'suicide');
            if (!gifUrl) {
                return ctx.replyV2({ description: `Could not find a GIF for **suicide**.`, isAlert: true });
            }

            await ctx.sendMessage({
                embeds: [
                    client.embed()
                        .setDescription(`💀 **${ctx.author.username}** committed suicide!`)
                        .setImage(gifUrl)
                        .setColor(client.color.main)
                ]
            });
        } catch (error) {
            console.error('[SuicideContext] Error running command:', error);
            return ctx.replyV2({ description: `Failed to commit suicide. Try again!`, isAlert: true });
        }
    }
}
