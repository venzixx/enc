import { EmbedBuilder, TextChannel, Guild, User } from 'discord.js';
import { ExtendedClient } from '../client';

export async function logModerationAction(
    client: ExtendedClient,
    guild: Guild,
    action: string,
    moderator: User,
    target: User,
    reason: string,
    duration?: string
) {
    const guildData = await client.prisma.guild.findUnique({
        where: { id: guild.id }
    });

    if (!guildData?.logChannelId) return;

    const channel = guild.channels.cache.get(guildData.logChannelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${moderator.tag} (${moderator.id})`, iconURL: moderator.displayAvatarURL() })
        .setTitle(`${client.emoji.shield} Moderation Action: ${action}`)
        .setColor(client.color.main)
        .addFields(
            { name: `${client.emoji.user} Target`, value: `${target.tag} (\`${target.id}\`)`, inline: true },
            { name: `${client.emoji.shield} Moderator`, value: `${moderator.tag} (\`${moderator.id}\`)`, inline: true }
        )
        .setTimestamp();

    if (duration) embed.addFields({ name: `${client.emoji.clock} Duration`, value: duration, inline: true });
    embed.addFields({ name: `${client.emoji.mic} Reason`, value: reason });

    try {
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Failed to send mod log:', error);
    }
}
