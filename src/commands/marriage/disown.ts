import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { Resolver } from '../../utils/Resolver';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Disown extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'disown',
            description: {
                content: 'Disown a child from your family.',
                usage: 'disown <@user>'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'user',
                    description: 'The child to disown',
                    type: 6, // USER
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = await Resolver.resolveUser(ctx, ctx.options.getUser('user') || args[0]);
        return await marriageHelper.disown(client, ctx, user);
    }
}
