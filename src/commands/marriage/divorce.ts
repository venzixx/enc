import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Divorce extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'divorce',
            description: {
                content: 'Divorce your spouse globally.',
                usage: 'divorce'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        return await marriageHelper.divorce(client, ctx);
    }
}
