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
        let font = 'Inter';
        const subArgs = [...args];

        const fontIndex = subArgs.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
        if (fontIndex !== -1) {
            const fontArg = subArgs.splice(fontIndex, 1)[0];
            const match = fontArg.match(/font=["']?([^"']+)["']?/i);
            if (match) font = match[1].trim();
        }

        const pageIndex = subArgs.findIndex(arg => !isNaN(parseInt(arg, 10)));
        if (pageIndex !== -1) {
            page = parseInt(subArgs.splice(pageIndex, 1)[0], 10);
        }

        if (font === 'Inter' && subArgs.length > 0) {
            font = subArgs.join(' ').trim();
        }
        
        return await marriageHelper.fulltree(client, ctx, page, font);
    }
}
