import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Tree extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'tree',
            description: {
                content: 'View your or another user\'s family tree image.',
                usage: 'tree [@user] [page]'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const user = ctx.options.getUser('user', 0);
        
        let page = 1;
        // Find if page index was specified as the second parameter or the only parameter if no user is mentioned
        if (args.length > 0) {
            // Check if first arg is number
            const firstArgAsNum = parseInt(args[0], 10);
            if (!isNaN(firstArgAsNum) && firstArgAsNum > 0) {
                page = firstArgAsNum;
            } else if (args.length > 1) {
                const secondArgAsNum = parseInt(args[1], 10);
                if (!isNaN(secondArgAsNum) && secondArgAsNum > 0) {
                    page = secondArgAsNum;
                }
            }
        }
        
        return await marriageHelper.drawTree(client, ctx, user, page);
    }
}
