import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Relationship extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'relationship',
            description: {
                content: 'Check the relationship path between you and another user.',
                usage: 'relationship <@user>'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = ctx.options.getUser('user', 0);
        return await marriageHelper.relationship(client, ctx, user);
    }
}
