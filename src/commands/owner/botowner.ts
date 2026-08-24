import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class BotOwnerCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'botowner',
            aliases: ['bo'],
            description: {
                content: 'Bot owner settings and Developer Anti-Nuke control.',
                usage: 'botowner <add/remove/list/antinuke> [args]',
                examples: ['botowner list', 'botowner add @user', 'botowner antinuke enable']
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

        // ===== ANTINUKE CONTROL =====
        } else if (sub === 'antinuke') {
            const arg = match[2]?.trim()?.toLowerCase();
            const current = await (client.prisma as any).devAntiNuke.findUnique({
                where: { guildId: ctx.guild.id }
            });

            if (!arg || arg === 'status') {
                const state = current?.enabled ? '🟢 **ENABLED**' : '🔴 **DISABLED**';
                return ctx.replyV2({
                    title: '🛡️ Developer Anti-Nuke Status',
                    description: `Developer Anti-Nuke is currently ${state} for **${ctx.guild.name}**.\n\n*Use \`botowner antinuke <enable|disable>\` to toggle.*`,
                    color: current?.enabled ? client.color.green : client.color.red
                });
            }

            if (!['enable', 'disable'].includes(arg)) {
                return ctx.replyV2({ description: '**Usage:** `botowner antinuke <enable|disable|status>`', isAlert: true });
            }

            const isEnabled = arg === 'enable';
            await (client.prisma as any).devAntiNuke.upsert({
                where: { guildId: ctx.guild.id },
                update: { enabled: isEnabled },
                create: { guildId: ctx.guild.id, enabled: isEnabled }
            });

            return ctx.replyV2({
                description: `Developer Anti-Nuke has been **${isEnabled ? 'enabled' : 'disabled'}** for this server.`,
                color: isEnabled ? client.color.green : client.color.red
            });
        }
    }
}
