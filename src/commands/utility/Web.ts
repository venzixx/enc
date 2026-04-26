import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import Info from './Info';

export default class Web extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'web',
            aliases: ['dashboard', 'panel'],
            description: {
                content: 'Access the bot dashboard and system manifest.',
                usage: 'web',
                examples: ['web']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: false, // Legacy/Safe only
            hidden: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        // Reuse logic from Info bot
        const info = new Info(client);
        return info.handleBot(client, ctx);
    }
}
