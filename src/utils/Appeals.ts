import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    User, 
    Guild 
} from "discord.js";
import { ExtendedClient } from "../client";
import crypto from "crypto";

export class Appeals {
    public static async sendAppealDM(
        client: ExtendedClient, 
        user: User, 
        guild: Guild, 
        type: "BAN" | "KICK" | "MUTE", 
        reason: string,
        inviteUrl?: string | null
    ): Promise<boolean> {
        try {
            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.shield} Sanction Notification: ${guild.name}`)
                .setDescription(`You have been **${type.toLowerCase()}ed** from **${guild.name}**.`)
                .addFields(
                    { name: `${client.emoji.info} Type`, value: type, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason || "No reason provided", inline: true }
                )
                .setColor(client.color.red)
                .setFooter({ text: inviteUrl ? "A rejoin invite link has been attached below." : "You can appeal this sanction by clicking the button below." })
                .setTimestamp();

            if (inviteUrl) {
                embed.addFields({
                    name: "🔗 Rejoin Invite",
                    value: `You have been provided a one-time link to rejoin: [Click Here to Rejoin](${inviteUrl})\n*(One-time use • Expires in 24 hours)*`,
                    inline: false
                });
            }

            const buttons: ButtonBuilder[] = [];

            if (inviteUrl) {
                buttons.push(
                    new ButtonBuilder()
                        .setLabel("Rejoin Server")
                        .setURL(inviteUrl)
                        .setEmoji("🔗")
                        .setStyle(ButtonStyle.Link)
                );
            }
            
            // Only add Discord button if it's a MUTE (user is still in the server)
            // Discord blocks DM button interactions if the user shares NO servers with the bot
            if (type === "MUTE") {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`appeal_init_${guild.id}_${type}`)
                        .setLabel("Appeal via Discord")
                        .setEmoji(client.emoji.edit?.match(/\d+/)?.[0] || "📜")
                        .setStyle(ButtonStyle.Primary)
                );
            }

            // Generate cryptographically signed token for unauthenticated web appeal
            const safeReason = reason ? reason.substring(0, 100) : "No reason provided";
            const data = `${guild.id}:${user.id}:${type}`;
            const secret = process.env.DISCORD_CLIENT_SECRET || process.env.TOKEN || 'fallback-secret';
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(data);
            const signature = hmac.digest('hex');

            const webUrl = `https://bot.encl.asia/appeal?g=${guild.id}&u=${user.id}&t=${type}&tag=${encodeURIComponent(user.tag)}&r=${encodeURIComponent(safeReason)}&s=${signature}`;

            buttons.push(
                new ButtonBuilder()
                    .setLabel("Appeal via Web")
                    .setURL(webUrl)
                    .setEmoji(client.emoji.link?.match(/\d+/)?.[0] || "🌐")
                    .setStyle(ButtonStyle.Link)
            );

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

            let sent = false;
            await user.send({ embeds: [embed], components: [row] })
                .then(() => { sent = true; })
                .catch(() => {
                    console.log(`Could not send DM to ${user.tag} for appeal.`);
                });
            return sent;
        } catch (error) {
            console.error("Error in sendAppealDM:", error);
            return false;
        }
    }
}
