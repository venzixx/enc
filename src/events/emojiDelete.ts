import { Events, GuildEmoji } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class EmojiDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildEmojiDelete,
        });
    }

    public async run(emoji: GuildEmoji): Promise<void> {
        await AuditLogger.log(this.client, emoji.guild, {
            type: AuditLogType.EMOJI,
            event: 'Emoji Deleted',
            status: AuditLogStatus.INFO,
            targetId: emoji.id,
            targetName: emoji.name || 'Unknown',
            details: `Emoji: :${emoji.name}:\nID: ${emoji.id}`,
            color: this.client.color.red
        });
    }
}
