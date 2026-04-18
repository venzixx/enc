import { Events, GuildMember, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

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
        
        // 1. Check if bot-shield is enabled
        const guildData = await this.client.prisma.guild.findUnique({
            where: { id: guild.id },
            include: {
                extraOwners: true,
                whitelistedUsers: true
            }
        });

        if (!guildData?.antiNukeEnabled || !guildData?.antiNukeBot) return;

        // 2. Fetch the latest audit log for bot addition
        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.BotAdd,
        }).catch(() => null);

        const log = auditLogs?.entries.first();
        if (!log || !log.executorId || log.executorId === this.client.user?.id) return;

        // 3. Bypass Checks
        const isOwner = log.executorId === guild.ownerId;
        const isExtraOwner = guildData.extraOwners.some(eo => eo.userId === log.executorId);
        const isWhitelisted = guildData.whitelistedUsers.some(wu => wu.userId === log.executorId);

        if (isOwner || isExtraOwner || isWhitelisted) return;

        // 4. Rogue Bot Detected -> Kick the bot
        try {
            await member.kick('Enc Anti-Nuke: Unauthorized Bot Addition');
            
            // Log it
            if (guildData.logChannelId) {
                const logChannel = await guild.channels.fetch(guildData.logChannelId).catch(() => null) as any;
                if (logChannel) {
                    await logChannel.send({
                        content: `${this.client.emoji.exclamation} **Anti-Nuke Alert**: Unauthorized bot **${member.user.tag}** was added by <@${log.executorId}> and has been auto-kicked.`
                    });
                }
            }
        } catch (e) {
            console.error('Failed to kick rogue bot:', e);
        }
    }
}
