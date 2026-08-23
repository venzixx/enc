import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Setring extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'setring',
            description: {
                content: 'Set a custom marriage ring string/emoji.',
                usage: 'setring <ring>'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'ring',
                    description: 'Custom ring string or emoji',
                    type: 3, // STRING
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const ring = ctx.options.getString('ring') || args.join(' ');
        return await marriageHelper.setring(client, ctx, ring);
    }
}
