import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class MommyLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'mommylock',
            aliases: [],
            description: {
                content: 'Toggle mommylock on a user.',
                usage: 'mommylock <@user>',
                examples: ['mommylock @User']
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

        const mentionMatch = msg.content.match(/<@!?(\d{17,20})>/);
        if (!mentionMatch) {
            return ctx.replyV2({ description: 'Please mention a user.\n**Usage:** `mommylock <@user>`', isAlert: true });
        }

        const targetId = mentionMatch[1];

        const existing = await (client.prisma as any).uwuLock.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
        });

        if (existing && existing.lockType === 'mommy') {
            await (client.prisma as any).uwuLock.delete({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
            });

            const embed = client.embed()
                .setTitle('Mommy Lock Removed')
                .setDescription(`<@${targetId}> has been freed from mommylock.`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        } else {
            await (client.prisma as any).uwuLock.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                update: { lockType: 'mommy' },
                create: { guildId: ctx.guild.id, userId: targetId, lockType: 'mommy' }
            });

            const embed = client.embed()
                .setTitle('Mommy Lock Applied')
                .setDescription(`<@${targetId}> is now mommylocked~ 💕`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        }
    }
}
