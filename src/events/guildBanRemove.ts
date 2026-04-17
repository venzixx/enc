import { Events, GuildBan } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildBanRemove extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildBanRemove,
        });
    }

    public async run(ban: GuildBan): Promise<void> {
        await AuditLogger.log(this.client, ban.guild, {
            type: AuditLogType.MODERATION,
            event: 'Member Unbanned',
            status: AuditLogStatus.INFO,
            targetId: ban.user.id,
            targetName: ban.user.tag,
            details: `User was restored to the server border permissions.`,
            color: this.client.color.main
        });
    }
}
