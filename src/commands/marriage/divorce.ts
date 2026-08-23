import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export default class Divorce extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'divorce',
            description: {
                content: 'Divorce your current spouse.',
                usage: 'divorce'
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
        return await marriageHelper.divorce(client, ctx);
    }
}
