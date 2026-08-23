import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Fulltree extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'fulltree',
            description: {
                content: 'View the global marriage and relationship tree.',
                usage: 'fulltree [page] [font=FontName]'
            },
            category: 'marriage',
            cooldown: 5,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'page',
                    description: 'Page number for global tree canvas',
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

        if (ctx.interaction) {
            page = ctx.options.getInteger('page') || 1;
            font = ctx.options.getString('font') || 'Inter';
        } else {
            const fontIndex = args.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
            if (fontIndex !== -1) {
                const fontArg = args[fontIndex];
                const match = fontArg.match(/font=["']?([^"']+)["']?/i);
                if (match) font = match[1].trim();
            }

            const pageArg = args.find(arg => !isNaN(parseInt(arg, 10)) && !arg.includes('='));
            if (pageArg) {
                page = parseInt(pageArg, 10);
            }
        }

        return await marriageHelper.fulltree(client, ctx, page, font);
    }
}
