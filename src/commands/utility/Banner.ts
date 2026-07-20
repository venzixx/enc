import { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
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
		if (!member) return;

		// Fetch user to populate global banner properties
		const user = await member.user.fetch();

		const globalBanner = user.bannerURL({ size: 4096, forceStatic: false });
		const serverBanner = member.bannerURL({ size: 4096, forceStatic: false });

		if (!globalBanner && !serverBanner) {
			return await ctx.sendMessage({ 
				content: `${client.emoji.cross} **${user.username}** does not have a banner.`,
				flags: [64] 
			});
		}

		const hasBoth = serverBanner && serverBanner !== globalBanner;
		let currentBanner = serverBanner || globalBanner || null;

		const embed = new EmbedBuilder()
			.setTitle(`${user.username}'s Banner`)
			.setImage(currentBanner)
			.setColor(client.color.main)
			.setFooter({ text: `Requested by ${ctx.author.tag}` });

		const row = new ActionRowBuilder<ButtonBuilder>();

		if (hasBoth) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId('banner_server')
					.setLabel('Server Banner')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId('banner_global')
					.setLabel('Global Banner')
					.setStyle(ButtonStyle.Secondary)
			);
		}

		const message = await ctx.sendMessage({ 
			embeds: [embed], 
			components: hasBoth ? [row] : [] 
		});

		if (!hasBoth || !message || !('createMessageComponentCollector' in message)) return;

		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000,
			filter: (i) => i.user.id === ctx.author.id
		});

		collector.on('collect', async (i: any) => {
			if (i.customId === 'banner_server') {
				currentBanner = serverBanner!;
				row.components[0].setDisabled(true).setStyle(ButtonStyle.Primary);
				row.components[1].setDisabled(false).setStyle(ButtonStyle.Secondary);
			} else {
				currentBanner = globalBanner!;
				row.components[0].setDisabled(false).setStyle(ButtonStyle.Secondary);
				row.components[1].setDisabled(true).setStyle(ButtonStyle.Primary);
			}

			embed.setImage(currentBanner);
			await i.update({ embeds: [embed], components: [row] });
		});

		collector.on('end', () => {
			row.components.forEach(c => c.setDisabled(true));
			message.edit({ components: [row] }).catch(() => {});
		});
	}
}
