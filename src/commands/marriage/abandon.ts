import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

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
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        return await marriageHelper.abandon(client, ctx);
    }
}
