import { Events, GuildMember, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { AuditLogger, AuditLogType, AuditLogStatus } from "../../utils/AuditLogger";
import { AntiNukeTracker } from "../../utils/AntiNukeTracker";

export default class AntiNukeBotShield extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberAdd,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        if (!member.user.bot) return; // Only process bot additions

        const guild = member.guild;

        // 1. Fetch the latest audit log for bot addition
        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.BotAdd,
        }).catch(() => null);

        const log = auditLogs?.entries.first();
        if (!log || !log.executorId || log.executorId === this.client.user?.id) return;

        // 2. Check if executor is authorized to add bots (Owner, Extra Owner, Trusted User, Dev)
        const isAuthorized = await AntiNukeTracker.canAddBots(this.client, guild, log.executorId);
        if (isAuthorized) return;

        // 3. Check if Anti-Nuke Strict mode or standard Bot Shield is active
        const strictSettings = await AntiNukeTracker.getStrictSettings(this.client, guild.id);
        const guildData = await this.client.prisma.guild.findUnique({
            where: { id: guild.id }
        });
        const isStandardBotShield = guildData?.antiNukeEnabled && guildData?.antiNukeBot;

        if (!strictSettings.enabled && !isStandardBotShield) return;

        // In Strict Mode, check if bot addition protection is kept off
        if (strictSettings.enabled && !strictSettings.bots.enabled) {
            return;
        }

        // 4. Unauthorized Bot Detected -> Execute configured action
        try {
            const action = strictSettings.enabled ? (strictSettings.bots.action || 'KICK_BOT_AND_ALERT') : 'KICK_BOT_ONLY';

            if (action === 'ALERT_ONLY') {
                // Keep bot, only alert owners
                await AntiNukeTracker.notifyOwners(this.client, guild, {
                    title: '🚨 Anti-Nuke: Unauthorized Bot Detected (Alert Only)',
                    description: `An unauthorized bot addition was intercepted. Bot was kept per security settings.`,
                    fields: [
                        { name: '🤖 Bot', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
                        { name: '👤 Added By', value: `<@${log.executorId}> (\`${log.executor?.tag || log.executorId}\`)`, inline: true },
                        { name: '⚖️ Action Taken', value: 'Alerted Owners (Bot Kept)', inline: false }
                    ],
                    color: 0xf59e0b
                });
                return;
            }

            // Remove rogue bot
            await member.kick('Enc Anti-Nuke: Unauthorized Bot Addition').catch(() => {});

            // Apply inviter punishment if configured
            if (action === 'KICK_BOT_AND_STRIP' || action === 'STRIP_ROLES') {
                await AntiNukeTracker.applyPunishment(this.client, guild, log.executorId, 'STRIP_ROLES', 'Invited Unauthorized Bot');
            } else if (action === 'KICK_BOT_AND_BAN_INVITER' || action === 'BAN') {
                await AntiNukeTracker.applyPunishment(this.client, guild, log.executorId, 'BAN', 'Invited Unauthorized Bot');
            }

            // 5. Alert Server Owner and Extra Owners via DM and security log channel
            await AntiNukeTracker.notifyOwners(this.client, guild, {
                title: '🚨 Anti-Nuke: Unauthorized Bot Neutralized',
                description: `A rogue or unauthorized bot addition was intercepted and removed immediately.`,
                fields: [
                    { name: '🤖 Bot', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
                    { name: '👤 Added By', value: `<@${log.executorId}> (\`${log.executor?.tag || log.executorId}\`)`, inline: true },
                    { name: '🛡️ Mode', value: strictSettings.enabled ? '`STRICT ANTI-NUKE`' : '`STANDARD SHIELD`', inline: true },
                    { name: '⚖️ Action Taken', value: `\`${action}\``, inline: false }
                ],
                color: 0xef4444
            });

            // 6. Log to Data Core Audit Log
            await AuditLogger.log(this.client, guild, {
                type: AuditLogType.SECURITY,
                event: 'Security Stoppage (Bot Shield)',
                status: AuditLogStatus.CRITICAL,
                executorId: this.client.user?.id,
                executorTag: this.client.user?.tag,
                targetId: log.executorId,
                targetName: member.user.tag,
                details: `Unauthorized bot **${member.user.tag}** added by <@${log.executorId}> was handled with action: ${action}.`,
                color: this.client.color.red
            });
        } catch (e) {
            console.error('Failed to handle unauthorized bot addition:', e);
        }
    }
}
