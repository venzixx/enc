import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class SetRing extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'setring',
            description: {
                content: 'Set custom marriage ring string/emoji.',
                usage: 'setring <ring>'
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: false
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const ring = args.join(' ');
        return await marriageHelper.setring(client, ctx, ring);
    }
}
