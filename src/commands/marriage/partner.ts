import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Partner extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'partner',
            description: {
                content: 'View your spouse or someone else\'s spouse status.',
                usage: 'partner [@user]'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = ctx.options.getUser('user', 0);
        return await marriageHelper.partner(client, ctx, user);
    }
}
