import { Events, Guild } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildUpdate,
        });
    }

    public async run(oldGuild: Guild, newGuild: Guild): Promise<void> {
        const changes: string[] = [];

        if (oldGuild.name !== newGuild.name) changes.push(`Name: \`${oldGuild.name}\` → \`${newGuild.name}\``);
        if (oldGuild.icon !== newGuild.icon) changes.push(`Server Icon ${newGuild.icon ? 'updated' : 'removed'}`);
        if (oldGuild.banner !== newGuild.banner) changes.push(`Banner ${newGuild.banner ? 'updated' : 'removed'}`);
        if (oldGuild.splash !== newGuild.splash) changes.push(`Invite Splash ${newGuild.splash ? 'updated' : 'removed'}`);
        if (oldGuild.discoverySplash !== newGuild.discoverySplash) changes.push(`Discovery Splash ${newGuild.discoverySplash ? 'updated' : 'removed'}`);
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`Verification Level: \`${oldGuild.verificationLevel}\` → \`${newGuild.verificationLevel}\``);
        if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) changes.push(`Explicit Content Filter: \`${oldGuild.explicitContentFilter}\` → \`${newGuild.explicitContentFilter}\``);
        if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) changes.push(`Default Notifications changed`);
        if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push(`AFK Channel: <#${oldGuild.afkChannelId || 'None'}> → <#${newGuild.afkChannelId || 'None'}>`);
        if (oldGuild.afkTimeout !== newGuild.afkTimeout) changes.push(`AFK Timeout: \`${oldGuild.afkTimeout}s\` → \`${newGuild.afkTimeout}s\``);
        if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push(`System Channel changed`);
        if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) changes.push(`Rules Channel changed`);
        if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) changes.push(`Public Updates Channel changed`);
        if (oldGuild.preferredLocale !== newGuild.preferredLocale) changes.push(`Locale: \`${oldGuild.preferredLocale}\` → \`${newGuild.preferredLocale}\``);
        if (oldGuild.premiumTier !== newGuild.premiumTier) changes.push(`Boost Tier: \`${oldGuild.premiumTier}\` → \`${newGuild.premiumTier}\``);
        if (oldGuild.premiumProgressBarEnabled !== newGuild.premiumProgressBarEnabled) changes.push(`Boost Progress Bar: ${newGuild.premiumProgressBarEnabled ? 'Enabled' : 'Disabled'}`);
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
            changes.push(`Vanity URL: \`${oldGuild.vanityURLCode || 'None'}\` → \`${newGuild.vanityURLCode || 'None'}\``);
            // Also log vanity separately
            await AuditLogger.log(this.client, newGuild, {
                type: AuditLogType.VANITY,
                event: 'Vanity URL Changed',
                status: AuditLogStatus.CRITICAL,
                details: `Old: \`discord.gg/${oldGuild.vanityURLCode || 'None'}\`\nNew: \`discord.gg/${newGuild.vanityURLCode || 'None'}\``,
                color: this.client.color.red
            });
        }
        if (oldGuild.description !== newGuild.description) changes.push(`Description updated`);
        if (oldGuild.nsfwLevel !== newGuild.nsfwLevel) changes.push(`NSFW Level: \`${oldGuild.nsfwLevel}\` → \`${newGuild.nsfwLevel}\``);
        if (oldGuild.mfaLevel !== newGuild.mfaLevel) changes.push(`2FA Requirement: \`${oldGuild.mfaLevel}\` → \`${newGuild.mfaLevel}\``);

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newGuild, {
            type: AuditLogType.SERVER,
            event: 'Server Settings Updated',
            status: AuditLogStatus.INFO,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
