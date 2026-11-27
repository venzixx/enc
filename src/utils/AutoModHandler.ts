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
    // Sliding-window action timestamps: Map<`${guildId}:${userId}:${filterType}`, number[]>
    private static actionTimestamps = new Map<string, number[]>();

    /**
     * Sliding window rate limit check (10s occurrence limit)
     */
    public static checkRateLimit(guildId: string, userId: string, filterType: string, limit: number = 3, windowMs: number = 10000): boolean {
        const key = `${guildId}:${userId}:${filterType}`;
        const now = Date.now();
        let timestamps = this.actionTimestamps.get(key) || [];

        // Filter out expired occurrences
        timestamps = timestamps.filter(t => now - t <= windowMs);
        timestamps.push(now);
        this.actionTimestamps.set(key, timestamps);

        if (timestamps.length > limit) {
            this.actionTimestamps.delete(key);
            return true;
        }
        return false;
    }

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

        // 2c. SecurityWhitelist Granular Bypass Check
        const secTargets = [message.author.id, message.channelId];
        const channel = message.channel as TextChannel;
        if (channel.parentId) secTargets.push(channel.parentId);
        if (message.member) {
            secTargets.push(...message.member.roles.cache.map(r => r.id));
        }

        const secWhitelists = await client.prisma.securityWhitelist.findMany({
            where: {
                guildId: message.guildId!,
                targetId: { in: secTargets }
            }
        });

        const grantedFeatures = new Set<string>();
        for (const sw of secWhitelists) {
            try {
                const feats: string[] = JSON.parse(sw.features);
                for (const f of feats) grantedFeatures.add(f.toLowerCase());
            } catch {}
        }

        if (grantedFeatures.has('automod')) return false;

        // 3. Fetch Active Filters
        const filters = await client.prisma.autoModFilter.findMany({
            where: { guildId: message.guild.id, enabled: true }
        });

        if (filters.length === 0) return false;

        for (const filter of filters) {
            if (filter.type === 'SPAM' && grantedFeatures.has('spam')) continue;
            if (filter.type === 'IMAGE_SPAM' && grantedFeatures.has('spam')) continue;
            if (filter.type === 'GIF_SPAM' && grantedFeatures.has('spam')) continue;
            if (filter.type === 'MENTIONS' && grantedFeatures.has('mentions')) continue;
            if ((filter.type === 'LINKS' || filter.type === 'INVITES') && grantedFeatures.has('links')) continue;

            let triggered = false;
            let violationDetails: any = null;

            switch (filter.type) {
                case 'WORDS': {
                    const result = this.checkWords(message, filter.data, filter.threshold || 1);
                    triggered = result.triggered;
                    violationDetails = { matchedWord: result.matchedWord, wordsConfig: result.config };
                    break;
                }
                case 'LINKS':
                    triggered = this.checkLinks(message, filter.data, filter.threshold || 2);
                    break;
                case 'INVITES':
                    triggered = this.checkInvites(message, filter.threshold || 1);
                    break;
                case 'SPAM':
                    triggered = this.checkSpam(message, filter.threshold || 5);
                    break;
                case 'IMAGE_SPAM':
                    triggered = this.checkImageSpam(message, filter.threshold || 3);
                    break;
                case 'GIF_SPAM':
                    triggered = this.checkGifSpam(message, filter.threshold || 3);
                    break;
                case 'MENTIONS':
                    triggered = this.checkMentions(message, filter.threshold || 5);
                    break;
            }

            if (triggered) {
                await this.handleViolation(client, message, filter, violationDetails);
                return true; 
            }
        }

        return false;
    }

    private static checkWords(message: Message, data: string | null, threshold: number = 1): { triggered: boolean; matchedWord?: string; config: AutoModWordsConfig } {
        const config = this.parseWordsConfig(data);
        if (!config.words || config.words.length === 0) return { triggered: false, config };
        const content = message.content.toLowerCase();
        const matched = config.words.find(word => word && content.includes(word.toLowerCase()));
        if (matched) {
            const breached = this.checkRateLimit(message.guildId!, message.author.id, 'WORDS', threshold, 10000);
            return { triggered: breached, matchedWord: matched, config };
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

    private static checkLinks(message: Message, customWhitelist?: string | null, threshold: number = 2): boolean {
        const content = message.content;
        const urlRegex = /https?:\/\/([^\s/]+)[^\s]*/gi;

        let safeDomains = [...this.SAFE_DOMAINS];
        if (customWhitelist) {
            try {
                const extra: string[] = JSON.parse(customWhitelist);
                safeDomains.push(...extra);
            } catch {}
        }

        let hasForbiddenLink = false;
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
            if (!isSafe) {
                hasForbiddenLink = true;
                break;
            }
        }

        if (!hasForbiddenLink) return false;
        return this.checkRateLimit(message.guildId!, message.author.id, 'LINKS', threshold, 10000);
    }

    private static checkInvites(message: Message, threshold: number = 1): boolean {
        const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+/gi;
        if (!inviteRegex.test(message.content)) return false;
        return this.checkRateLimit(message.guildId!, message.author.id, 'INVITES', threshold, 10000);
    }

    private static checkSpam(message: Message, threshold: number = 5): boolean {
        return this.checkRateLimit(message.guildId!, message.author.id, 'SPAM', threshold, 10000);
    }

    private static checkImageSpam(message: Message, threshold: number = 3): boolean {
        const hasImage = message.attachments.some(a => 
            a.contentType?.startsWith('image/') || 
            /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(a.name || '')
        ) || message.embeds.some(e => e.image || e.thumbnail);

        if (!hasImage) return false;
        return this.checkRateLimit(message.guildId!, message.author.id, 'IMAGE_SPAM', threshold, 10000);
    }

    private static checkGifSpam(message: Message, threshold: number = 3): boolean {
        const hasGif = this.isGifOrGifDomain(message.content) || 
            message.attachments.some(a => a.contentType === 'image/gif' || a.name?.toLowerCase().endsWith('.gif')) ||
            message.embeds.some(e => e.video || (e.url && this.isGifOrGifDomain(e.url)));

        if (!hasGif) return false;
        return this.checkRateLimit(message.guildId!, message.author.id, 'GIF_SPAM', threshold, 10000);
    }

    private static checkMentions(message: Message, threshold: number = 5): boolean {
        const count = message.mentions.users.size + message.mentions.roles.size;
        if (count <= 0) return false;

        const key = `${message.guildId!}:${message.author.id}:MENTIONS`;
        const now = Date.now();
        let timestamps = this.actionTimestamps.get(key) || [];
        timestamps = timestamps.filter(t => now - t <= 10000);
        for (let i = 0; i < count; i++) {
            timestamps.push(now);
        }
        this.actionTimestamps.set(key, timestamps);

        if (timestamps.length > threshold) {
            this.actionTimestamps.delete(key);
            return true;
        }
        return false;
    }

    private static async handleViolation(client: ExtendedClient, message: Message, filter: any, details?: any) {
        try {
            if (message.deletable) await message.delete().catch(() => {});

            const isWords = filter.type === 'WORDS';
            const wordsConfig: AutoModWordsConfig | undefined = details?.wordsConfig;
            const matchedWord = details?.matchedWord;

            let wasMuted = false;
            let muteDurationMinutes = 10;
            let muteReason = isWords && wordsConfig?.muteReason ? wordsConfig.muteReason : `Auto-Mod: Triggered ${filter.type} occurrence limit`;
            const action = filter.action || (isWords && wordsConfig?.autoMute ? 'MUTE' : 'DELETE');

            // Execute individual punishment
            switch (action) {
                case 'MUTE': {
                    const durationSec = isWords && wordsConfig?.muteDuration ? wordsConfig.muteDuration : 600;
                    muteDurationMinutes = Math.max(1, Math.round(durationSec / 60));
                    if (message.member?.moderatable) {
                        await message.member.timeout(durationSec * 1000, muteReason).catch(() => {});
                        wasMuted = true;
                    }
                    break;
                }
                case 'KICK': {
                    if (message.member?.kickable) {
                        await message.member.kick(`Auto-Mod: ${filter.type} limit exceeded`).catch(() => {});
                    }
                    break;
                }
                case 'BAN': {
                    if (message.member?.bannable) {
                        await message.member.ban({ reason: `Auto-Mod: ${filter.type} limit exceeded` }).catch(() => {});
                    }
                    break;
                }
                case 'STRIP_ROLES': {
                    if (message.member) {
                        const botMember = await message.guild!.members.fetch(client.user!.id);
                        const rolesToRemove = message.member.roles.cache.filter(role => 
                            role.name !== '@everyone' && 
                            role.comparePositionTo(botMember.roles.highest) < 0 &&
                            role.managed === false
                        );
                        if (rolesToRemove.size > 0) {
                            await message.member.roles.remove(rolesToRemove, `Auto-Mod: ${filter.type} limit reached`).catch(() => {});
                        }
                    }
                    break;
                }
                case 'WARN': {
                    await message.author.send(`⚠️ **AutoMod Warning:** You exceeded the **${filter.label || filter.type}** limit on **${message.guild!.name}**. Please adhere to server guidelines.`).catch(() => {});
                    break;
                }
                case 'DELETE':
                default:
                    // Deletion already occurred
                    break;
            }

            // Send Custom DM Notification if configured for WORDS
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

            // Channel Warning
            const channel = message.channel as TextChannel;
            let warningText = `${client.emoji.exclamation || '⚠️'} <@${message.author.id}>, your message was removed due to our **${filter.type}** filter.`;
            if (wasMuted) {
                warningText = `${client.emoji.cross || '🚫'} <@${message.author.id}> has been muted for **${muteDurationMinutes}m** for violating **${filter.type}**.`;
            } else if (action === 'KICK') {
                warningText = `👢 <@${message.author.id}> was kicked for violating **${filter.type}** occurrences.`;
            } else if (action === 'BAN') {
                warningText = `🔨 <@${message.author.id}> was banned for violating **${filter.type}** occurrences.`;
            } else if (action === 'STRIP_ROLES') {
                warningText = `🛡️ Roles stripped from <@${message.author.id}> for violating **${filter.type}**.`;
            }

            const warning = await channel.send(warningText).catch(() => null);
            if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);

            // Incident Audit Log
            await AuditLogger.log(client, message.guild!, {
                type: AuditLogType.AUTOMOD,
                event: `Auto-Mod Filter: ${filter.type} (${action})`,
                status: action !== 'DELETE' ? AuditLogStatus.MOD : AuditLogStatus.INFO,
                executorId: client.user?.id,
                executorTag: client.user?.tag,
                targetId: message.author.id,
                targetName: message.author.tag,
                details: `Triggered ${filter.type} rate-limit in <#${message.channelId}>.\nPunishment: ${action}${matchedWord ? `\nWord: \`${matchedWord}\`` : ''}\nContent: ${message.content.slice(0, 300)}`,
                color: action !== 'DELETE' ? client.color.red : client.color.yellow
            });
        } catch (err) {
            console.error('[AutoMod] Violation handling failed:', err);
        }
    }
}
