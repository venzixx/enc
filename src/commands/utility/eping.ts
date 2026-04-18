import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Eping extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'eping',
            description: {
                content: 'Ephemeral ping command.',
                usage: 'eping',
                examples: ['eping']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply(true);

        try {
            const msg = await ctx.channel.send({ content: '@everyone' });
            await msg.delete();
            return ctx.editReply({ content: 'Ghost ping sent.' });
        } catch (e) {
            return ctx.editReply({ content: 'Failed to send ghost ping. Check permissions.' });
        }
    }
}
