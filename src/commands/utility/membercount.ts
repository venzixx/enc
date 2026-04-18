import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class MemberCount extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'membercount',
            description: {
                content: 'Shows the number of members, users, and bots.',
                usage: 'membercount',
                examples: ['membercount']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();
        
        await ctx.guild.members.fetch(); // Ensure accurate counts

        const total = ctx.guild.memberCount;
        const bots = (ctx.guild.members.cache as any).filter((m: any) => m.user.bot).size;
        const humans = total - bots;

        return ctx.replyV2({
            title: `📊 Member Count for ${ctx.guild.name}`,
            description: `**Total Members:** ${total}\n**Humans:** ${humans}\n**Bots:** ${bots}`,
            color: client.color.main
        });
    }
}
