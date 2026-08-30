import { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class Avatar extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'avatar',
			aliases: ['av', 'pfp'],
			description: {
				content: 'Show the avatar of a user in high resolution.',
				usage: 'avatar [user]',
				examples: ['avatar', 'avatar @User']
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
		const member = await Resolver.resolveMember(ctx) || ctx.member!;
		if (!member) return;

		const user = member.user;

		const globalAvatar = user.displayAvatarURL({ size: 4096, extension: 'png', forceStatic: false });
		const serverAvatar = member.avatarURL({ size: 4096, extension: 'png', forceStatic: false });

		const hasBoth = serverAvatar && serverAvatar !== globalAvatar;

		let currentAvatar = serverAvatar || globalAvatar;

		const embed = new EmbedBuilder()
			.setTitle(`${user.username}'s Avatar`)
			.setImage(currentAvatar)
			.setColor(client.color.main)
			.setFooter({ text: `Requested by ${ctx.author.tag}` });

		const row = new ActionRowBuilder<ButtonBuilder>();

		if (hasBoth) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId('avatar_server')
					.setLabel('Server Avatar')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId('avatar_global')
					.setLabel('Global Avatar')
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
			if (i.customId === 'avatar_server') {
				currentAvatar = serverAvatar!;
				row.components[0].setDisabled(true).setStyle(ButtonStyle.Primary);
				row.components[1].setDisabled(false).setStyle(ButtonStyle.Secondary);
			} else {
				currentAvatar = globalAvatar;
				row.components[0].setDisabled(false).setStyle(ButtonStyle.Secondary);
				row.components[1].setDisabled(true).setStyle(ButtonStyle.Primary);
			}

			embed.setImage(currentAvatar);
			await i.update({ embeds: [embed], components: [row] });
		});

		collector.on('end', () => {
			row.components.forEach(c => c.setDisabled(true));
			message.edit({ components: [row] }).catch(() => {});
		});
	}
}
