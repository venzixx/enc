import { Events, Sticker } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class StickerDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildStickerDelete,
        });
    }

    public async run(sticker: Sticker): Promise<void> {
        if (!sticker.guild) return;

        await AuditLogger.log(this.client, sticker.guild, {
            type: AuditLogType.STICKER,
            event: 'Sticker Deleted',
            status: AuditLogStatus.INFO,
            targetId: sticker.id,
            targetName: sticker.name,
            details: `Name: ${sticker.name}\nID: ${sticker.id}`,
            color: this.client.color.red
        });
    }
}
