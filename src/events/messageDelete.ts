import { Events, Message, EmbedBuilder } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import type { ExtendedClient } from '../client';

export default class MessageDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.MessageDelete,
        });
    }

    public async run(message: Message): Promise<void> {
        if (!message.guild || message.author?.bot) return;

        // Snipe Tracker
        const { Sniper } = await import('../utils/Sniper');
        Sniper.add(message.channelId, message);

        // Capture attachments
        const attachments = message.attachments.map(att => att.url);
        const attachmentText = attachments.length > 0 ? `\nAttachments:\n${attachments.map(url => `- ${url}`).join('\n')}` : '';

        // Log to Data Core Manifest
        await AuditLogger.log(this.client, message.guild, {
            type: AuditLogType.MESSAGES,
            event: 'Message Deleted',
            status: AuditLogStatus.INFO,
            executorId: message.author?.id,
            executorTag: message.author?.tag,
            targetId: message.channelId,
            targetName: (message.channel as any).name || 'Unknown Channel',
            details: `Content: ${message.content || '[No Text/Embed Only]'}${attachmentText}\nAuthor: ${message.author?.tag} (${message.author?.id})`,
            color: this.client.color.red
        });

        const guildData = await this.client.prisma.guild.findUnique({
            where: { id: message.guildId! }
        });

        if (!guildData?.logChannelId) return;

        const logChannel = message.guild.channels.cache.get(guildData.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setTitle(`${this.client.emoji.remove_user} Message Deleted`)
                .setColor(this.client.color.red)
                .setAuthor({ name: message.author?.tag || 'Unknown User', iconURL: message.author?.displayAvatarURL() })
                .addFields(
                    { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                    { name: 'Content', value: message.content || '[No Text/Embed Only]', inline: false }
                )
                .setFooter({ text: `User ID: ${message.author?.id}` })
                .setTimestamp();

            if (attachments.length > 0) {
                embed.addFields({ name: 'Attachments', value: attachments.map((url, index) => `[Attachment ${index + 1}](${url})`).join('\n'), inline: false });
                
                // If there's an image attachment, set it as the embed image
                const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
                const firstImg = attachments.find(url => {
                    const lowercaseUrl = url.toLowerCase().split('?')[0];
                    return imageExtensions.some(ext => lowercaseUrl.endsWith(ext));
                });
                if (firstImg) {
                    embed.setImage(firstImg);
                }
            }

            await (logChannel as any).send({ embeds: [embed] });
        }
    }
}
