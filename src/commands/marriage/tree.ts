import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { Resolver } from '../../utils/Resolver';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Tree extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'tree',
            description: {
                content: 'View your family tree canvas or someone else\'s family tree.',
                usage: 'tree [@user] [page] [font=FontName]'
            },
            category: 'marriage',
            cooldown: 5,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'user',
                    description: 'User to view family tree for',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'page',
                    description: 'Page number for paginated tree',
                    type: 4, // INTEGER
                    required: false
                },
                {
                    name: 'font',
                    description: 'Font name for tree canvas rendering',
                    type: 3, // STRING
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let page = 1;
        let font = 'Inter';
        let targetUser = null;

        if (ctx.interaction) {
            targetUser = ctx.options.getUser('user');
            page = ctx.options.getInteger('page') || 1;
            font = ctx.options.getString('font') || 'Inter';
        } else {
            const subArgs = [...args];
            const fontIndex = subArgs.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
            if (fontIndex !== -1) {
                const fontArg = subArgs.splice(fontIndex, 1)[0];
                const match = fontArg.match(/font=["']?([^"']+)["']?/i);
                if (match) font = match[1].trim();
            }

            const pageIndex = subArgs.findIndex(arg => !isNaN(parseInt(arg, 10)) && !arg.includes('<@') && !arg.includes('@'));
            if (pageIndex !== -1) {
                page = parseInt(subArgs.splice(pageIndex, 1)[0], 10);
            }

            const userStr = subArgs.find(arg => arg.startsWith('<@') || /^\d{17,19}$/.test(arg));
            if (userStr) {
                targetUser = await Resolver.resolveUser(ctx, userStr);
            }
        }

        return await marriageHelper.drawTree(client, ctx, targetUser, page, font);
    }
}
