import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class BotOwnerCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'botowner',
            aliases: ['bo'],
            description: {
                content: 'Bot owner settings and developer access control.',
                usage: 'botowner <add/remove/list> [args]',
                examples: ['botowner list', 'botowner add @user', 'botowner remove @user']
            },
            category: 'owner',
            cooldown: 3,
            slashCommand: false,
            hidden: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        if (!BOT_OWNERS.has(ctx.author.id)) {
            return ctx.replyV2({ description: 'Unknown command.', isAlert: true });
        }

        const msg = ctx.message;
        if (!msg) return;

        const match = msg.content.match(/botowner\s+(add|remove|list|antinuke)(?:\s+([\s\S]+))?/i) || msg.content.match(/bo\s+(add|remove|list|antinuke)(?:\s+([\s\S]+))?/i);
        if (!match) {
            return ctx.replyV2({ description: '**Usage:** `botowner <add/remove/list/antinuke> [args]`', isAlert: true });
        }

        const sub = match[1].toLowerCase();

        // ===== ADD DEV =====
        if (sub === 'add') {
            const mentionMatch = match[2]?.match(/<@!?(\d{17,20})>|(\d{17,20})/);
            if (!mentionMatch) {
                return ctx.replyV2({ description: 'Please mention a user or provide a user ID to add as dev.', isAlert: true });
            }

            const targetId = mentionMatch[1] || mentionMatch[2];

            const existing = await (client.prisma as any).devUser.findUnique({
                where: { userId: targetId }
            });

            if (existing) {
                return ctx.replyV2({ description: `<@${targetId}> is already a dev.`, isAlert: true });
            }

            await (client.prisma as any).devUser.create({
                data: { userId: targetId }
            });

            const embed = client.embed()
                .setTitle('Dev Added')
                .setDescription(`<@${targetId}> is now a dev user.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        // ===== REMOVE DEV =====
        } else if (sub === 'remove') {
            const mentionMatch = match[2]?.match(/<@!?(\d{17,20})>|(\d{17,20})/);
            if (!mentionMatch) {
                return ctx.replyV2({ description: 'Please mention a user or provide a user ID to remove from dev.', isAlert: true });
            }

            const targetId = mentionMatch[1] || mentionMatch[2];

            const deleted = await (client.prisma as any).devUser.deleteMany({
                where: { userId: targetId }
            });

            if (deleted.count === 0) {
                return ctx.replyV2({ description: `<@${targetId}> is not a dev.`, isAlert: true });
            }

            const embed = client.embed()
                .setTitle('Dev Removed')
                .setDescription(`<@${targetId}> is no longer a dev user.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        // ===== LIST DEVS =====
        } else if (sub === 'list') {
            const hardcodedOwners = ['903646482610126848', '994411485977653248', '865906211948724226'];
            const devs = await (client.prisma as any).devUser.findMany();

            const ownerLines = hardcodedOwners.map((id, i) => `**${i + 1}.** <@${id}>`);
            const devLines = devs.map((d: any, i: number) => `**${i + 1}.** <@${d.userId}>`);

            if (devLines.length === 0) {
                devLines.push('*No database developer users*');
            }

            const embed = client.embed()
                .setTitle('Bot Access Hierarchy')
                .addFields(
                    { name: '👑 Bot Owners', value: ownerLines.join('\n') },
                    { name: '🛠️ Bot Developers', value: devLines.join('\n') }
                )
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        // ===== ANTINUKE CONTROL (REDIRECTED) =====
        } else if (sub === 'antinuke') {
            return ctx.replyV2({
                title: '🛡️ Anti-Nuke Has Moved!',
                description: `Developer Anti-Nuke has been graduated and moved directly to the server command.\n\nUse **\`,antinuke strict <enable|disable>\`** to manage strict anti-nuke defense!`,
                color: client.color.main
            });
        }
    }
}
