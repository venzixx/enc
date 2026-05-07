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
            this.client.voiceSessions.set(member.id, Date.now());
        } else if (oldState.channelId && !newState.channelId) {
            changes.push(`Left: <#${oldState.channelId}>`);
            const joinTime = this.client.voiceSessions.get(member.id);
            if (joinTime) {
                const durationSeconds = Math.floor((Date.now() - joinTime) / 1000);
                this.client.voiceSessions.delete(member.id);
                if (durationSeconds > 0) {
                    const today = new Date().toISOString().split('T')[0];
                    this.client.prisma.voiceDailyActivity.upsert({
                        where: { guildId_date: { guildId: oldState.guild.id, date: today } },
                        update: { seconds: { increment: durationSeconds } },
                        create: { guildId: oldState.guild.id, date: today, seconds: durationSeconds }
                    }).catch(() => {});
                }
            }
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            changes.push(`Moved: <#${oldState.channelId}> -> <#${newState.channelId}>`);
            // Optional: Record duration so far and reset join time for the move
            const joinTime = this.client.voiceSessions.get(member.id);
            if (joinTime) {
                const durationSeconds = Math.floor((Date.now() - joinTime) / 1000);
                if (durationSeconds > 0) {
                    const today = new Date().toISOString().split('T')[0];
                    this.client.prisma.voiceDailyActivity.upsert({
                        where: { guildId_date: { guildId: newState.guild.id, date: today } },
                        update: { seconds: { increment: durationSeconds } },
                        create: { guildId: newState.guild.id, date: today, seconds: durationSeconds }
                    }).catch(() => {});
                }
            }
            this.client.voiceSessions.set(member.id, Date.now());
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
