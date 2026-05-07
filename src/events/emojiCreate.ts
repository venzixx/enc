import { Events, GuildEmoji } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class EmojiCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildEmojiCreate,
        });
    }

    public async run(emoji: GuildEmoji): Promise<void> {
        await AuditLogger.log(this.client, emoji.guild, {
            type: AuditLogType.EMOJI,
            event: 'Emoji Created',
            status: AuditLogStatus.INFO,
            targetId: emoji.id,
            targetName: emoji.name || 'Unknown',
            details: `Emoji: ${emoji.toString()}\nAnimated: ${emoji.animated ? 'Yes' : 'No'}\nURL: ${emoji.url}`,
            color: this.client.color.main
        });
    }
}
