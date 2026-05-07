import { Events, Invite } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class InviteCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.InviteCreate,
        });
    }

    public async run(invite: Invite): Promise<void> {
        if (!invite.guild) return;

        await AuditLogger.log(this.client, invite.guild as any, {
            type: AuditLogType.INVITES,
            event: 'Invite Created',
            status: AuditLogStatus.INFO,
            executorId: invite.inviter?.id,
            executorTag: invite.inviter?.tag,
            details: `Code: \`${invite.code}\`\nChannel: <#${invite.channelId}>\nMax Uses: ${invite.maxUses || 'Unlimited'}\nExpires: ${invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Never'}`,
            color: this.client.color.main
        });
    }
}
