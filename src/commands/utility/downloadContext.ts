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

export default class DownloadContext extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'Download Video',
            type: ApplicationCommandType.Message,
            category: 'utility',
            cooldown: 15,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
        });
    }

    public async run(client: ExtendedClient, ctx: Context): Promise<any> {
        // Context menu commands have the target message in ctx.targetMessage
        const targetMessage = ctx.targetMessage;
        if (!targetMessage) return;

        let url = targetMessage.content.match(URL_REGEX)?.[0];
        
        // If no URL in content, check embeds
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
        const fileName = `download_${Date.now()}.mp4`;
        const filePath = path.join(tempDir, fileName);

        try {
            await ctx.editReplyV2({
                description: `🔄 **Downloading video...**\nURL: \`${url}\``,
                color: client.color.main
            });

            // Rate limit mitigation: sleep for 2s
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Cleanup URL
            if (url.includes('/shorts/')) {
                url = url.replace('/shorts/', '/watch?v=');
            }

            // Strategy: Use web_safari client WITH fresh cookies first
            const baseArgs = `--js-runtimes node --extractor-args "youtube:player_client=web_safari;player_skip=webpage,configs" --no-warnings --no-playlist --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"`;
            let command = `yt-dlp -o "${filePath}" -f "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/mp4" --max-filesize 25M ${baseArgs} --cookies "${COOKIES_PATH}" "${url}"`;

            try {
                await execAsync(command);
            } catch (err: any) {
                // If it failed, try the Android Guest bypass as fallback (no cookies)
                await ctx.editReplyV2({
                    description: '🔄 **Cookie access failed, retrying with guest bypass...**',
                    color: client.color.yellow
                });
                const guestArgs = `--js-runtimes node --extractor-args "youtube:player_client=android;player_params=igASBBABGAA%3D;player_skip=webpage,configs" --no-warnings --no-playlist`;
                command = `yt-dlp -o "${filePath}" -f "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/mp4" --max-filesize 25M ${guestArgs} "${url}"`;
                await execAsync(command);
            }

            if (!fs.existsSync(filePath)) throw new Error('Download failed: File not found');

            const stats = fs.statSync(filePath);
            if (stats.size > MAX_FILE_SIZE) {
                throw new Error('Video is too large to send (Max 25MB)');
            }

            const attachment = new AttachmentBuilder(filePath, { name: 'video.mp4' });
            
            // Seamless Transition: Follow-up with video and delete original status reply
            await ctx.followUp({
                content: '✅ **Download complete!**',
                files: [attachment]
            });
            await ctx.deleteReply();

        } catch (error: any) {
            // Special handling for large files (compression)
            if (error.message.includes('File is larger than')) {
                try {
                    await ctx.editReplyV2({
                        description: '⚖️ **Video is large, attempting to compress...**',
                        color: client.color.yellow
                    });
                    
                    const extractorArgs = `--js-runtimes node --extractor-args "youtube:player_client=web_safari;player_skip=webpage,configs" --cookies "${COOKIES_PATH}"`;
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
                    return;
                } catch (compressErr: any) {
                    error = compressErr;
                }
            }

            logger.error(`[DOWNLOAD_CONTEXT_ERROR] ${error}`);
            await ctx.editReplyV2({
                description: `❌ **Download failed:** ${error.message || 'Unknown error'}`,
                isAlert: true,
                color: client.color.red
            });
        } finally {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }
}
