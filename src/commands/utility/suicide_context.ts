import { 
    ApplicationCommandType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import SocialUtils from '../../utils/SocialUtils';
import { V2Helper } from '../../utils/V2Helper';

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
                return ctx.replyV2({ description: `Could not find a GIF for **suicide**.`, isAlert: true, borderless: true, color: null });
            }

            const layout = V2Helper.createLayout({
                description: `${client.emoji.skull_death} <@${ctx.author.id}> committed suicide!`,
                image: gifUrl,
                borderless: true,
                color: null
            });

            await ctx.sendMessage(layout as any);
        } catch (error) {
            console.error('[SuicideContext] Error running command:', error);
            return ctx.replyV2({ description: `Failed to commit suicide. Try again!`, isAlert: true });
        }
    }
}
