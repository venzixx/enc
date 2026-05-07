import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class UwuLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'uwulock',
            aliases: [],
            description: {
                content: 'Toggle uwulock on a user.',
                usage: 'uwulock <@user>',
                examples: ['uwulock @User']
            },
            category: 'dev',
            cooldown: 3,
            slashCommand: false,
            hidden: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!await isDev(client, ctx.author.id)) {
            return ctx.replyV2({ description: 'Unknown command.', isAlert: true });
        }

        const msg = ctx.message;
        if (!msg) return;

        // Parse user mention from raw content
        const mentionMatch = msg.content.match(/<@!?(\d{17,20})>/);
        if (!mentionMatch) {
            return ctx.replyV2({ description: 'Please mention a user.\n**Usage:** `uwulock <@user>`', isAlert: true });
        }

        const targetId = mentionMatch[1];

        // Toggle: check if already locked
        const existing = await (client.prisma as any).uwuLock.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
        });

        if (existing) {
            await (client.prisma as any).uwuLock.delete({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
            });

            const embed = client.embed()
                .setTitle('UwU Lock Removed')
                .setDescription(`<@${targetId}> has been freed from uwulock.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });
        } else {
            await (client.prisma as any).uwuLock.create({
                data: { guildId: ctx.guild.id, userId: targetId }
            });

            const embed = client.embed()
                .setTitle('UwU Lock Applied')
                .setDescription(`<@${targetId}> is now uwulocked. All their messages will be uwu-ified~ :3`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });
        }
    }
}
