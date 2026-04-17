import { 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType,
    ChannelType
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class UserInfo extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'userinfo',
			description: {
				content: 'Get information about a user.',
				usage: 'userinfo [user]',
				examples: ['userinfo @User']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to get info about',
					type: ApplicationCommandOptionType.User,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const member = await Resolver.resolveMember(ctx);
        if (!member) {
            return await ctx.reply({ content: '❌ Could not find that member.', flags: [64] });
        }

		const user = member.user;
		const roles = member.roles.cache
			.filter((role) => role.id !== ctx.guild.id)
			.sort((a, b) => b.position - a.position)
			.map((role) => role.toString());

		const embed = new EmbedBuilder()
			.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
			.setThumbnail(user.displayAvatarURL())
			.setColor(member.displayColor || client.color.main)
			.addFields(
				{ name: '👤 User', value: `**ID:** \`${user.id}\`\n**Bot:** \`${user.bot ? 'Yes' : 'No'}\`\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
				{ name: '🏢 Membership', value: `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>\n**Top Role:** ${member.roles.highest}`, inline: true },
				{ name: `🎭 Roles (${roles.length})`, value: roles.length > 10 ? roles.slice(0, 10).join(', ') + ` and ${roles.length - 10} more...` : roles.join(', ') || 'None', inline: false }
			)
			.setTimestamp();

		await ctx.reply({ embeds: [embed] });
	}
}
