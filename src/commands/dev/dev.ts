import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

/**
 * Parse a duration string like "1h", "30m", "2d", "1h30m" into milliseconds.
 */
function parseDuration(str: string): number | null {
    const regex = /(\d+)\s*(s|m|h|d|w)/gi;
    let total = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const val = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        switch (unit) {
            case 's': total += val * 1000; break;
            case 'm': total += val * 60 * 1000; break;
            case 'h': total += val * 60 * 60 * 1000; break;
            case 'd': total += val * 24 * 60 * 60 * 1000; break;
            case 'w': total += val * 7 * 24 * 60 * 60 * 1000; break;
        }
    }
    return total > 0 ? total : null;
}

/**
 * Format milliseconds into a human-readable string.
 */
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ') || '0s';
}

export default class Dev extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'dev',
            aliases: [],
            description: {
                content: 'Manage dev users and dev tools.',
                usage: 'dev <add/remove/list/mute/unmute> [...args]',
                examples: ['dev add @User', 'dev remove @User', 'dev list', 'dev mute @User 1h being annoying', 'dev unmute @User']
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

        const match = msg.content.match(/dev\s+(add|remove|list|mute|unmute)(?:\s+([\s\S]+))?/i);
        if (!match) {
            return ctx.replyV2({ description: '**Usage:** `dev <add/remove/list/mute/unmute> [args]`', isAlert: true });
        }

        const sub = match[1].toLowerCase();

        // ===== ADD =====
        if (sub === 'add') {
            const mentionMatch = match[2]?.match(/<@!?(\d{17,20})>/);
            if (!mentionMatch) {
                return ctx.replyV2({ description: 'Please mention a user to add as dev.', isAlert: true });
            }

            const targetId = mentionMatch[1];

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

        // ===== REMOVE =====
        } else if (sub === 'remove') {
            const mentionMatch = match[2]?.match(/<@!?(\d{17,20})>/);
            if (!mentionMatch) {
                return ctx.replyV2({ description: 'Please mention a user to remove from dev.', isAlert: true });
            }

            const targetId = mentionMatch[1];

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

        // ===== LIST =====
        } else if (sub === 'list') {
            const devs = await (client.prisma as any).devUser.findMany();

            const lines = devs.map((d: any, i: number) => `**${i + 1}.** <@${d.userId}>`);

            if (lines.length === 0) {
                lines.push('*No database dev users (hardcoded devs still have access)*');
            }

            const embed = client.embed()
                .setTitle('Dev Users')
                .setDescription(lines.join('\n'))
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        // ===== MUTE =====
        } else if (sub === 'mute') {
            const rest = match[2]?.trim();
            if (!rest) {
                return ctx.replyV2({ description: '**Usage:** `dev mute <@user> <time> [reason]`\n**Example:** `dev mute @User 1h being annoying`', isAlert: true });
            }

            // Extract mention
            const mentionMatch = rest.match(/<@!?(\d{17,20})>/);
            if (!mentionMatch) {
                return ctx.replyV2({ description: 'Please mention a user to mute.', isAlert: true });
            }

            const targetId = mentionMatch[1];
            const afterMention = rest.slice(rest.indexOf('>') + 1).trim();

            // Extract duration (first token after mention)
            const durationMatch = afterMention.match(/^(\d+[smhdw]+)/i);
            if (!durationMatch) {
                return ctx.replyV2({ description: 'Please provide a duration.\n**Example:** `dev mute @User 1h reason here`\n**Formats:** `30s`, `5m`, `1h`, `2d`, `1w`', isAlert: true });
            }

            const durationMs = parseDuration(durationMatch[1]);
            if (!durationMs) {
                return ctx.replyV2({ description: 'Invalid duration format. Use `30s`, `5m`, `1h`, `2d`, `1w`.', isAlert: true });
            }

            const reason = afterMention.slice(durationMatch[0].length).trim() || 'No reason provided';
            const expiresAt = new Date(Date.now() + durationMs);

            // Upsert the mute
            await (client.prisma as any).devMute.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                update: { reason, expiresAt, mutedBy: ctx.author.id },
                create: { guildId: ctx.guild.id, userId: targetId, reason, expiresAt, mutedBy: ctx.author.id }
            });

            // DM the muted user
            try {
                const target = await client.users.fetch(targetId);
                await target.send({
                    embeds: [
                        client.embed()
                            .setTitle('🔇 You have been muted')
                            .setDescription([
                                `**Server:** ${ctx.guild.name}`,
                                `**Duration:** ${formatDuration(durationMs)}`,
                                `**Reason:** ${reason}`,
                                `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
                                '',
                                '> Your messages will be deleted until the mute expires.'
                            ].join('\n'))
                            .setColor(0xFF0000)
                    ]
                });
            } catch {
                // Can't DM user, continue anyway
            }

            // Schedule auto-unmute
            setTimeout(async () => {
                try {
                    await (client.prisma as any).devMute.deleteMany({
                        where: { guildId: ctx.guild.id, userId: targetId }
                    });
                    // Try to DM them that they're unmuted
                    const target = await client.users.fetch(targetId).catch(() => null);
                    if (target) {
                        await target.send({
                            embeds: [
                                client.embed()
                                    .setTitle('🔊 You have been unmuted')
                                    .setDescription(`Your mute in **${ctx.guild.name}** has expired. You can send messages again.`)
                                    .setColor(0x00FF00)
                            ]
                        }).catch(() => {});
                    }
                } catch {
                    // Cleanup failed, will be caught by expiry check in MessageCreate
                }
            }, durationMs);

            const embed = client.embed()
                .setTitle('🔇 Dev Mute Applied')
                .setDescription([
                    `<@${targetId}> has been dev-muted.`,
                    '',
                    `**Duration:** ${formatDuration(durationMs)}`,
                    `**Reason:** ${reason}`,
                    `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
                ].join('\n'))
                .setColor(0xFF0000);

            return ctx.reply({ embeds: [embed] });

        // ===== UNMUTE =====
        } else if (sub === 'unmute') {
            const mentionMatch = match[2]?.match(/<@!?(\d{17,20})>/);
            if (!mentionMatch) {
                return ctx.replyV2({ description: 'Please mention a user to unmute.', isAlert: true });
            }

            const targetId = mentionMatch[1];

            const deleted = await (client.prisma as any).devMute.deleteMany({
                where: { guildId: ctx.guild.id, userId: targetId }
            });

            if (deleted.count === 0) {
                return ctx.replyV2({ description: `<@${targetId}> is not dev-muted.`, isAlert: true });
            }

            // DM the user
            try {
                const target = await client.users.fetch(targetId);
                await target.send({
                    embeds: [
                        client.embed()
                            .setTitle('🔊 You have been unmuted')
                            .setDescription(`You have been unmuted in **${ctx.guild.name}**. You can send messages again.`)
                            .setColor(0x00FF00)
                    ]
                });
            } catch {
                // Can't DM user
            }

            const embed = client.embed()
                .setTitle('🔊 Dev Mute Removed')
                .setDescription(`<@${targetId}> has been unmuted.`)
                .setColor(0x00FF00);

            return ctx.reply({ embeds: [embed] });
        }
    }
}
