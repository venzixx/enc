import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { ApplicationCommandOptionType, AttachmentBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const COOKIES_PATH = path.join(process.cwd(), 'cookies.txt');
const WEBSHARE_PROXIES = [
    'http://ojyucbla-rotate:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-1:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-2:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-3:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-4:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-5:xbtyg7cy0tzm@p.webshare.io:80/'
];

export default class Download extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'download',
            aliases: ['dl', 'ytdl', 'ttdl', 'igdl', 'tiktok', 'reel', 'shorts', 'video'],
            description: {
                content: 'Download videos from YouTube, TikTok, Instagram, Twitter, etc. (supports replying to links)',
                usage: 'download [url]',
                examples: ['download https://youtube.com/watch?v=...', 'download (as reply to a link)']
            },
            category: 'utility',
            cooldown: 10,
            slashCommand: true,
            options: [
                {
                    name: 'url',
                    description: 'The URL of the video to download',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ],
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
        });
    }

    private async extractUrl(ctx: Context, args: string[]): Promise<string | null> {
        const URL_REGEX = /https?:\/\/[^\s<>]+/i;

        // 1. Slash command argument
        if (ctx.interaction) {
            const slashUrl = ctx.options?.getString('url');
            if (slashUrl) {
                const match = slashUrl.match(URL_REGEX);
                return match ? match[0] : slashUrl.trim();
            }
        }

        // 2. Direct command arguments
        if (args && args.length > 0) {
            const joined = args.join(' ');
            const match = joined.match(URL_REGEX);
            if (match) return match[0];
        }

        // 3. Replied / Referenced message
        const msg = ctx.message;
        if (msg && msg.reference && msg.reference.messageId) {
            try {
                const refMsg = await ctx.channel?.messages.fetch(msg.reference.messageId);
                if (refMsg) {
                    // Check text content
                    if (refMsg.content) {
                        const match = refMsg.content.match(URL_REGEX);
                        if (match) return match[0];
                    }

                    // Check embeds
                    if (refMsg.embeds && refMsg.embeds.length > 0) {
                        for (const embed of refMsg.embeds) {
                            if (embed.url && URL_REGEX.test(embed.url)) return embed.url;
                            if (embed.video && embed.video.url && URL_REGEX.test(embed.video.url)) return embed.video.url;
                            if (embed.description) {
                                const descMatch = embed.description.match(URL_REGEX);
                                if (descMatch) return descMatch[0];
                            }
                        }
                    }

                    // Check attachments (e.g. video file attached)
                    if (refMsg.attachments && refMsg.attachments.size > 0) {
                        const attachment = refMsg.attachments.first();
                        if (attachment && attachment.url) return attachment.url;
                    }
                }
            } catch (e: any) {
                console.error(`[DOWNLOAD_REPLY_FETCH_ERROR] ${e.message}`);
            }
        }

        // 4. Attachments on the command message itself
        if (msg && msg.attachments && msg.attachments.size > 0) {
            const attachment = msg.attachments.first();
            if (attachment && attachment.url) return attachment.url;
        }

        return null;
    }

    private async downloadTikTok(url: string, tmpFile: string): Promise<{ files: string[]; type: 'video' | 'slides' } | null> {
        try {
            console.log(`[DOWNLOAD_TIKTOK] Fetching via TikWM API for: ${url}`);
            const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.code === 0 && data.data) {
                const d = data.data;

                // 1. Photo Slideshow post
                if (d.images && Array.isArray(d.images) && d.images.length > 0) {
                    const files: string[] = [];
                    const maxImages = Math.min(d.images.length, 9); // Discord allows max 10 attachments per message
                    for (let i = 0; i < maxImages; i++) {
                        const imgRes = await fetch(d.images[i]);
                        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                        const imgPath = `${tmpFile}_slide_${i + 1}.jpg`;
                        fs.writeFileSync(imgPath, imgBuf);
                        files.push(imgPath);
                    }
                    if (d.play) {
                        try {
                            const audioRes = await fetch(d.play);
                            const audioBuf = Buffer.from(await audioRes.arrayBuffer());
                            const audioPath = `${tmpFile}_audio.mp3`;
                            fs.writeFileSync(audioPath, audioBuf);
                            files.push(audioPath);
                        } catch {
                            // audio optional
                        }
                    }
                    return { files, type: 'slides' };
                }

                // 2. Video post
                if (d.play) {
                    const videoRes = await fetch(d.play);
                    const buffer = Buffer.from(await videoRes.arrayBuffer());
                    const filePath = `${tmpFile}.mp4`;
                    fs.writeFileSync(filePath, buffer);
                    return { files: [filePath], type: 'video' };
                }
            }
        } catch (e: any) {
            console.error(`[DOWNLOAD_TIKTOK_ERROR] TikWM error: ${e.message}`);
        }
        return null;
    }

    private async downloadInstagram(url: string, tmpFile: string): Promise<{ files: string[]; type: 'video' | 'slides' } | null> {
        try {
            console.log(`[DOWNLOAD_INSTAGRAM] Fetching via ig_downloader helper for: ${url}`);
            // Check possible script paths
            const candidatePaths = [
                path.join(process.cwd(), 'src', 'utils', 'ig_downloader.py'),
                path.join(process.cwd(), 'dist', 'utils', 'ig_downloader.py'),
                path.join(__dirname, '..', '..', 'utils', 'ig_downloader.py'),
                path.join(__dirname, 'ig_downloader.py'),
                '/home/ubuntu/Dimscord/src/utils/ig_downloader.py'
            ];
            const scriptPath = candidatePaths.find(p => fs.existsSync(p));
            if (!scriptPath) {
                console.error(`[DOWNLOAD_INSTAGRAM_ERROR] ig_downloader.py not found in candidate paths.`);
                return null;
            }

            const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
            const cmd = `${pyCmd} "${scriptPath}" "${url}"`;
            const { stdout } = await execAsync(cmd, { timeout: 45000 });
            const data = JSON.parse(stdout.trim());

            if (data.success && Array.isArray(data.media) && data.media.length > 0) {
                const files: string[] = [];
                const maxItems = Math.min(data.media.length, 10);
                for (let i = 0; i < maxItems; i++) {
                    const item = data.media[i];
                    if (!item.url) continue;
                    const res = await fetch(item.url);
                    if (!res.ok) continue;
                    const buffer = Buffer.from(await res.arrayBuffer());
                    const ext = item.type === 'video' ? 'mp4' : 'jpg';
                    const filePath = `${tmpFile}_ig_${i + 1}.${ext}`;
                    fs.writeFileSync(filePath, buffer);
                    files.push(filePath);
                }

                if (files.length > 0) {
                    return {
                        files,
                        type: data.type === 'slides' ? 'slides' : 'video'
                    };
                }
            }
        } catch (e: any) {
            console.error(`[DOWNLOAD_INSTAGRAM_ERROR] ${e.message}`);
        }
        return null;
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let url = await this.extractUrl(ctx, args);
        if (!url) {
            return await ctx.replyV2({
                description: '❌ Please provide a valid URL or reply to a message containing a link!\n**Usage:** `,download <url>` or reply with `,download`',
                isAlert: true,
                color: client.color.red,
            });
        }

        await ctx.deferReply();

        const tmpFile = path.join(os.tmpdir(), `download_${Date.now()}`);

        try {
            await ctx.editReplyV2({
                description: `${client.emoji.loading_spinner} **Preparing download...**\nURL: \`${url}\``,
                color: client.color.main
            });

            // Special handler for TikTok URLs
            const isTikTok = url.includes('tiktok.com');
            if (isTikTok) {
                const result = await this.downloadTikTok(url, tmpFile);
                if (result && result.files.length > 0) {
                    const attachments = result.files.map(filePath => {
                        const baseName = path.basename(filePath);
                        return new AttachmentBuilder(filePath, { name: baseName });
                    });

                    const titleText = result.type === 'slides'
                        ? '✅ **TikTok Photo Slide downloaded!**'
                        : '✅ **Download complete!**';

                    await ctx.followUp({
                        content: titleText,
                        files: attachments
                    });
                    await ctx.deleteReply();
                    for (const f of result.files) {
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    }
                    return;
                }
            }

            // Special handler for Instagram URLs (Posts, Carousels, Photos, Reels)
            const isInstagram = url.includes('instagram.com') || url.includes('instagr.am');
            if (isInstagram) {
                const igResult = await this.downloadInstagram(url, tmpFile);
                if (igResult && igResult.files.length > 0) {
                    const attachments = igResult.files.map(filePath => {
                        const baseName = path.basename(filePath);
                        return new AttachmentBuilder(filePath, { name: baseName });
                    });

                    const titleText = igResult.type === 'slides'
                        ? '✅ **Instagram Carousel / Photos downloaded!**'
                        : '✅ **Instagram Media downloaded!**';

                    await ctx.followUp({
                        content: titleText,
                        files: attachments
                    });
                    await ctx.deleteReply();
                    for (const f of igResult.files) {
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    }
                    return;
                }
            }

            // Clean up YouTube Shorts URL to avoid duplicate query parameters
            if (url.includes('/shorts/')) {
                const parts = url.split('/shorts/')[1];
                const videoId = parts?.split('?')[0]?.split('&')[0];
                if (videoId) url = `https://www.youtube.com/watch?v=${videoId}`;
            }

            const ytDlpPath = fs.existsSync('/usr/local/bin/yt-dlp') ? '/usr/local/bin/yt-dlp' : 'yt-dlp';
            const cookiesArg = fs.existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';

            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            let success = false;

            if (isYouTube) {
                for (const proxy of WEBSHARE_PROXIES) {
                    try {
                        console.log(`[DOWNLOAD] Trying YouTube with proxy ${proxy.split('@')[0]}...`);
                        const proxyCmd = [
                            ytDlpPath,
                            '--proxy', `"${proxy}"`,
                            '-o', `"${tmpFile}.%(ext)s"`,
                            '-f', '"bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best/b"',
                            '--max-filesize', '25M',
                            '--js-runtimes', 'node',
                            '--no-warnings',
                            '--no-playlist',
                            cookiesArg,
                            `"${url}"`
                        ].filter(Boolean).join(' ');

                        await execAsync(proxyCmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
                        success = true;
                        break;
                    } catch (err: any) {
                        console.log(`[DOWNLOAD] Proxy attempt failed, trying next proxy...`);
                    }
                }
            }

            if (!success) {
                const downloadCmd = [
                    ytDlpPath,
                    '-o', `"${tmpFile}.%(ext)s"`,
                    '-f', '"bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best/b"',
                    '--max-filesize', '25M',
                    '--js-runtimes', 'node',
                    '--no-warnings',
                    '--no-playlist',
                    cookiesArg,
                    `"${url}"`
                ].filter(Boolean).join(' ');

                try {
                    console.log(`[DOWNLOAD] Running standard: ${downloadCmd}`);
                    await execAsync(downloadCmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
                } catch (err: any) {
                    console.log(`[DOWNLOAD] Standard attempt failed, retrying fallback...`);
                    const guestCmd = [
                        ytDlpPath,
                        '-o', `"${tmpFile}.%(ext)s"`,
                        '-f', '"b/bv+ba/best"',
                        '--max-filesize', '25M',
                        '--js-runtimes', 'node',
                        '--no-warnings',
                        '--no-playlist',
                        cookiesArg,
                        `"${url}"`
                    ].filter(Boolean).join(' ');
                    await execAsync(guestCmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
                }
            }

            const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(path.basename(tmpFile)));
            const downloadedFile = files.length > 0 ? path.join(os.tmpdir(), files[0]) : null;

            if (!downloadedFile || !fs.existsSync(downloadedFile)) {
                // Secondary check: If it was Instagram, try Instagram fallback
                if (isInstagram) {
                    const fallbackIg = await this.downloadInstagram(url, tmpFile);
                    if (fallbackIg && fallbackIg.files.length > 0) {
                        const attachments = fallbackIg.files.map(filePath => {
                            const baseName = path.basename(filePath);
                            return new AttachmentBuilder(filePath, { name: baseName });
                        });
                        await ctx.followUp({
                            content: '✅ **Instagram Media downloaded!**',
                            files: attachments
                        });
                        await ctx.deleteReply();
                        for (const f of fallbackIg.files) {
                            if (fs.existsSync(f)) fs.unlinkSync(f);
                        }
                        return;
                    }
                }
                throw new Error('Download failed: File not found after execution.');
            }

            const fileName = path.basename(downloadedFile);
            const attachment = new AttachmentBuilder(downloadedFile, { name: fileName });
            
            await ctx.followUp({
                content: '✅ **Download complete!**',
                files: [attachment]
            });
            
            await ctx.deleteReply();

            if (fs.existsSync(downloadedFile)) fs.unlinkSync(downloadedFile);

        } catch (error: any) {
            console.error(`[DOWNLOAD_ERROR] ${error}`);

            // If error was "No video formats found" on Instagram, try Instagram photo/carousel extractor
            if (url.includes('instagram.com') || url.includes('instagr.am')) {
                try {
                    const igRescue = await this.downloadInstagram(url, tmpFile);
                    if (igRescue && igRescue.files.length > 0) {
                        const attachments = igRescue.files.map(filePath => {
                            const baseName = path.basename(filePath);
                            return new AttachmentBuilder(filePath, { name: baseName });
                        });
                        await ctx.followUp({
                            content: igRescue.type === 'slides' ? '✅ **Instagram Carousel / Photos downloaded!**' : '✅ **Instagram Media downloaded!**',
                            files: attachments
                        });
                        await ctx.deleteReply();
                        for (const f of igRescue.files) {
                            if (fs.existsSync(f)) fs.unlinkSync(f);
                        }
                        return;
                    }
                } catch {}
            }
            
            if (error.message && error.message.includes('File is larger than')) {
                try {
                    await ctx.editReplyV2({
                        description: '⚖️ **Video is large, attempting to compress...**',
                        color: client.color.yellow
                    });
                    
                    const filePath = `${tmpFile}.mp4`;
                    const ytDlpPath = fs.existsSync('/usr/local/bin/yt-dlp') ? '/usr/local/bin/yt-dlp' : 'yt-dlp';
                    const cookiesArg = fs.existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';
                    const proxyArg = `--proxy "${WEBSHARE_PROXIES[0]}"`;
                    const compressCmd = `${ytDlpPath} --js-runtimes node ${proxyArg} -o "${filePath}" -f "bv+ba/b" ${cookiesArg} "${url}" && ffmpeg -i "${filePath}" -vcodec libx264 -crf 28 -acodec aac -b:a 128k -y "${filePath}_compressed.mp4"`;
                    
                    await execAsync(compressCmd);
                    
                    const finalPath = fs.existsSync(`${filePath}_compressed.mp4`) ? `${filePath}_compressed.mp4` : filePath;
                    const attachment = new AttachmentBuilder(finalPath, { name: 'video.mp4' });
                    
                    await ctx.followUp({
                        content: '✅ **Compressed and downloaded!**',
                        files: [attachment]
                    });
                    await ctx.deleteReply();
                    
                    if (fs.existsSync(`${filePath}_compressed.mp4`)) fs.unlinkSync(`${filePath}_compressed.mp4`);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    return;
                } catch (compressErr: any) {
                    error = compressErr;
                }
            }

            let failReason = error.message || 'Unknown error';
            if (failReason.includes('empty media response') || failReason.includes('Check if this post is accessible in your browser without being logged-in')) {
                failReason = 'This Instagram post/reel cannot be accessed without being logged in (it may be age-restricted, private, or restricted by Instagram).';
            } else if (failReason.includes('Sign in to confirm')) {
                failReason = 'YouTube is requiring bot confirmation for this video on the server IP.';
            } else if (failReason.includes('Private video') || failReason.includes('This video is private')) {
                failReason = 'This video is private and cannot be downloaded.';
            } else if (failReason.includes('No video formats found')) {
                failReason = 'No video formats found (the post may be private, age-restricted, or removed).';
            } else if (failReason.includes('Video is too large') || failReason.includes('File is larger than')) {
                failReason = 'The downloaded video exceeds the maximum file size limit (25MB).';
            } else if (failReason.includes('Command failed:')) {
                const errorLine = failReason.split('\n').find((l: string) => l.startsWith('ERROR:'));
                if (errorLine) {
                    let clean = errorLine.replace(/^ERROR:\s*/, '').split('; please report this issue')[0].split('. Confirm you are on the latest version')[0].trim();
                    failReason = clean;
                } else {
                    failReason = 'Media download failed or source is inaccessible.';
                }
            }

            await ctx.editReplyV2({
                description: `❌ **Download failed:** ${failReason}`,
                isAlert: true,
                color: client.color.red,
            });

            // Cleanup partial files
            const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(path.basename(tmpFile)));
            for (const file of files) {
                try { fs.unlinkSync(path.join(os.tmpdir(), file)); } catch {}
            }
        }
    }
}
