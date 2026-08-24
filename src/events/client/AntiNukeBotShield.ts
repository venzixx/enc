import { Events, GuildMember, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { AuditLogger, AuditLogType, AuditLogStatus } from "../../utils/AuditLogger";
import { isDev } from "../../utils/devCheck";

export default class AntiNukeBotShield extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberAdd,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        if (!member.user.bot) return; // Only interested in bots

        const guild = member.guild;
        
        // 1. Check if dev-antinuke is enabled for this server
        const devAntiNuke = await this.client.prisma.devAntiNuke.findUnique({
            where: { guildId: guild.id }
        });
        const isDevAntiNukeEnabled = devAntiNuke?.enabled ?? false;

        // 2. Fetch the latest audit log for bot addition
        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.BotAdd,
        }).catch(() => null);

        const log = auditLogs?.entries.first();
        if (!log || !log.executorId || log.executorId === this.client.user?.id) return;

        if (isDevAntiNukeEnabled) {
            // Under Dev AntiNuke: ONLY developers can add bots
            const isExecutorDev = await isDev(this.client, log.executorId);
            if (isExecutorDev) return;
        } else {
            // Normal AntiNuke Bot Shield
            const guildData = await this.client.prisma.guild.findUnique({
                where: { id: guild.id },
                include: {
                    extraOwners: true,
                    trustedUsers: true
                }
            });

            if (!guildData?.antiNukeEnabled || !guildData?.antiNukeBot) return;

            // Bypass Checks for normal antinuke
            const isOwner = log.executorId === guild.ownerId;
            const isExtraOwner = guildData.extraOwners.some(eo => eo.userId === log.executorId);
            const isTrusted = guildData.trustedUsers.some(tu => tu.userId === log.executorId);

            if (isOwner || isExtraOwner || isTrusted) return;
        }

        // 4. Rogue Bot Detected -> Kick the bot
        try {
            await member.kick(isDevAntiNukeEnabled ? 'Enc Dev Anti-Nuke: Unauthorized Bot Addition' : 'Enc Anti-Nuke: Unauthorized Bot Addition');
            
            // Log the security stoppage in Data Core and Discord
            await AuditLogger.log(this.client, guild, {
                type: AuditLogType.SECURITY,
                event: isDevAntiNukeEnabled ? 'Security Stoppage (Dev Bot Shield)' : 'Security Stoppage (Bot Shield)',
                status: AuditLogStatus.CRITICAL,
                executorId: this.client.user?.id,
                executorTag: this.client.user?.tag,
                targetId: log.executorId,
                targetName: member.user.tag,
                details: `Unauthorized bot addition detected. Bot **${member.user.tag}** added by <@${log.executorId}> has been neutralized.`,
                color: this.client.color.red
            });
        } catch (e) {
            console.error('Failed to kick rogue bot:', e);
        }
    }
}
