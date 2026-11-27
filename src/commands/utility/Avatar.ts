import { ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { V2Helper } from '../../utils/V2Helper';

function getAvatarData(baseUrl: string | null | undefined, isAnimated: boolean) {
	if (!baseUrl) return null;

	const cleanUrl = baseUrl.split('?')[0].replace(/\.(png|jpe?g|gif|webp)$/i, '');
	const pngUrl = `${cleanUrl}.png?size=4096`;
	const jpgUrl = `${cleanUrl}.jpg?size=4096`;
	const webpUrl = `${cleanUrl}.webp?size=4096`;
	const gifUrl = isAnimated ? `${cleanUrl}.gif?size=4096` : null;

	let formatLinks = `[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`;
	if (gifUrl) formatLinks += ` • [GIF](${gifUrl})`;

	return {
		mainUrl: baseUrl,
		formatLinks
	};
}

export default class Avatar extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'avatar',
			aliases: ['av', 'pfp'],
			description: {
				content: 'Show the avatar of a user in high resolution.',
				usage: 'avatar [user]',
				examples: ['avatar', 'avatar @User', 'avatar 123456789']
			},
			category: 'utility',
			cooldown: 3,
			slashCommand: true,
			integration_types: [0, 1], // GuildInstall, UserInstall
			contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
			options: [
				{
					name: 'user',
					description: 'The user to get the avatar of',
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

		const isGlobalAnimated = Boolean(user.avatar?.startsWith('a_'));
		const globalUrl = user.displayAvatarURL({ size: 4096, forceStatic: false });
		const globalData = getAvatarData(globalUrl, isGlobalAnimated)!;

		let serverData: ReturnType<typeof getAvatarData> = null;
		if (member && member.avatar) {
			const isServerAnimated = Boolean(member.avatar.startsWith('a_'));
			const serverUrl = member.avatarURL({ size: 4096, forceStatic: false });
			if (serverUrl && serverUrl !== globalUrl) {
				serverData = getAvatarData(serverUrl, isServerAnimated);
			}
		}

		const hasBoth = Boolean(serverData);
		let viewMode: 'server' | 'global' = serverData ? 'server' : 'global';

		const buildButtons = (mode: 'server' | 'global', currentUrl: string, disableInteractions = false) => {
			const buttons: ButtonBuilder[] = [];

			if (hasBoth) {
				buttons.push(
					new ButtonBuilder()
						.setCustomId('avatar_server')
						.setLabel('Server Avatar')
						.setStyle(mode === 'server' ? ButtonStyle.Primary : ButtonStyle.Secondary)
						.setDisabled(disableInteractions || mode === 'server'),
					new ButtonBuilder()
						.setCustomId('avatar_global')
						.setLabel('Global Avatar')
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
			const active = mode === 'server' ? serverData! : globalData;
			const title = mode === 'server'
				? `${member?.displayName || user.username}'s Server Avatar`
				: `${user.username}'s Avatar`;

			return {
				title,
				description: active.formatLinks,
				image: active.mainUrl,
				borderless: true,
				color: null,
				footer: `Requested by ${ctx.author.tag || ctx.author.username}`,
				buttons: buildButtons(mode, active.mainUrl, disableInteractions)
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
				return await i.reply({ content: 'Only the command author can toggle avatars.', ephemeral: true });
			}

			if (i.customId === 'avatar_server') {
				viewMode = 'server';
			} else if (i.customId === 'avatar_global') {
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
