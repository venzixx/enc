import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
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
		const rawGuild = (ctx.interaction as any)?.guild || (ctx.interaction as any)?.data?.guild || ctx.guild;
		const guildId = ctx.guild?.id || ctx.interaction?.guildId || rawGuild?.id;
		const guildName = ctx.guild?.name || rawGuild?.name || 'Server';
		const iconHash = ctx.guild?.icon || rawGuild?.icon;
		const bannerHash = ctx.guild?.banner || rawGuild?.banner;
		const splashHash = ctx.guild?.splash || rawGuild?.splash;

		if (!guildId) {
			return await ctx.replyV2({ description: 'Please run this command inside a Discord server.', isAlert: true });
		}

		if (type === 'icon' || type === 'i') {
			if (!iconHash) {
				return await ctx.replyV2({ description: `**${guildName}** does not have an icon set.`, isAlert: true });
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
				.setTitle(`${guildName}'s Icon`)
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
				return await ctx.replyV2({ description: `**${guildName}** does not have a banner or splash set.`, isAlert: true });
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
				.setTitle(`${guildName}'s ${isSplashOnly ? 'Splash' : 'Banner'}`)
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
