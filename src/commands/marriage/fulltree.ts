import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class FullTree extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'fulltree',
            description: {
                content: 'View the global marriage and relationship tree.',
                usage: 'fulltree [page]'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let page = 1;
        if (args.length > 0) {
            const pageVal = parseInt(args[0], 10);
            if (!isNaN(pageVal) && pageVal > 0) {
                page = pageVal;
            }
        }
        
        return await marriageHelper.fulltree(client, ctx, page);
    }
}
