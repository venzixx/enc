import { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

function resolveBannerUrl(hash: string | null | undefined, basePath: string): string | null {
	if (!hash) return null;
	if (hash.startsWith('a_')) {
		return `https://cdn.discordapp.com/${basePath}/${hash}.webp?size=4096&animated=true`;
	}
	return `https://cdn.discordapp.com/${basePath}/${hash}.png?size=4096`;
}

export default class Banner extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'banner',
			aliases: ['bn'],
			description: {
				content: 'Show the banner of a user in high resolution (supports animated GIF and server banners).',
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
		const targetUser = (await Resolver.resolveUser(ctx, _args[0])) || ctx.author;
		const user = await client.users.fetch(targetUser.id, { force: true });
		const member = ctx.guild ? await ctx.guild.members.fetch(targetUser.id).catch(() => null) : null;

		const globalBanner = resolveBannerUrl(user.banner, `banners/${user.id}`);
		const serverBanner = member && ctx.guild ? resolveBannerUrl(member.banner, `guilds/${ctx.guild.id}/users/${user.id}/banners`) : null;

		if (!globalBanner && !serverBanner) {
			if (user.hexAccentColor) {
				const colorEmbed = new EmbedBuilder()
					.setTitle(`${user.username}'s Banner Color`)
					.setDescription(`**${user.username}** does not have a banner image, but has an accent color: \`${user.hexAccentColor}\``)
					.setColor(user.accentColor || client.color.main)
					.setFooter({ text: `Requested by ${ctx.author.tag}` });
				return await ctx.sendMessage({ embeds: [colorEmbed] });
			}

			return await ctx.sendMessage({ 
				content: `${client.emoji.cross} **${user.username}** does not have a banner.`,
				flags: [64] 
			});
		}

		const hasBoth = Boolean(serverBanner && serverBanner !== globalBanner);
		let currentBanner = serverBanner || globalBanner || null;

		const embed = new EmbedBuilder()
			.setTitle(`${user.username}'s Banner`)
			.setImage(currentBanner)
			.setColor(user.accentColor || client.color.main)
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

		if (currentBanner) {
			row.addComponents(
				new ButtonBuilder()
					.setLabel('Open Original')
					.setStyle(ButtonStyle.Link)
					.setURL(currentBanner)
			);
		}

		const message = await ctx.sendMessage({ 
			embeds: [embed], 
			components: row.components.length > 0 ? [row] : [] 
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

			const linkBtn = row.components.find(c => c.data.style === ButtonStyle.Link) as ButtonBuilder | undefined;
			if (linkBtn) {
				linkBtn.setURL(currentBanner);
			}

			embed.setImage(currentBanner);
			await i.update({ embeds: [embed], components: [row] });
		});

		collector.on('end', () => {
			row.components.forEach(c => {
				if (c.data.style !== ButtonStyle.Link) {
					c.setDisabled(true);
				}
			});
			message.edit({ components: [row] }).catch(() => {});
		});
	}
}
