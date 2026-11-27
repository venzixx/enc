import { ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { V2Helper } from '../../utils/V2Helper';

function resolveBannerData(hash: string | null | undefined, basePath: string) {
	if (!hash) return null;
	const isAnimated = hash.startsWith('a_');
	const cleanUrl = `https://cdn.discordapp.com/${basePath}/${hash}`;
	const pngUrl = `${cleanUrl}.png?size=4096`;
	const jpgUrl = `${cleanUrl}.jpg?size=4096`;
	const webpUrl = `${cleanUrl}.webp?size=4096`;
	const gifUrl = isAnimated ? `${cleanUrl}.gif?size=4096` : null;

	let formatLinks = `[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`;
	if (gifUrl) formatLinks += ` • [GIF](${gifUrl})`;

	return {
		url: isAnimated ? `${cleanUrl}.gif?size=4096` : pngUrl,
		formatLinks
	};
}

export default class Banner extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'banner',
			aliases: ['bn'],
			description: {
				content: 'Show the banner of a user in high resolution (supports animated GIF and server banners).',
				usage: 'banner [user]',
				examples: ['banner', 'banner @User', 'banner 123456789']
			},
			category: 'general',
			cooldown: 3,
			slashCommand: true,
			integration_types: [0, 1], // GuildInstall, UserInstall
			contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
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
		const hasInput = Boolean(_args[0] || (ctx.isInteraction && ctx.options?.getUser?.('user')));
		let targetUser = await Resolver.resolveUser(ctx, _args[0]);

		if (!targetUser && hasInput) {
			return await ctx.replyV2({
				description: 'Could not find any user matching your input.',
				isAlert: true
			});
		}

		if (!targetUser) {
			targetUser = ctx.author;
		}

		const user = await client.users.fetch(targetUser.id, { force: true }).catch(() => targetUser);
		const member = ctx.guild ? await ctx.guild.members.fetch(user.id).catch(() => null) : null;

		const globalBanner = resolveBannerData(user.banner, `banners/${user.id}`);
		const serverBanner = member && ctx.guild ? resolveBannerData(member.banner, `guilds/${ctx.guild.id}/users/${user.id}/banners`) : null;

		if (!globalBanner && !serverBanner) {
			if (user.hexAccentColor) {
				return await ctx.replyV2({
					title: `${user.username}'s Banner Color`,
					description: `**${user.username}** does not have a banner image, but has an accent color: \`${user.hexAccentColor}\``,
					borderless: true,
					color: user.accentColor || null,
					footer: `Requested by ${ctx.author.tag || ctx.author.username}`
				});
			}

			return await ctx.replyV2({ 
				description: `**${user.username}** does not have a banner set.`,
				isAlert: true
			});
		}

		const hasBoth = Boolean(serverBanner && globalBanner && serverBanner.url !== globalBanner.url);
		let viewMode: 'server' | 'global' = serverBanner ? 'server' : 'global';

		const buildButtons = (mode: 'server' | 'global', currentUrl: string, disableInteractions = false) => {
			const buttons: ButtonBuilder[] = [];

			if (hasBoth) {
				buttons.push(
					new ButtonBuilder()
						.setCustomId('banner_server')
						.setLabel('Server Banner')
						.setStyle(mode === 'server' ? ButtonStyle.Primary : ButtonStyle.Secondary)
						.setDisabled(disableInteractions || mode === 'server'),
					new ButtonBuilder()
						.setCustomId('banner_global')
						.setLabel('Global Banner')
						.setStyle(mode === 'global' ? ButtonStyle.Primary : ButtonStyle.Secondary)
						.setDisabled(disableInteractions || mode === 'global')
				);
			}

			buttons.push(
				new ButtonBuilder()
					.setLabel('Open Original')
					.setStyle(ButtonStyle.Link)
					.setURL(currentUrl)
			);

			return buttons;
		};

		const renderLayout = (mode: 'server' | 'global', disableInteractions = false) => {
			const active = (mode === 'server' && serverBanner) ? serverBanner : (globalBanner || serverBanner)!;
			const title = (mode === 'server' && serverBanner)
				? `${member?.displayName || user.username}'s Server Banner`
				: `${user.username}'s Banner`;

			return {
				title,
				description: active.formatLinks,
				image: active.url,
				borderless: true,
				color: null,
				footer: `Requested by ${ctx.author.tag || ctx.author.username}`,
				buttons: buildButtons(mode, active.url, disableInteractions)
			};
		};

		const response = await ctx.replyV2(renderLayout(viewMode));

		if (!hasBoth) return;

		let targetMsg: any = response;
		if (ctx.interaction && (!targetMsg || !('createMessageComponentCollector' in targetMsg))) {
			targetMsg = await ctx.interaction.fetchReply().catch(() => null);
		}

		if (!targetMsg || !('createMessageComponentCollector' in targetMsg)) return;

		const collector = targetMsg.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000
		});

		collector.on('collect', async (i: any) => {
			if (i.user.id !== ctx.author.id) {
				return await i.reply({ content: 'Only the command author can toggle banners.', ephemeral: true });
			}

			if (i.customId === 'banner_server') {
				viewMode = 'server';
			} else if (i.customId === 'banner_global') {
				viewMode = 'global';
			}

			const updatedLayout = V2Helper.createLayout(renderLayout(viewMode));
			await i.update(updatedLayout as any).catch(() => {});
		});

		collector.on('end', async () => {
			try {
				const finalLayout = V2Helper.createLayout(renderLayout(viewMode, true));
				if (ctx.isInteraction && ctx.interaction) {
					await ctx.interaction.editReply(finalLayout as any).catch(() => {});
				} else if (targetMsg?.editable) {
					await targetMsg.edit(finalLayout as any).catch(() => {});
				}
			} catch {}
		});
	}
}
