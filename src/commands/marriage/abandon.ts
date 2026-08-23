import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Abandon extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'abandon',
            description: {
                content: 'Abandon your parents.',
                usage: 'abandon'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: []
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        return await marriageHelper.abandon(client, ctx);
    }
}
