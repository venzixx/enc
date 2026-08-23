import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { Resolver } from '../../utils/Resolver';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Relationship extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'relationship',
            description: {
                content: 'View your relationship status or inspect another user.',
                usage: 'relationship [@user]'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'user',
                    description: 'The user to inspect',
                    type: 6, // USER
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = await Resolver.resolveUser(ctx, ctx.options.getUser('user') || args[0]);
        return await marriageHelper.relationship(client, ctx, user);
    }
}
