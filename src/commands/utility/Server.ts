import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Server extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'server',
			aliases: ['srv', 'guild'],
			description: {
				content: 'Get the server icon or banner in high resolution.',
				usage: 'server [icon|banner]',
				examples: ['server icon', 'server banner']
			},
			category: 'utility',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'type',
					description: 'What do you want to see?',
					type: 3, // STRING
					required: true,
					choices: [
						{ name: 'Server Icon', value: 'icon' },
						{ name: 'Server Banner', value: 'banner' }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const type = (args[0] || ctx.options.getString('type') || 'icon').toLowerCase();
		const guild = ctx.guild;

		if (type === 'icon' || type === 'i') {
			const iconUrl = guild.iconURL({ size: 4096, forceStatic: false });
			if (!iconUrl) {
				return await ctx.replyV2({ description: 'This server does not have an icon.', isAlert: true });
			}

			const embed = new EmbedBuilder()
				.setTitle(`${guild.name}'s Icon`)
				.setImage(iconUrl)
				.setColor(client.color.main)
				.setFooter({ text: `Requested by ${ctx.author.tag}` });

			return await ctx.sendMessage({ embeds: [embed] });
		}

		if (type === 'banner' || type === 'b') {
			const bannerUrl = guild.bannerURL({ size: 4096, forceStatic: false });
			if (!bannerUrl) {
				return await ctx.replyV2({ description: 'This server does not have a banner.', isAlert: true });
			}

			const embed = new EmbedBuilder()
				.setTitle(`${guild.name}'s Banner`)
				.setImage(bannerUrl)
				.setColor(client.color.main)
				.setFooter({ text: `Requested by ${ctx.author.tag}` });

			return await ctx.sendMessage({ embeds: [embed] });
		}

		return await ctx.replyV2({ description: 'Please use `.srv icon` or `.srv banner`.', isAlert: true });
	}
}
