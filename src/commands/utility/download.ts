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

export default class Download extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'download',
            description: 'Download a video from YouTube or other sites',
            category: 'utility',
            cooldown: 15,
            slashCommand: true,
            options: [
                {
                    name: 'url',
                    description: 'The URL of the video to download',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let url = ctx.interaction?.options.getString('url') || args[0];
        if (!url) {
            return await ctx.replyV2({
                description: '❌ Please provide a valid URL!',
                isAlert: true,
                color: client.color.red,
            });
        }

        await ctx.deferReply();

        const tmpFile = path.join(os.tmpdir(), `download_${Date.now()}`);

        try {
            await ctx.editReplyV2({
                description: `🔄 **Preparing download...**\nURL: \`${url}\``,
                color: client.color.main
            });

            // Rate limit mitigation
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Cleanup URL
            if (url.includes('/shorts/')) {
                url = url.replace('/shorts/', '/watch?v=');
            }

            // Strategy: Use web_safari client WITH fresh cookies first
            const baseArgs = `--js-runtimes node --extractor-args "youtube:player_client=web_safari;player_skip=webpage,configs" --no-warnings --no-playlist --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"`;
            const downloadCmd = [
                'yt-dlp',
                '-o', `"${tmpFile}.%(ext)s"`,
                '-f', '"bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"',
                '--max-filesize', '25M',
                ...baseArgs.split(' '),
                '--cookies', `"${COOKIES_PATH}"`,
                `"${url}"`
            ];

            try {
                console.log(`[DOWNLOAD] Running: ${downloadCmd.join(' ')}`);
                await execAsync(downloadCmd.join(' '), { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
            } catch (err: any) {
                console.log(`[DOWNLOAD] Cookie attempt failed, retrying with Android Guest bypass...`);
                const fallbackArgs = `--js-runtimes node --extractor-args "youtube:player_client=android;player_params=igASBBABGAA%3D;player_skip=webpage,configs" --no-warnings --no-playlist`;
                const guestCmd = [
                    'yt-dlp',
                    '-o', `"${tmpFile}.%(ext)s"`,
                    '-f', '"bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"',
                    '--max-filesize', '25M',
                    ...fallbackArgs.split(' '),
                    `"${url}"`
                ];
                await execAsync(guestCmd.join(' '), { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
            }

            const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(path.basename(tmpFile)));
            const downloadedFile = files.length > 0 ? path.join(os.tmpdir(), files[0]) : null;

            if (!downloadedFile || !fs.existsSync(downloadedFile)) {
                throw new Error('Download failed: File not found after yt-dlp execution.');
            }

            const attachment = new AttachmentBuilder(downloadedFile, { name: 'video.mp4' });
            
            // SEAMLESS TRANSITION STRATEGY:
            // 1. Follow up with the video (guaranteed visible in V2)
            // 2. Instantly delete the original "Downloading" status reply
            await ctx.followUp({
                content: '✅ **Download complete!**',
                files: [attachment]
            });
            
            await ctx.deleteReply();

            if (fs.existsSync(downloadedFile)) fs.unlinkSync(downloadedFile);

        } catch (error: any) {
            console.error(`[DOWNLOAD_ERROR] ${error}`);
            
            if (error.message.includes('File is larger than')) {
                try {
                    await ctx.editReplyV2({
                        description: '⚖️ **Video is large, attempting to compress...**',
                        color: client.color.yellow
                    });
                    
                    const extractorArgs = `--js-runtimes node --extractor-args "youtube:player_client=web_safari;player_skip=webpage,configs" --cookies "${COOKIES_PATH}"`;
                    const filePath = `${tmpFile}.mp4`;
                    const compressCmd = `yt-dlp -o "${filePath}" -f "bv+ba/b" ${extractorArgs} "${url}" && ffmpeg -i "${filePath}" -vcodec libx264 -crf 28 -acodec aac -b:a 128k -y "${filePath}_compressed.mp4"`;
                    
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

            await ctx.editReplyV2({
                description: `❌ **Download failed:** ${error.message || 'Unknown error'}`,
                isAlert: true,
                color: client.color.red,
            });

            // Cleanup any partial files
            const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(path.basename(tmpFile)));
            for (const file of files) {
                try { fs.unlinkSync(path.join(os.tmpdir(), file)); } catch {}
            }
        }
    }
}
