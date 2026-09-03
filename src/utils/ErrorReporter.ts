import { EmbedBuilder, User, Guild, Channel } from 'discord.js';
import { ExtendedClient } from '../client';
import logger from '../structures/Logger';

export interface CommandErrorInfo {
    commandName: string;
    user: User;
    guild?: Guild | null;
    channel?: Channel | null;
    args?: string[];
    error: any;
    type: 'SLASH' | 'PREFIX';
}

export interface ComponentErrorInfo {
    customId: string;
    user: User;
    guild?: Guild | null;
    channel?: Channel | null;
    error: any;
}

export class ErrorReporter {
    // Hardcoded owner/developer IDs to notify
    private static readonly OWNER_IDS = [
        '865906211948724226', // Sidharth Primary Owner ID
        '903646482610126848',
        '994411485977653248',
        process.env.OWNER_ID || ''
    ].filter(id => id.length > 0);

    // Error deduplication cache (errorKey -> timestamp)
    private static errorCooldowns = new Map<string, number>();

    /**
     * Reports an unhandled command execution error to the owner(s) via DM.
     */
    public static async reportCommandError(client: ExtendedClient, info: CommandErrorInfo): Promise<void> {
        try {
            // Ignore Discord Gateway opcode 8 rate limits (normal Discord limitation, not a code bug)
            const isGatewayRateLimit = info.error?.name === 'GatewayRateLimitError' || 
                (typeof info.error?.message === 'string' && (info.error.message.includes('opcode 8') || info.error.message.includes('rate limited')));
            if (isGatewayRateLimit) return;

            const errKey = `${info.commandName}:${info.error?.message || 'unknown'}`;
            if (this.isRateLimited(errKey)) return;

            const stack = this.sanitizeStack(info.error?.stack || info.error?.message || String(info.error));
            const unix = Math.floor(Date.now() / 1000);

            const embed = new EmbedBuilder()
                .setTitle(`🚨 [Enc Error Dispatcher] Command Failure`)
                .setColor(0xef4444) // Bright warning red
                .setDescription(
                    `An exception occurred while executing a command.\n\n` +
                    `• **Command:** \`${info.type === 'SLASH' ? '/' : ','}${info.commandName}\`\n` +
                    `• **Executor:** **${info.user.tag}** (\`${info.user.id}\`)\n` +
                    `• **Guild:** ${info.guild ? `**${info.guild.name}** (\`${info.guild.id}\`)` : '`Direct Messages`'}\n` +
                    `• **Channel:** ${info.channel ? `<#${info.channel.id}> (\`${info.channel.id}\`)` : '`N/A`'}\n` +
                    `• **Parameters:** \`${info.args && info.args.length > 0 ? info.args.join(' ') : 'None'}\`\n` +
                    `• **Time:** <t:${unix}:T> (<t:${unix}:R>)`
                )
                .addFields(
                    {
                        name: '❌ Error Message',
                        value: `\`\`\`fix\n${(info.error?.message || 'Unknown Error').slice(0, 1000)}\n\`\`\``
                    },
                    {
                        name: '📜 Stack Trace',
                        value: `\`\`\`typescript\n${stack.slice(0, 1000)}\n\`\`\``
                    }
                )
                .setFooter({ text: `Enc Automated Error Diagnostics • v1.0.0` })
                .setTimestamp();

            await this.dispatchToOwners(client, embed);
        } catch (err) {
            logger.error('[ErrorReporter] Failed to dispatch command error DM:', err);
        }
    }

    /**
     * Reports an unhandled interactive component error (buttons, select menus, modals) to the owner(s) via DM.
     */
    public static async reportComponentError(client: ExtendedClient, info: ComponentErrorInfo): Promise<void> {
        try {
            const errKey = `${info.customId}:${info.error?.message || 'unknown'}`;
            if (this.isRateLimited(errKey)) return;

            const stack = this.sanitizeStack(info.error?.stack || info.error?.message || String(info.error));
            const unix = Math.floor(Date.now() / 1000);

            const embed = new EmbedBuilder()
                .setTitle(`🚨 [Enc Error Dispatcher] Component Failure`)
                .setColor(0xf97316) // Orange warning
                .setDescription(
                    `An exception occurred while processing a component interaction.\n\n` +
                    `• **Custom ID:** \`${info.customId}\`\n` +
                    `• **User:** **${info.user.tag}** (\`${info.user.id}\`)\n` +
                    `• **Guild:** ${info.guild ? `**${info.guild.name}** (\`${info.guild.id}\`)` : '`Direct Messages`'}\n` +
                    `• **Channel:** ${info.channel ? `<#${info.channel.id}> (\`${info.channel.id}\`)` : '`N/A`'}\n` +
                    `• **Time:** <t:${unix}:T> (<t:${unix}:R>)`
                )
                .addFields(
                    {
                        name: '❌ Error Message',
                        value: `\`\`\`fix\n${(info.error?.message || 'Unknown Error').slice(0, 1000)}\n\`\`\``
                    },
                    {
                        name: '📜 Stack Trace',
                        value: `\`\`\`typescript\n${stack.slice(0, 1000)}\n\`\`\``
                    }
                )
                .setFooter({ text: `Enc Automated Error Diagnostics • v1.0.0` })
                .setTimestamp();

            await this.dispatchToOwners(client, embed);
        } catch (err) {
            logger.error('[ErrorReporter] Failed to dispatch component error DM:', err);
        }
    }

    /**
     * Checks if the same error was reported in the last 60 seconds to prevent DM spam.
     */
    private static isRateLimited(key: string): boolean {
        const now = Date.now();
        const lastSent = this.errorCooldowns.get(key) || 0;
        if (now - lastSent < 60 * 1000) {
            return true;
        }
        this.errorCooldowns.set(key, now);
        return false;
    }

    /**
     * Sanitizes file paths from stack traces for clean readability.
     */
    private static sanitizeStack(stack: string): string {
        return stack.replace(/\\/g, '/');
    }

    /**
     * Dispatches the embed to all configured owner IDs.
     */
    private static async dispatchToOwners(client: ExtendedClient, embed: EmbedBuilder): Promise<void> {
        const uniqueIds = [...new Set(this.OWNER_IDS)];
        for (const ownerId of uniqueIds) {
            try {
                const owner = await client.users.fetch(ownerId).catch(() => null);
                if (owner) {
                    await owner.send({ embeds: [embed] }).catch(() => null);
                }
            } catch (err) {
                logger.error(`[ErrorReporter] Could not send error DM to owner ${ownerId}:`, err);
            }
        }
    }
}
