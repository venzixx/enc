import { EmbedBuilder, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Serverinfo extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'serverinfo',
			description: {
				content: 'Displays detailed information about the server.',
				usage: 'serverinfo',
				examples: ['serverinfo']
			},
			category: 'info',
			cooldown: 3,
			slashCommand: true,
			options: []
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const guild = ctx.guild;
		const channels = guild.channels.cache;
		const roles = guild.roles.cache;
		
		const embed = new EmbedBuilder()
			.setTitle(`${guild.name}`)
			.setThumbnail(guild.iconURL({ size: 512 }) || null)
            .setImage(guild.bannerURL({ size: 1024 }) || null)
			.setColor(_client.color.main)
			.addFields(
				{ name: 'ðŸ“Š General', value: `**Owner:** <@${guild.ownerId}>\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n**Verification:** \`${guild.verificationLevel}\`\n**ID:** \`${guild.id}\``, inline: false },
				{ name: 'ðŸ‘¥ Members', value: `**Total:** \`${guild.memberCount}\`\n**Boosts:** \`${guild.premiumSubscriptionCount || 0}\` (Tier ${guild.premiumTier})`, inline: true },
				{ name: 'ðŸ“ Channels', value: `**Text:** \`${channels.filter((c: any) => c.type === ChannelType.GuildText).size}\`\n**Voice:** \`${channels.filter((c: any) => c.type === ChannelType.GuildVoice).size}\`\n**Threads:** \`${channels.filter((c: any) => c.isThread()).size}\``, inline: true },
                { name: 'âœ¨ Misc', value: `**Roles:** \`${roles.size}\`\n**Emojis:** \`${guild.emojis.cache.size}\`\n**Stickers:** \`${guild.stickers.cache.size}\``, inline: true }
			)
			.setFooter({ text: `Requested by ${ctx.author.tag}`, iconURL: ctx.author.displayAvatarURL() })
			.setTimestamp();

		await ctx.reply({ embeds: [embed] });
	}
}
