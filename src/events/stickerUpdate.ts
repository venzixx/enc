import { Events, Sticker } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class StickerUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildStickerUpdate,
        });
    }

    public async run(oldSticker: Sticker, newSticker: Sticker): Promise<void> {
        if (!newSticker.guild) return;

        const changes: string[] = [];
        if (oldSticker.name !== newSticker.name) changes.push(`Name: \`${oldSticker.name}\` → \`${newSticker.name}\``);
        if (oldSticker.description !== newSticker.description) changes.push(`Description: \`${oldSticker.description}\` → \`${newSticker.description}\``);

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newSticker.guild, {
            type: AuditLogType.STICKER,
            event: 'Sticker Updated',
            status: AuditLogStatus.INFO,
            targetId: newSticker.id,
            targetName: newSticker.name,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
