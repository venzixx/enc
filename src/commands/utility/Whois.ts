import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import Info from './Info';

export default class Whois extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'whois',
            aliases: ['user', 'who', 'ui'],
            description: {
                content: 'Stealthily retrieve identity and membership data for a user.',
                usage: 'whois [user]',
                examples: ['whois @member', 'user 123456789']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: false, // Legacy/Safe only
            hidden: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        // Reuse logic from Info command
        const info = new Info(client);
        return info.handleUser(client, ctx, args);
    }
}
