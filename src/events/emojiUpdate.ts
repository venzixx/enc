import { Events, GuildEmoji } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class EmojiUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildEmojiUpdate,
        });
    }

    public async run(oldEmoji: GuildEmoji, newEmoji: GuildEmoji): Promise<void> {
        const changes: string[] = [];
        if (oldEmoji.name !== newEmoji.name) changes.push(`Name: \`${oldEmoji.name}\` → \`${newEmoji.name}\``);

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newEmoji.guild, {
            type: AuditLogType.EMOJI,
            event: 'Emoji Updated',
            status: AuditLogStatus.INFO,
            targetId: newEmoji.id,
            targetName: newEmoji.name || 'Unknown',
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
