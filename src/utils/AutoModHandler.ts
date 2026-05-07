import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../client';
import { PermitManager, PermitPermission } from './PermitManager';
import { AuditLogger, AuditLogType, AuditLogStatus } from './AuditLogger';

export class AutoModHandler {
    private static messageCache = new Map<string, { count: number, resetAt: number }>();

    /**
     * Processes a message through all active Auto-Mod filters.
     * @returns True if the message was handled (deleted/punished), False otherwise.
     */
    public static async process(client: ExtendedClient, message: Message): Promise<boolean> {
        if (!message.guild || message.author.bot) return false;

        // 1. Fetch Guild Configuration
        const guildData = await client.prisma.guild.findUnique({ where: { id: message.guildId! } });
        if (!guildData || !guildData.autoModEnabled) return false;

        // 2. Bypass Check (Owner, Immunity, Permit Permission)
        if (await PermitManager.isImmune(client, message.guild, message.author.id)) return false;
        if (await PermitManager.hasPermission(client, message.guild, message.author.id, PermitPermission.BYPASS_AUTOMOD)) return false;

        // 3. Fetch Filters
        const filters = await client.prisma.autoModFilter.findMany({
            where: { guildId: message.guild.id, enabled: true }
        });

        if (filters.length === 0) return false;

        for (const filter of filters) {
            let triggered = false;

            switch (filter.type) {
                case 'WORDS':
                    triggered = this.checkWords(message, filter.data);
                    break;
                case 'LINKS':
                    triggered = this.checkLinks(message, filter.data);
                    break;
                case 'INVITES':
                    triggered = this.checkInvites(message);
                    break;
                case 'SPAM':
                    triggered = this.checkSpam(message, filter.threshold || 5);
                    break;
                case 'MENTIONS':
                    triggered = this.checkMentions(message, filter.threshold || 10);
                    break;
            }

            if (triggered) {
                await this.handleViolation(client, message, filter);
                return true; 
            }
        }

        return false;
    }

    private static checkWords(message: Message, data: string | null): boolean {
        if (!data) return false;
        const blacklisted: string[] = JSON.parse(data);
        const content = message.content.toLowerCase();
        return blacklisted.some(word => content.includes(word.toLowerCase()));
    }

    private static readonly SAFE_DOMAINS = [
        // GIF / Media hosts
        'tenor.com', 'giphy.com', 'imgur.com', 'gfycat.com',
        'media.tenor.com', 'media.giphy.com', 'i.imgur.com',
        // Discord CDN
        'cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net',
        'images-ext-2.discordapp.net',
        // Social / Video
        'youtube.com', 'youtu.be', 'www.youtube.com',
        'twitter.com', 'x.com', 'reddit.com', 'www.reddit.com',
        'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
        'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
        'instagram.com', 'www.instagram.com',
        'facebook.com', 'www.facebook.com',
        'pinterest.com', 'www.pinterest.com',
        // Music
        'spotify.com', 'open.spotify.com',
        'soundcloud.com',
        'music.apple.com',
        // Dev / Code
        'github.com', 'gitlab.com', 'stackoverflow.com',
        // Media / Image hosting
        'prnt.sc', 'prntscr.com', 'gyazo.com',
        'steamuserimages-a.akamaihd.net', 'steamcommunity.com',
        'i.redd.it', 'v.redd.it', 'preview.redd.it',
    ];

    private static checkLinks(message: Message, customWhitelist?: string | null): boolean {
        const content = message.content;
        const urlRegex = /https?:\/\/([^\s/]+)[^\s]*/gi;

        // Merge safe domains with any custom whitelist from filter data
        let safeDomains = [...this.SAFE_DOMAINS];
        if (customWhitelist) {
            try {
                const extra: string[] = JSON.parse(customWhitelist);
                safeDomains.push(...extra);
            } catch { /* ignore parse errors */ }
        }

        let match;
        while ((match = urlRegex.exec(content)) !== null) {
            const domain = match[1].toLowerCase().replace(/^www\./, '');
            const isSafe = safeDomains.some(safe => {
                const cleanSafe = safe.replace(/^www\./, '');
                return domain === cleanSafe || domain.endsWith('.' + cleanSafe);
            });
            if (!isSafe) return true; // Suspicious/unknown link found
        }
        return false;
    }

    private static checkInvites(message: Message): boolean {
        const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+/gi;
        return inviteRegex.test(message.content);
    }

    private static checkSpam(message: Message, threshold: number): boolean {
        const key = `${message.guildId}:${message.author.id}:spam`;
        const now = Date.now();
        const data = this.messageCache.get(key);

        if (!data || now > data.resetAt) {
            this.messageCache.set(key, { count: 1, resetAt: now + 5000 }); // 5s window
            return false;
        }

        data.count++;
        return data.count > threshold;
    }

    private static checkMentions(message: Message, threshold: number): boolean {
        return message.mentions.users.size > threshold || message.mentions.roles.size > threshold;
    }

    private static async handleViolation(client: ExtendedClient, message: Message, filter: any) {
        try {
            if (message.deletable) await message.delete();

            // Notify user
            const channel = message.channel as TextChannel;
            const warning = await channel.send(`${client.emoji.exclamation} <@${message.author.id}>, your message was removed due to our **${filter.type}** filter.`);
            setTimeout(() => warning.delete().catch(() => {}), 5000);

            // Log incident in Data Core and Discord
            await AuditLogger.log(client, message.guild!, {
                type: AuditLogType.AUTOMOD,
                event: `Auto-Mod Filter: ${filter.type}`,
                status: AuditLogStatus.INFO,
                executorId: client.user?.id,
                executorTag: client.user?.tag,
                targetId: message.author.id,
                targetName: message.author.tag,
                details: `Matched ${filter.type} filter in <#${message.channelId}>.\nContent: ${message.content.slice(0, 500)}`,
                color: client.color.yellow
            });
        } catch (err) {
            console.error('[AutoMod] Violation handling failed:', err);
        }
    }
}
