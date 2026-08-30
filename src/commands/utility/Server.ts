import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Routes
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Server extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'server',
			aliases: ['srv', 'guild'],
			description: {
				content: 'Get the server icon or banner in high resolution (User-Installable).',
				usage: 'server [icon|banner]',
				examples: ['server icon', 'server banner', 'srv icon']
			},
			category: 'utility',
			cooldown: 2,
			slashCommand: true,
			integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
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
		const guildId = ctx.guild?.id || ctx.interaction?.guildId;

		if (!guildId) {
			return await ctx.replyV2({ description: 'Please run this command inside a Discord server.', isAlert: true, ephemeral: true });
		}

		let guildName = ctx.guild?.name;
		let iconHash = ctx.guild?.icon;
		let bannerHash = ctx.guild?.banner;
		let splashHash = ctx.guild?.splash;

		let targetGuild = ctx.guild || client.guilds.cache.get(guildId);
		if (!targetGuild) {
			targetGuild = await client.guilds.fetch(guildId).catch(() => null);
		}

		if (targetGuild) {
			guildName = targetGuild.name;
			iconHash = targetGuild.icon;
			bannerHash = targetGuild.banner;
			splashHash = targetGuild.splash;
		} else {
			const preview = await client.rest.get(Routes.guildPreview(guildId)).catch(() => null) as any;
			if (preview) {
				guildName = preview.name;
				iconHash = preview.icon;
				bannerHash = preview.banner;
				splashHash = preview.splash;
			} else {
				const widget = await fetch(`https://discord.com/api/v10/guilds/${guildId}/widget.json`)
					.then(r => r.ok ? r.json() : null)
					.catch(() => null);
				if (widget && widget.name) {
					guildName = widget.name;
				}
			}
		}

		if (type === 'icon' || type === 'i') {
			if (!iconHash) {
				if (targetGuild) {
					return await ctx.replyV2({ description: `**${guildName || 'This server'}** does not have an icon set.`, isAlert: true });
				} else {
					return await ctx.replyV2({ 
						description: `Unable to access this server's icon. Because the bot is not joined in this server and Community Preview is disabled, Discord restricts external access. Invite **${client.user?.username || 'the bot'}** to this server for full support!`, 
						isAlert: true,
						ephemeral: true
					});
				}
			}

			const isAnimated = typeof iconHash === 'string' && iconHash.startsWith('a_');
			const defaultExt = isAnimated ? 'gif' : 'png';
			const iconUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${defaultExt}?size=4096`;
			const pngUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=4096`;
			const jpgUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.jpg?size=4096`;
			const webpUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.webp?size=4096`;
			const gifUrl = isAnimated ? `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.gif?size=4096` : null;

			let formatLinks = `[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`;
			if (gifUrl) formatLinks += ` • [GIF](${gifUrl})`;

			const embed = new EmbedBuilder()
				.setTitle(`${guildName || 'Server'}'s Icon`)
				.setDescription(formatLinks)
				.setImage(iconUrl)
				.setColor(client.color.main)
				.setFooter({ text: `Requested by ${ctx.author.tag}` });

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Open Original')
					.setStyle(ButtonStyle.Link)
					.setURL(iconUrl)
			);

			return await ctx.sendMessage({ embeds: [embed], components: [row] });
		}

		if (type === 'banner' || type === 'b' || type === 'splash') {
			const activeHash = bannerHash || splashHash;
			const isSplashOnly = !bannerHash && Boolean(splashHash);

			if (!activeHash) {
				if (targetGuild) {
					return await ctx.replyV2({ description: `**${guildName || 'This server'}** does not have a banner or splash set.`, isAlert: true });
				} else {
					return await ctx.replyV2({ 
						description: `Unable to access this server's banner. Because the bot is not joined in this server and Community Preview is disabled, Discord restricts external access. Invite **${client.user?.username || 'the bot'}** to this server for full support!`, 
						isAlert: true,
						ephemeral: true
					});
				}
			}

			const isAnimated = typeof activeHash === 'string' && activeHash.startsWith('a_');
			const defaultExt = isAnimated ? 'gif' : 'png';
			const basePath = isSplashOnly ? 'splashes' : 'banners';
			const bannerUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.${defaultExt}?size=4096`;
			const pngUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.png?size=4096`;
			const jpgUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.jpg?size=4096`;
			const webpUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.webp?size=4096`;
			const gifUrl = isAnimated ? `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.gif?size=4096` : null;

			let formatLinks = `[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`;
			if (gifUrl) formatLinks += ` • [GIF](${gifUrl})`;

			const embed = new EmbedBuilder()
				.setTitle(`${guildName || 'Server'}'s ${isSplashOnly ? 'Splash' : 'Banner'}`)
				.setDescription(formatLinks)
				.setImage(bannerUrl)
				.setColor(client.color.main)
				.setFooter({ text: `Requested by ${ctx.author.tag}` });

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Open Original')
					.setStyle(ButtonStyle.Link)
					.setURL(bannerUrl)
			);

			return await ctx.sendMessage({ embeds: [embed], components: [row] });
		}

		return await ctx.replyV2({ description: 'Please use `,srv icon` or `,srv banner`.', isAlert: true });
	}
}
