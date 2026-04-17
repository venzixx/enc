import { Events, GuildBan } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildBanAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildBanAdd,
        });
    }

    public async run(ban: GuildBan): Promise<void> {
        await AuditLogger.log(this.client, ban.guild, {
            type: AuditLogType.MODERATION,
            event: 'Member Banned',
            status: AuditLogStatus.MOD,
            targetId: ban.user.id,
            targetName: ban.user.tag,
            details: `Reason: ${ban.reason || 'No Reason Provided'}`,
            color: this.client.color.red
        });
    }
}
