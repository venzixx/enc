import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Disown extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'disown',
            description: {
                content: 'Disown a child.',
                usage: 'disown <@user>'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = ctx.options.getUser('user', 0);
        return await marriageHelper.disown(client, ctx, user);
    }
}
