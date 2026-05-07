import { Events, Invite } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class InviteDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.InviteDelete,
        });
    }

    public async run(invite: Invite): Promise<void> {
        if (!invite.guild) return;

        await AuditLogger.log(this.client, invite.guild, {
            type: AuditLogType.INVITES,
            event: 'Invite Deleted',
            status: AuditLogStatus.INFO,
            details: `Code: \`${invite.code}\`\nChannel: <#${invite.channelId}>`,
            color: this.client.color.red
        });
    }
}
