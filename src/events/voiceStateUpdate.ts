import { Events, VoiceState } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class VoiceStateUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.VoiceStateUpdate,
        });
    }

    public async run(oldState: VoiceState, newState: VoiceState): Promise<void> {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const changes: string[] = [];

        // Join/Leave/Move manifested
        if (!oldState.channelId && newState.channelId) {
            changes.push(`Joined: <#${newState.channelId}>`);
        } else if (oldState.channelId && !newState.channelId) {
            changes.push(`Left: <#${oldState.channelId}>`);
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            changes.push(`Moved: <#${oldState.channelId}> -> <#${newState.channelId}>`);
        }

        // Server-Side Governance
        if (oldState.serverMute !== newState.serverMute) {
            changes.push(newState.serverMute ? 'Server Muted' : 'Server Unmuted');
        }
        if (oldState.serverDeaf !== newState.serverDeaf) {
            changes.push(newState.serverDeaf ? 'Server Deafened' : 'Server Undeafened');
        }

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newState.guild, {
            type: AuditLogType.VOICE,
            event: 'Voice State Shift',
            status: newState.serverMute || newState.serverDeaf ? AuditLogStatus.MOD : AuditLogStatus.INFO,
            targetId: member.id,
            targetName: member.user.tag,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
