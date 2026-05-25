import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class Banner extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'banner',
			aliases: ['bn'],
			description: {
				content: 'Show the banner of a user in high resolution.',
				usage: 'banner [user]',
				examples: ['banner', 'banner @User']
			},
			category: 'general',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to get the banner of',
					type: ApplicationCommandOptionType.User,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const member = await Resolver.resolveMember(ctx) || ctx.member!;
		const user = await member.user.fetch();

		const bannerUrl = user.bannerURL({ size: 4096, extension: 'png', forceStatic: false });

		if (!bannerUrl) {
			return await ctx.sendMessage({ 
				content: `${client.emoji.cross} **${user.username}** does not have a banner.`,
				flags: [64] 
			});
		}

		const embed = new EmbedBuilder()
			.setTitle(`${user.username}'s Banner`)
			.setImage(bannerUrl)
			.setColor(client.color.main)
			.setFooter({ text: `Requested by ${ctx.author.tag}` });

		return await ctx.sendMessage({ embeds: [embed] });
	}
}
