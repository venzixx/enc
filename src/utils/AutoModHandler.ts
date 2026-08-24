import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../client';
import { PermitManager, PermitPermission } from './PermitManager';
import { AuditLogger, AuditLogType, AuditLogStatus } from './AuditLogger';

export interface AutoModWordsConfig {
    words: string[];
    autoMute?: boolean;
    muteDuration?: number; // in seconds, default 600 (10 mins)
    muteReason?: string;
    dmEnabled?: boolean;
    dmReason?: string;
    customEmbed?: any;
}

export class AutoModHandler {
    private static messageCache = new Map<string, { count: number, resetAt: number }>();

    public static parseWordsConfig(data: string | null | undefined): AutoModWordsConfig {
        if (!data) {
            return {
                words: [],
                autoMute: false,
                muteDuration: 600,
                muteReason: 'Auto-Mod: Triggered prohibited word filter',
                dmEnabled: false,
                dmReason: ''
            };
        }
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return {
                    words: parsed,
                    autoMute: false,
                    muteDuration: 600,
                    muteReason: 'Auto-Mod: Triggered prohibited word filter',
                    dmEnabled: false,
                    dmReason: ''
                };
            }
            return {
                words: Array.isArray(parsed.words) ? parsed.words : [],
                autoMute: Boolean(parsed.autoMute),
                muteDuration: typeof parsed.muteDuration === 'number' ? parsed.muteDuration : 600,
                muteReason: parsed.muteReason || 'Auto-Mod: Triggered prohibited word filter',
                dmEnabled: Boolean(parsed.dmEnabled || parsed.dmReason),
                dmReason: parsed.dmReason || '',
                customEmbed: parsed.customEmbed || undefined
            };
        } catch {
            return {
                words: [],
                autoMute: false,
                muteDuration: 600,
                muteReason: 'Auto-Mod: Triggered prohibited word filter',
                dmEnabled: false,
                dmReason: ''
            };
        }
    }

    /**
     * Processes a message through all active Auto-Mod filters.
     * @returns True if the message was handled (deleted/punished), False otherwise.
     */
    public static async process(client: ExtendedClient, message: Message): Promise<boolean> {
        if (!message.guild || message.author.bot) return false;

        // 1. Fetch Guild Configuration
        const guildData = await client.prisma.guild.findUnique({ where: { id: message.guildId! } });
        if (!guildData || !guildData.autoModEnabled) return false;

        // 2. Bypass Check (Owner, ExtraOwner, WhitelistedUser, Immunity, Permit Permission)
        if (message.author.id === message.guild.ownerId) return false;

        const isExtraOwner = await client.prisma.extraOwner.findUnique({
            where: { guildId_userId: { guildId: message.guildId!, userId: message.author.id } }
        });
        if (isExtraOwner) return false;

        const isWhitelistedUser = await client.prisma.whitelistedUser.findUnique({
            where: { guildId_userId: { guildId: message.guildId!, userId: message.author.id } }
        });
        if (isWhitelistedUser) return false;

        if (await PermitManager.isImmune(client, message.guildId!, message.member!)) return false;
        if (await PermitManager.hasPermission(client, message.guildId!, message.member!, PermitPermission.BYPASS_AUTOMOD)) return false;

        // 2b. AutoModWhitelist Check
        const automodWhitelists = await client.prisma.autoModWhitelist.findMany({
            where: { guildId: message.guildId! }
        });

        if (automodWhitelists.length > 0) {
            const userWhitelisted = automodWhitelists.some(w => w.type === 'USER' && w.targetId === message.author.id);
            if (userWhitelisted) return false;

            const channelWhitelisted = automodWhitelists.some(w => w.type === 'CHANNEL' && w.targetId === message.channelId);
            if (channelWhitelisted) return false;

            if (message.member) {
                const memberRoleIds = message.member.roles.cache.map(r => r.id);
                const hasWhitelistedRole = automodWhitelists.some(w => w.type === 'ROLE' && memberRoleIds.includes(w.targetId));
                if (hasWhitelistedRole) return false;
            }

            const channel = message.channel as TextChannel;
            if (channel.parentId) {
                const categoryWhitelisted = automodWhitelists.some(w => w.type === 'CATEGORY' && w.targetId === channel.parentId);
                if (categoryWhitelisted) return false;
            }
        }

        // 3. Fetch Filters
        const filters = await client.prisma.autoModFilter.findMany({
            where: { guildId: message.guild.id, enabled: true }
        });

        if (filters.length === 0) return false;

        for (const filter of filters) {
            let triggered = false;
            let violationDetails: any = null;

            switch (filter.type) {
                case 'WORDS': {
                    const result = this.checkWords(message, filter.data);
                    triggered = result.triggered;
                    violationDetails = { matchedWord: result.matchedWord, wordsConfig: result.config };
                    break;
                }
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
                await this.handleViolation(client, message, filter, violationDetails);
                return true; 
            }
        }

        return false;
    }

    private static checkWords(message: Message, data: string | null): { triggered: boolean; matchedWord?: string; config: AutoModWordsConfig } {
        const config = this.parseWordsConfig(data);
        if (!config.words || config.words.length === 0) return { triggered: false, config };
        const content = message.content.toLowerCase();
        const matched = config.words.find(word => word && content.includes(word.toLowerCase()));
        if (matched) {
            return { triggered: true, matchedWord: matched, config };
        }
        return { triggered: false, config };
    }

    private static readonly SAFE_DOMAINS = [
        // GIF / Media hosts
        'tenor.com', 'giphy.com', 'imgur.com', 'gfycat.com', 'giphy.org',
        'media.tenor.com', 'media.giphy.com', 'i.imgur.com', 'media1.tenor.com',
        'media.tenor.co', 'tenor.co', 'klipy.com', 'api.klipy.com',
        // Discord CDN
        'cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net',
        'images-ext-2.discordapp.net', 'discord.com', 'discordapp.com',
        // Social / Video
        'youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com',
        'twitter.com', 'x.com', 'reddit.com', 'www.reddit.com',
        'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
        'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
        'instagram.com', 'www.instagram.com',
        'facebook.com', 'www.facebook.com',
        'pinterest.com', 'www.pinterest.com',
        // Music
        'spotify.com', 'open.spotify.com',
        'soundcloud.com', 'snd.sc',
        'music.apple.com',
        // Dev / Code
        'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com',
        // Media / Image hosting
        'prnt.sc', 'prntscr.com', 'gyazo.com', 'lightshot.com',
        'steamuserimages-a.akamaihd.net', 'steamcommunity.com',
        'i.redd.it', 'v.redd.it', 'preview.redd.it',
    ];

    private static isGifOrGifDomain(url: string): boolean {
        const pathPart = url.split('?')[0];
        if (pathPart.toLowerCase().endsWith('.gif') || pathPart.toLowerCase().endsWith('.gifv')) {
            return true;
        }
        const gifDomains = ['tenor.com', 'giphy.com', 'klipy.com', 'gfycat.com'];
        try {
            const domain = url.replace(/https?:\/\//i, '').split('/')[0].toLowerCase().replace(/^www\./, '');
            return gifDomains.some(d => domain === d || domain.endsWith('.' + d));
        } catch {
            return false;
        }
    }

    private static checkLinks(message: Message, customWhitelist?: string | null): boolean {
        const content = message.content;
        const urlRegex = /https?:\/\/([^\s/]+)[^\s]*/gi;

        let safeDomains = [...this.SAFE_DOMAINS];
        if (customWhitelist) {
            try {
                const extra: string[] = JSON.parse(customWhitelist);
                safeDomains.push(...extra);
            } catch { /* ignore parse errors */ }
        }

        let match;
        while ((match = urlRegex.exec(content)) !== null) {
            const fullUrl = match[0];
            if (this.isGifOrGifDomain(fullUrl)) {
                continue;
            }
            const domain = match[1].toLowerCase().replace(/^www\./, '');
            const isSafe = safeDomains.some(safe => {
                const cleanSafe = safe.replace(/^www\./, '');
                return domain === cleanSafe || domain.endsWith('.' + cleanSafe);
            });
            if (!isSafe) return true;
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
            this.messageCache.set(key, { count: 1, resetAt: now + 5000 });
            return false;
        }

        data.count++;
        return data.count > threshold;
    }

    private static checkMentions(message: Message, threshold: number): boolean {
        return message.mentions.users.size > threshold || message.mentions.roles.size > threshold;
    }

    private static async handleViolation(client: ExtendedClient, message: Message, filter: any, details?: any) {
        try {
            if (message.deletable) await message.delete();

            const isWords = filter.type === 'WORDS';
            const wordsConfig: AutoModWordsConfig | undefined = details?.wordsConfig;
            const matchedWord = details?.matchedWord;

            let wasMuted = false;
            let muteDurationMinutes = 10;
            let muteReason = 'Auto-Mod: Triggered prohibited word filter';

            // 1. Process Auto-Mute if configured for WORDS
            if (isWords && wordsConfig && wordsConfig.autoMute && message.member) {
                muteDurationMinutes = Math.max(1, Math.round((wordsConfig.muteDuration || 600) / 60));
                muteReason = wordsConfig.muteReason || 'Auto-Mod: Triggered prohibited word filter';
                const durationMs = (wordsConfig.muteDuration || 600) * 1000;

                try {
                    if (message.member.moderatable) {
                        await message.member.timeout(durationMs, muteReason);
                        wasMuted = true;
                    }
                } catch (timeoutErr) {
                    console.error('[AutoMod Timeout Error]', timeoutErr);
                }
            }

            // 2. Send Custom DM Notification (with Custom Embed support) if configured
            if (isWords && wordsConfig && (wordsConfig.dmEnabled || wordsConfig.dmReason || wordsConfig.customEmbed)) {
                try {
                    const durationStr = `${muteDurationMinutes} minute${muteDurationMinutes > 1 ? 's' : ''}`;
                    const rawMsg = wordsConfig.dmReason || 'Your message in **{guild}** was removed because it contained a prohibited word.';
                    
                    const formatTemplate = (text: string) => {
                        return text
                            .replace(/{user}/gi, `<@${message.author.id}>`)
                            .replace(/{username}/gi, message.author.username)
                            .replace(/{tag}/gi, message.author.tag || message.author.username)
                            .replace(/{guild}/gi, message.guild!.name)
                            .replace(/{server}/gi, message.guild!.name)
                            .replace(/{word}/gi, matchedWord || 'prohibited word')
                            .replace(/{reason}/gi, muteReason)
                            .replace(/{duration}/gi, durationStr);
                    };

                    let embedPayload: any = null;
                    if (wordsConfig.customEmbed && typeof wordsConfig.customEmbed === 'object') {
                        embedPayload = wordsConfig.customEmbed;
                    } else if (rawMsg.trim().startsWith('{') && rawMsg.trim().endsWith('}')) {
                        try {
                            embedPayload = JSON.parse(rawMsg);
                        } catch {}
                    }

                    if (embedPayload) {
                        const dmEmbed = new EmbedBuilder();
                        if (embedPayload.title) dmEmbed.setTitle(formatTemplate(embedPayload.title));
                        if (embedPayload.description) dmEmbed.setDescription(formatTemplate(embedPayload.description));
                        if (embedPayload.color) dmEmbed.setColor(embedPayload.color);
                        else dmEmbed.setColor(client.color.yellow || 0xf59e0b);
                        
                        if (embedPayload.footer) {
                            dmEmbed.setFooter({
                                text: typeof embedPayload.footer === 'string' ? formatTemplate(embedPayload.footer) : formatTemplate(embedPayload.footer.text || ''),
                                iconURL: embedPayload.footer.iconURL || undefined
                            });
                        }
                        if (embedPayload.author) {
                            dmEmbed.setAuthor({
                                name: typeof embedPayload.author === 'string' ? formatTemplate(embedPayload.author) : formatTemplate(embedPayload.author.name || message.guild!.name),
                                iconURL: embedPayload.author.iconURL || message.guild!.iconURL() || undefined
                            });
                        } else {
                            dmEmbed.setAuthor({ name: message.guild!.name, iconURL: message.guild!.iconURL() || undefined });
                        }

                        if (Array.isArray(embedPayload.fields)) {
                            for (const f of embedPayload.fields) {
                                if (f.name && f.value) {
                                    dmEmbed.addFields({
                                        name: formatTemplate(f.name),
                                        value: formatTemplate(f.value),
                                        inline: Boolean(f.inline)
                                    });
                                }
                            }
                        }

                        if (wasMuted && (!embedPayload.fields || embedPayload.fields.length === 0)) {
                            dmEmbed.addFields(
                                { name: '⏱️ Action Taken', value: `Muted for ${durationStr}`, inline: true },
                                { name: '📄 Reason', value: muteReason, inline: true }
                            );
                        }

                        dmEmbed.setTimestamp();
                        await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
                    } else {
                        const dmEmbed = new EmbedBuilder()
                            .setAuthor({ name: message.guild!.name, iconURL: message.guild!.iconURL() || undefined })
                            .setTitle(`${client.emoji.exclamation || '⚠️'} Auto-Mod Filter Notification`)
                            .setDescription(formatTemplate(rawMsg))
                            .setColor(wasMuted ? (client.color.red || 0xef4444) : (client.color.yellow || 0xf59e0b))
                            .setTimestamp();

                        if (wasMuted) {
                            dmEmbed.addFields(
                                { name: '⏱️ Action Taken', value: `Muted for ${durationStr}`, inline: true },
                                { name: '📄 Reason', value: muteReason, inline: true }
                            );
                        }

                        await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
                    }
                } catch (dmErr) {
                    console.error('[AutoMod DM Send Error]', dmErr);
                }
            }

            // 3. Notify in channel
            const channel = message.channel as TextChannel;
            let warningText = `${client.emoji.exclamation || '⚠️'} <@${message.author.id}>, your message was removed due to our **${filter.type}** filter.`;
            if (wasMuted) {
                warningText = `${client.emoji.cross || '🚫'} <@${message.author.id}> has been muted for **${muteDurationMinutes}m** for using prohibited words.`;
            }
            const warning = await channel.send(warningText).catch(() => null);
            if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);

            // 4. Log incident in Audit Log
            await AuditLogger.log(client, message.guild!, {
                type: AuditLogType.AUTOMOD,
                event: `Auto-Mod Filter: ${filter.type}${wasMuted ? ' (Auto-Muted)' : ''}`,
                status: wasMuted ? AuditLogStatus.MOD : AuditLogStatus.INFO,
                executorId: client.user?.id,
                executorTag: client.user?.tag,
                targetId: message.author.id,
                targetName: message.author.tag,
                details: `Matched ${filter.type} filter in <#${message.channelId}>.${matchedWord ? `\nTrigger: \`${matchedWord}\`` : ''}${wasMuted ? `\nPunishment: Muted for ${muteDurationMinutes}m\nReason: ${muteReason}` : ''}\nContent: ${message.content.slice(0, 500)}`,
                color: wasMuted ? client.color.red : client.color.yellow
            });
        } catch (err) {
            console.error('[AutoMod] Violation handling failed:', err);
        }
    }
}
