import { Events, Sticker } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class StickerCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildStickerCreate,
        });
    }

    public async run(sticker: Sticker): Promise<void> {
        if (!sticker.guild) return;

        await AuditLogger.log(this.client, sticker.guild, {
            type: AuditLogType.STICKER,
            event: 'Sticker Created',
            status: AuditLogStatus.INFO,
            targetId: sticker.id,
            targetName: sticker.name,
            details: `Name: ${sticker.name}\nDescription: ${sticker.description || 'None'}\nFormat: ${sticker.format}`,
            color: this.client.color.main
        });
    }
}
