import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Adopt extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'adopt',
            description: {
                content: 'Adopt a user globally.',
                usage: 'adopt <@user>'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = ctx.options.getUser('user', 0);
        return await marriageHelper.adopt(client, ctx, user);
    }
}
