import { PermissionFlagsBits } from 'discord.js';
import type { Context } from '../structures';
import type { ExtendedClient } from '../client';
import { isDev } from './devCheck';

const RESET_KEYWORDS = new Set(['reset', 'remove', 'clear', 'none', 'default', 'delete']);

function extractDiscordErrorMessage(errorData: any, fallback: string): string {
    if (!errorData) return fallback;

    if (errorData.errors && typeof errorData.errors === 'object') {
        const messages: string[] = [];
        const recurse = (obj: any, path: string[] = []) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj._errors)) {
                for (const err of obj._errors) {
                    if (err?.message) {
                        const field = path.length > 0 ? path[path.length - 1] : '';
                        if (err.code === 'BANNER_RATE_LIMIT' || err.code === 'AVATAR_RATE_LIMIT') {
                            messages.push(err.message);
                        } else if (field) {
                            messages.push(`${field}: ${err.message}`);
                        } else {
                            messages.push(err.message);
                        }
                    }
                }
            }
            for (const [key, val] of Object.entries(obj)) {
                if (key !== '_errors') {
                    recurse(val, [...path, key]);
                }
            }
        };
        recurse(errorData.errors);
        if (messages.length > 0) {
            return Array.from(new Set(messages)).join('\n');
        }
    }

    return errorData.message || fallback;
}

export async function handleBrandingCommand(
    client: ExtendedClient,
    ctx: Context,
    args: string[],
    type: 'avatar' | 'banner'
): Promise<any> {
    const guildId = ctx.guild?.id || ctx.interaction?.guildId;
    if (!guildId || !ctx.guild) {
        return await ctx.replyV2({
            description: 'Please run this command inside a Discord server.',
            isAlert: true,
            ephemeral: true
        });
    }

    // Permission Verification (ManageGuild, Administrator, Guild Owner, Bot Dev)
    const userIsDev = await isDev(client, ctx.author.id);
    const hasPerm =
        ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
        ctx.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        ctx.author.id === ctx.guild.ownerId ||
        userIsDev;

    if (!hasPerm) {
        return await ctx.replyV2({
            description: 'You need the **Manage Server** permission to change the bot\'s server branding.',
            isAlert: true,
            ephemeral: true
        });
    }

    const typeLabel = type === 'avatar' ? 'avatar' : 'banner';
    const cmdName = type === 'avatar' ? 'bpfp' : 'bbanner';

    // 1. Check for Reset keywords
    let isReset = false;
    const firstArg = args[0]?.toLowerCase();
    const slashUrl = ctx.isInteraction ? ctx.options?.getString?.('url') : null;

    if ((firstArg && RESET_KEYWORDS.has(firstArg)) || (slashUrl && RESET_KEYWORDS.has(slashUrl.toLowerCase()))) {
        isReset = true;
    }

    // 2. Resolve image source
    let targetUrl: string | null = null;

    if (!isReset) {
        // Slash attachment option
        const slashAttachment = ctx.isInteraction ? ctx.options?.getAttachment?.('image') : null;
        if (slashAttachment?.url) {
            targetUrl = slashAttachment.url;
        }

        // Direct URL in slash option
        if (!targetUrl && slashUrl && /^https?:\/\//i.test(slashUrl.trim())) {
            targetUrl = slashUrl.trim();
        }

        // Direct URL in args
        if (!targetUrl) {
            const urlArg = args.find(a => /^https?:\/\//i.test(a));
            if (urlArg) {
                targetUrl = urlArg.trim();
            }
        }

        // Message attachment on the command message
        if (!targetUrl && ctx.message?.attachments && ctx.message.attachments.size > 0) {
            const att = ctx.message.attachments.find(a =>
                (a.contentType && a.contentType.startsWith('image/')) ||
                /\.(png|jpe?g|gif|webp)$/i.test(a.url || a.name || '')
            ) || ctx.message.attachments.first();
            if (att?.url) {
                targetUrl = att.url;
            }
        }

        // Replied message attachment / embed
        if (!targetUrl && ctx.message?.reference?.messageId) {
            try {
                const refMsg = await ctx.channel.messages.fetch(ctx.message.reference.messageId).catch(() => null);
                if (refMsg) {
                    if (refMsg.attachments && refMsg.attachments.size > 0) {
                        const att = refMsg.attachments.find(a =>
                            (a.contentType && a.contentType.startsWith('image/')) ||
                            /\.(png|jpe?g|gif|webp)$/i.test(a.url || a.name || '')
                        ) || refMsg.attachments.first();
                        if (att?.url) targetUrl = att.url;
                    }

                    if (!targetUrl && refMsg.embeds && refMsg.embeds.length > 0) {
                        for (const embed of refMsg.embeds) {
                            if (embed.image?.url) {
                                targetUrl = embed.image.url;
                                break;
                            }
                            if (embed.thumbnail?.url) {
                                targetUrl = embed.thumbnail.url;
                                break;
                            }
                        }
                    }

                    if (!targetUrl && refMsg.content) {
                        const match = refMsg.content.match(/(https?:\/\/[^\s]+)/i);
                        if (match) {
                            targetUrl = match[1];
                        }
                    }
                }
            } catch {
                // Ignore fetch error
            }
        }
    }

    // If neither reset nor image is provided, display usage guide
    if (!isReset && !targetUrl) {
        return await ctx.replyV2({
            title: `Bot Server ${type === 'avatar' ? 'Avatar' : 'Banner'} Usage`,
            description:
                `To change the bot's ${typeLabel} for **${ctx.guild.name}**:\n` +
                `• **Upload an image**: Attach an image with \`,server ${cmdName}\` or \`,${cmdName}\`\n` +
                `• **Image link**: \`,server ${cmdName} <url>\` or \`,${cmdName} <url>\`\n` +
                `• **Reply**: Reply to an image with \`,server ${cmdName}\` or \`,${cmdName}\`\n` +
                `• **Reset**: \`,server ${cmdName} reset\` or \`,${cmdName} reset\``,
            borderless: true,
            color: null
        });
    }

    // Defer interaction immediately to prevent the 3-second Discord interaction timeout
    if (ctx.isInteraction && !ctx.deferred) {
        await ctx.deferReply();
    } else if (!ctx.isInteraction) {
        await ctx.channel?.sendTyping().catch(() => {});
    }

    // Resolve Tenor page URLs to direct GIF URLs
    if (targetUrl && /tenor\.com\/view\//i.test(targetUrl)) {
        try {
            const htmlRes = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            if (htmlRes.ok) {
                const html = await htmlRes.text();
                const gifMatch =
                    html.match(/https:\/\/media\.tenor\.com\/[a-zA-Z0-9_\-\/]+\.gif/i) ||
                    html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
                if (gifMatch) {
                    targetUrl = gifMatch[1] || gifMatch[0];
                }
            }
        } catch {
            // Proceed with original targetUrl if scrape fails
        }
    }

    let payload: any = {};

    if (isReset) {
        payload = type === 'avatar' ? { avatar: null } : { banner: null };
    } else {
        try {
            const imgRes = await fetch(targetUrl!);
            if (!imgRes.ok) {
                return await ctx.replyV2({
                    description: `Failed to download image from the provided source (HTTP ${imgRes.status}).`,
                    isAlert: true
                });
            }

            const rawContentType = (imgRes.headers.get('content-type') || '').toLowerCase();
            let mime = 'image/png';
            if (rawContentType.includes('image/gif')) mime = 'image/gif';
            else if (rawContentType.includes('image/jpeg') || rawContentType.includes('image/jpg')) mime = 'image/jpeg';
            else if (rawContentType.includes('image/webp')) mime = 'image/webp';
            else if (rawContentType.includes('image/png')) mime = 'image/png';
            else {
                const lower = targetUrl!.toLowerCase().split('?')[0];
                if (lower.endsWith('.gif')) mime = 'image/gif';
                else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
                else if (lower.endsWith('.webp')) mime = 'image/webp';
                else if (lower.endsWith('.png')) mime = 'image/png';
                else {
                    return await ctx.replyV2({
                        description: 'The provided source is not a valid image format (PNG, JPG, GIF, WEBP).',
                        isAlert: true
                    });
                }
            }

            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length > 10 * 1024 * 1024) {
                return await ctx.replyV2({
                    description: 'The provided image exceeds Discord\'s 10MB limit. Please provide a smaller image.',
                    isAlert: true
                });
            }

            const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
            payload = type === 'avatar' ? { avatar: dataUri } : { banner: dataUri };
        } catch (err: any) {
            return await ctx.replyV2({
                description: `Could not fetch or process the image: ${err?.message || 'Unknown error'}`,
                isAlert: true
            });
        }
    }

    // Call Discord API to update member @me
    const token = client.token || process.env.TOKEN || process.env.DISCORD_TOKEN;
    const discordResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!discordResponse.ok) {
        const errorData: any = await discordResponse.json().catch(() => ({}));
        if (discordResponse.status === 429) {
            const retryAfter = errorData.retry_after ? Math.ceil(errorData.retry_after) : 'a few';
            return await ctx.replyV2({
                title: 'Discord Rate Limit Active',
                description: `Discord rate limit active! Please wait **${retryAfter}s** before changing server branding again.`,
                isAlert: true
            });
        }

        const rawErrorMsg = extractDiscordErrorMessage(errorData, discordResponse.statusText);
        const isRateLimit =
            /rate limit|too fast/i.test(rawErrorMsg) ||
            (errorData.code === 50035 && /RATE_LIMIT/i.test(JSON.stringify(errorData)));

        if (isRateLimit) {
            return await ctx.replyV2({
                title: 'Discord Rate Limit Active',
                description: `Discord is rate limiting changes to the bot's server ${typeLabel}:\n> *${rawErrorMsg}*\n\nPlease wait a few minutes before trying again.`,
                isAlert: true
            });
        }

        return await ctx.replyV2({
            description: `Discord API Error: ${rawErrorMsg}`,
            isAlert: true
        });
    }

    const updatedMember: any = await discordResponse.json().catch(() => null);
    const botUserId = client.user?.id || updatedMember?.user?.id;

    if (type === 'avatar') {
        let finalAvatarUrl: string | null = null;
        if (updatedMember?.avatar) {
            const isAnimated = updatedMember.avatar.startsWith('a_');
            const ext = isAnimated ? 'gif' : 'png';
            finalAvatarUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${botUserId}/avatars/${updatedMember.avatar}.${ext}?size=1024`;
        }

        // Sync with database
        await client.prisma.guild.upsert({
            where: { id: guildId },
            update: {
                botAvatar: finalAvatarUrl,
                lastBrandingUpdate: new Date()
            },
            create: {
                id: guildId,
                botAvatar: finalAvatarUrl,
                lastBrandingUpdate: new Date()
            }
        }).catch(err => console.error('[BRANDING_DB_UPDATE_ERROR]', err));

        if (isReset) {
            return await ctx.replyV2({
                title: 'Bot Server Avatar Reset',
                description: `Successfully reset **${client.user?.username || 'the bot'}**'s server avatar for **${ctx.guild.name}**. It is now using its default global avatar.`,
                borderless: true,
                color: null
            });
        } else {
            return await ctx.replyV2({
                title: 'Bot Server Avatar Updated',
                description: `Successfully updated **${client.user?.username || 'the bot'}**'s avatar for **${ctx.guild.name}**!`,
                thumbnail: finalAvatarUrl || undefined,
                borderless: true,
                color: null
            });
        }
    } else {
        // Banner
        let finalBannerUrl: string | null = null;
        if (updatedMember?.banner) {
            const isAnimated = updatedMember.banner.startsWith('a_');
            const ext = isAnimated ? 'gif' : 'png';
            finalBannerUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${botUserId}/banners/${updatedMember.banner}.${ext}?size=1024`;
        }

        // Sync with database
        await client.prisma.guild.upsert({
            where: { id: guildId },
            update: {
                botBanner: finalBannerUrl,
                lastBrandingUpdate: new Date()
            },
            create: {
                id: guildId,
                botBanner: finalBannerUrl,
                lastBrandingUpdate: new Date()
            }
        }).catch(err => console.error('[BRANDING_DB_UPDATE_ERROR]', err));

        if (isReset) {
            return await ctx.replyV2({
                title: 'Bot Server Banner Reset',
                description: `Successfully reset **${client.user?.username || 'the bot'}**'s server banner for **${ctx.guild.name}**.`,
                borderless: true,
                color: null
            });
        } else {
            return await ctx.replyV2({
                title: 'Bot Server Banner Updated',
                description: `Successfully updated **${client.user?.username || 'the bot'}**'s banner for **${ctx.guild.name}**!`,
                image: finalBannerUrl || undefined,
                borderless: true,
                color: null
            });
        }
    }
}
