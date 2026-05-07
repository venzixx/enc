import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class NsfwLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'nsfwlock',
            aliases: [],
            description: {
                content: 'Toggle nsfwlock on a user.',
                usage: 'nsfwlock <@user>',
                examples: ['nsfwlock @User']
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
            return ctx.replyV2({ description: 'Please mention a user.\n**Usage:** `nsfwlock <@user>`', isAlert: true });
        }

        const targetId = mentionMatch[1];

        const existing = await (client.prisma as any).uwuLock.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
        });

        if (existing && existing.lockType === 'nsfw') {
            // Remove if already nsfw locked
            await (client.prisma as any).uwuLock.delete({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } }
            });

            const embed = client.embed()
                .setTitle('NSFW Lock Removed')
                .setDescription(`<@${targetId}> has been freed from nsfwlock.`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        } else {
            // Upsert — overwrite any existing lock type
            await (client.prisma as any).uwuLock.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                update: { lockType: 'nsfw' },
                create: { guildId: ctx.guild.id, userId: targetId, lockType: 'nsfw' }
            });

            const embed = client.embed()
                .setTitle('NSFW Lock Applied')
                .setDescription(`<@${targetId}> is now nsfwlocked~ 😏`)
                .setColor(client.color.main);
            return ctx.reply({ embeds: [embed] });
        }
    }
}
