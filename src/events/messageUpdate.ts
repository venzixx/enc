import { Events, Message, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import type { ExtendedClient } from '../client';

export default class MessageUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.MessageUpdate,
        });
    }

    public async run(oldMessage: Message, newMessage: Message): Promise<void> {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        // Capture attachments
        const attachments = newMessage.attachments.map(att => att.url);
        const attachmentText = attachments.length > 0 ? `\nAttachments:\n${attachments.map(url => `- ${url}`).join('\n')}` : '';

        await AuditLogger.log(this.client, newMessage.guild, {
            type: AuditLogType.MESSAGES,
            event: 'Message Updated',
            status: AuditLogStatus.INFO,
            executorId: newMessage.author?.id,
            executorTag: newMessage.author?.tag,
            targetId: newMessage.id,
            targetName: (newMessage.channel as any).name || 'Unknown Channel',
            details: `Old: ${oldMessage.content || '[Empty]'}\nNew: ${newMessage.content || '[Empty]'}${attachmentText}`,
            color: this.client.color.main
        });
    }
}
