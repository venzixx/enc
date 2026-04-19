import { 
    EmbedBuilder, 
    ChannelType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class ServerInfo extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'serverinfo',
			aliases: ['si', 'guildinfo'],
			description: {
				content: 'Get information about the server.',
				usage: 'serverinfo',
				examples: ['serverinfo']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: false,
			hidden: true
		});
	}

	public async run(client: ExtendedClient, ctx: Context): Promise<any> {
        await ctx.deferReply();

		const guild = ctx.guild;
		const channels = guild.channels.cache;
		const roles = guild.roles.cache.filter((role: any) => role.id !== guild.id);

		const embed = new EmbedBuilder()
			.setTitle(guild.name)
			.setThumbnail(guild.iconURL({ forceStatic: false }))
			.setColor(client.color.main)
			.addFields(
				{ name: ' General', value: `**Owner:** <@${guild.ownerId}>\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n**Verification:** \`${guild.verificationLevel}\`\n**ID:** \`${guild.id}\``, inline: false },
				{ name: ' Members', value: `**Total:** \`${guild.memberCount}\`\n**Boosts:** \`${guild.premiumSubscriptionCount || 0}\` (Tier ${guild.premiumTier})`, inline: true },
				{ name: ' Channels', value: `**Text:** \`${channels.filter((c: any) => c.type === ChannelType.GuildText).size}\`\n**Voice:** \`${channels.filter((c: any) => c.type === ChannelType.GuildVoice).size}\`\n**Threads:** \`${channels.filter((c: any) => c.isThread()).size}\``, inline: true },
                { name: `${client.emoji.random} Misc`, value: `**Roles:** \`${roles.size}\`\n**Emojis:** \`${guild.emojis.cache.size}\`\n**Stickers:** \`${guild.stickers.cache.size}\``, inline: true }
			)
			.setTimestamp();

		if (guild.banner) {
			embed.setImage(guild.bannerURL());
		}

		await ctx.reply({ embeds: [embed] });
	}
}
