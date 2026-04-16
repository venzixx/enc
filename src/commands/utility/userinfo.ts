import { EmbedBuilder, GuildMember } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Userinfo extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'userinfo',
			description: {
				content: 'Displays detailed information about a user.',
				usage: 'userinfo [user]',
				examples: ['userinfo', 'userinfo @Member']
			},
			category: 'info',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to get info about',
					type: 6, // USER
					required: false
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const member = (ctx.options.getMember('user') || ctx.member) as GuildMember;
		const user = member.user;
        const roles = member.roles.cache
            .filter(r => r.id !== ctx.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.toString());

		const embed = new EmbedBuilder()
			.setTitle(`${user.tag}`)
			.setThumbnail(user.displayAvatarURL({ size: 512 }))
			.setColor(_client.color.main)
			.addFields(
				{ name: 'ðŸ‘¤ User', value: `**ID:** \`${user.id}\`\n**Bot:** \`${user.bot ? 'Yes' : 'No'}\`\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
				{ name: 'ðŸ¢ Membership', value: `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>\n**Top Role:** ${member.roles.highest}`, inline: true },
				{ name: `ðŸŽ­ Roles (${roles.length})`, value: roles.length > 10 ? roles.slice(0, 10).join(', ') + ` and ${roles.length - 10} more...` : roles.join(', ') || 'None', inline: false }
			)
			.setFooter({ text: `Requested by ${ctx.author.tag}`, iconURL: ctx.author.displayAvatarURL() })
			.setTimestamp();

		await ctx.reply({ embeds: [embed] });
	}
}

