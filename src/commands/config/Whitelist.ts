import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import S from './S';

export default class WhitelistCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'whitelist',
            aliases: [],
            description: {
                content: 'Manage the AutoMod whitelist (bypasses links and gifs).',
                usage: 'whitelist <add/remove/list> [target]',
                examples: ['whitelist add @user', 'whitelist add #channel', 'whitelist list']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: false,
            hidden: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        // Forward arguments to the 's whitelist' handler
        const sCmd = new S(client);
        return sCmd.run(client, ctx, ['whitelist', ...args]);
    }
}
