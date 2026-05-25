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
        let font = 'Inter';
        const subArgs = [...args];

        const fontIndex = subArgs.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
        if (fontIndex !== -1) {
            const fontArg = subArgs.splice(fontIndex, 1)[0];
            const match = fontArg.match(/font=["']?([^"']+)["']?/i);
            if (match) font = match[1].trim();
        }

        const pageIndex = subArgs.findIndex(arg => !isNaN(parseInt(arg, 10)) && !arg.includes('<@') && !arg.includes('@'));
        if (pageIndex !== -1) {
            page = parseInt(subArgs.splice(pageIndex, 1)[0], 10);
        }

        const userIndex = subArgs.findIndex(arg => arg.startsWith('<@') || /^\d{17,19}$/.test(arg));
        if (userIndex !== -1) {
            subArgs.splice(userIndex, 1);
        }

        if (font === 'Inter' && subArgs.length > 0) {
            font = subArgs.join(' ').trim();
        }
        
        return await marriageHelper.drawTree(client, ctx, user, page, font);
    }
}
