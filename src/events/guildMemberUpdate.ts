import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import { ExtendedClient } from '../client';

export default {
    name: Events.GuildMemberUpdate,
    async execute(oldMember: GuildMember, newMember: GuildMember, client: ExtendedClient) {
        // Detect New Boost
        if (!oldMember.premiumSince && newMember.premiumSince) {
            const guild = newMember.guild;
            
            // Logic for a global thank you message (could be set via a command later, using system channel for now)
            const channel = guild.systemChannel;
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🚀 New Server Boost!')
                    .setDescription(`Wow! ${newMember.user} just boosted the server! Thank you so much for the support! 💖`)
                    .setThumbnail(newMember.user.displayAvatarURL())
                    .setColor(0xFF73FA) // Pinkish boost color
                    .setFooter({ text: `Total Boosts: ${guild.premiumSubscriptionCount || 0}` })
                    .setTimestamp();
                
                await channel.send({ content: `${newMember.user}`, embeds: [embed] });
            }
        }
    },
};
