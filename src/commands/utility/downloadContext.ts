import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { ApplicationCommandType, AttachmentBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import logger from '../../structures/Logger';

const execAsync = promisify(exec);
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const COOKIES_PATH = path.join(process.cwd(), 'cookies.txt');
const URL_REGEX = /https?:\/\/[^\s<>]+/i;
const WEBSHARE_PROXIES = [
    'http://ojyucbla-rotate:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-1:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-2:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-3:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-4:xbtyg7cy0tzm@p.webshare.io:80/',
    'http://ojyucbla-5:xbtyg7cy0tzm@p.webshare.io:80/'
];

export default class DownloadContext extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'Download Video',
            type: ApplicationCommandType.Message,
            category: 'utility',
            cooldown: 10,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
        });
    }

    private async downloadTikTok(url: string, tmpFile: string): Promise<{ files: string[]; type: 'video' | 'slides' } | null> {
        try {
            console.log(`[DOWNLOAD_CONTEXT_TIKTOK] Fetching via TikWM API for: ${url}`);
            const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.code === 0 && data.data) {
                const d = data.data;

                // 1. Photo Slideshow post
                if (d.images && Array.isArray(d.images) && d.images.length > 0) {
                    const files: string[] = [];
                    const maxImages = Math.min(d.images.length, 9);
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
            console.error(`[DOWNLOAD_CONTEXT_TIKTOK_ERROR] TikWM error: ${e.message}`);
        }
        return null;
    }

    private async downloadInstagram(url: string, tmpFile: string): Promise<{ files: string[]; type: 'video' | 'slides' } | null> {
        try {
            const candidatePaths = [
                path.join(process.cwd(), 'src', 'utils', 'ig_downloader.py'),
                path.join(process.cwd(), 'dist', 'utils', 'ig_downloader.py'),
                path.join(__dirname, '..', '..', 'utils', 'ig_downloader.py'),
                path.join(__dirname, 'ig_downloader.py'),
                '/home/ubuntu/Dimscord/src/utils/ig_downloader.py'
            ];
            const scriptPath = candidatePaths.find(p => fs.existsSync(p));
            if (!scriptPath) return null;

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
            logger.error(`[DOWNLOAD_CONTEXT_INSTAGRAM_ERROR] ${e.message}`);
        }
        return null;
    }

    public async run(client: ExtendedClient, ctx: Context): Promise<any> {
        const targetMessage = ctx.targetMessage;
        if (!targetMessage) return;

        let url = targetMessage.content.match(URL_REGEX)?.[0];
        
        if (!url && targetMessage.embeds.length > 0) {
            for (const embed of targetMessage.embeds) {
                if (embed.url) {
                    url = embed.url;
                    break;
                }
                if (embed.description) {
                    const match = embed.description.match(URL_REGEX);
                    if (match) {
                        url = match[0];
                        break;
                    }
                }
            }
        }

        if (!url) {
            return await ctx.replyV2({
                description: '❌ No URL found in that message!',
                isAlert: true,
                color: client.color.red,
                ephemeral: true
            });
        }

        await ctx.deferReply();

        const tempDir = os.tmpdir();
        const tmpFile = path.join(tempDir, `download_${Date.now()}`);

        try {
            await ctx.editReplyV2({
                description: `🔄 **Downloading video...**\nURL: \`${url}\``,
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

            // Special handler for Instagram URLs
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
                        const command = `${ytDlpPath} --proxy "${proxy}" -o "${tmpFile}.%(ext)s" -f "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best/b" --max-filesize 25M --js-runtimes node --no-warnings --no-playlist ${cookiesArg} "${url}"`;
                        await execAsync(command);
                        success = true;
                        break;
                    } catch (err: any) {
                        logger.warn(`[DOWNLOAD_CONTEXT] Proxy failed, trying next...`);
                    }
                }
            }

            if (!success) {
                let command = `${ytDlpPath} -o "${tmpFile}.%(ext)s" -f "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best/b" --max-filesize 25M --js-runtimes node --no-warnings --no-playlist ${cookiesArg} "${url}"`;
                try {
                    await execAsync(command);
                } catch (err: any) {
                    await ctx.editReplyV2({
                        description: '🔄 **Retrying download with fallback flags...**',
                        color: client.color.yellow
                    });
                    command = `${ytDlpPath} -o "${tmpFile}.%(ext)s" -f "b/bv+ba/best" --max-filesize 25M --js-runtimes node --no-warnings --no-playlist ${cookiesArg} "${url}"`;
                    await execAsync(command);
                }
            }

            const files = fs.readdirSync(tempDir).filter(f => f.startsWith(path.basename(tmpFile)));
            const filePath = files.length > 0 ? path.join(tempDir, files[0]) : null;

            if (!filePath || !fs.existsSync(filePath)) {
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
                throw new Error('Download failed: File not found');
            }

            const stats = fs.statSync(filePath);
            if (stats.size > MAX_FILE_SIZE) {
                throw new Error('Video is too large to send (Max 25MB)');
            }

            const fileName = path.basename(filePath);
            const attachment = new AttachmentBuilder(filePath, { name: fileName });
            
            await ctx.followUp({
                content: '✅ **Download complete!**',
                files: [attachment]
            });
            await ctx.deleteReply();

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        } catch (error: any) {
            // Instagram rescue if error
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

            logger.error(`[DOWNLOAD_CONTEXT_ERROR] ${error}`);
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
                color: client.color.red
            });

            const files = fs.readdirSync(tempDir).filter(f => f.startsWith(path.basename(tmpFile)));
            for (const file of files) {
                try { fs.unlinkSync(path.join(tempDir, file)); } catch {}
            }
        }
    }
}
