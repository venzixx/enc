import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { Resolver } from '../../utils/Resolver';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Marry extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'marry',
            description: {
                content: 'Propose to and marry a user globally.',
                usage: 'marry <@user>',
                examples: ['marry @user', 'marry 123456789012345678']
            },
            aliases: ['propose', 'proposal'],
            category: 'marriage',
            cooldown: 5,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'user',
                    description: 'The user you want to marry',
                    type: 6, // USER
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = await Resolver.resolveUser(ctx, ctx.options.getUser('user') || args[0]);
        return await marriageHelper.marry(client, ctx, user);
    }
}
