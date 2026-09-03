import { Command, Context } from '../../structures';
import { SendMessages, ReadMessageHistory, ViewChannel, EmbedLinks } from '../../utils/Permissions';
import { ExtendedClient } from '../../client';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
	Role,
} from 'discord.js';

export default class InroleCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'inrole',
			aliases: ['members'],
			description: {
				content: 'Shows all members who have a specific role.',
				usage: 'inrole <role>',
				examples: ['inrole @Moderator', 'inrole Admin'],
			},
			category: 'utility',
			cooldown: 5,
			args: true,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			vote: false,
			permissions: {
				dev: false,
				client: [
					SendMessages,
					ReadMessageHistory,
					ViewChannel,
					EmbedLinks,
				],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: 'role',
					description: 'The role to check',
					type: 8,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();

		let role: Role | null | undefined = null;

		if (ctx.interaction) {
			role = ctx.options.getRole('role') as Role;
		} else {
			const query = args.join(' ');
			const roleId = query.replace(/[<@&>]/g, '');
			role = ctx.guild.roles.cache.get(roleId) ||
				ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase() === query.toLowerCase()) ||
				ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase().includes(query.toLowerCase()));
		}

		if (!role) {
			return ctx.reply({ content: `${client.emoji.cross} Could not find that role.` });
		}

		// Fetch all guild members to ensure accurate counts
		try {
			await ctx.guild.members.fetch();
		} catch (err: any) {
			const isRateLimit = err?.name === 'GatewayRateLimitError' || 
				(typeof err?.message === 'string' && (err.message.includes('opcode 8') || err.message.includes('rate limited')));
			if (isRateLimit) {
				const match = err.message?.match(/retry after ([\d.]+)\s*seconds/i);
				const retrySeconds = match ? Math.ceil(parseFloat(match[1])) : 20;
				return await ctx.replyV2({
					title: `${client.emoji.cross} Discord Gateway Rate Limited`,
					description: `Discord is temporarily rate-limiting member requests (\`Opcode 8\`).\n\nPlease retry this command after **${retrySeconds} seconds**.`,
					isAlert: true,
					color: client.color.red
				});
			}
		}

		const members = role.members.sort((a: any, b: any) =>
			a.displayName.localeCompare(b.displayName)
		);
		const count = members.size;

		if (count === 0) {
			const embed = new EmbedBuilder()
				.setTitle(`Members with ${role.name} [0]`)
				.setDescription('No members have this role.')
				.setColor(role.color || client.color.main)
				.setTimestamp();
			return ctx.reply({ embeds: [embed] });
		}

		const membersArray = [...members.values()];
		const perPage = 30;
		const totalPages = Math.ceil(membersArray.length / perPage);
		let currentPage = 0;

		const buildEmbed = (page: number) => {
			const start = page * perPage;
			const end = Math.min(start + perPage, membersArray.length);
			const pageMembers = membersArray.slice(start, end);

			const lines = pageMembers.map((m: any) => `<@${m.user.id}> (${m.user.username})`);

			return new EmbedBuilder()
				.setTitle(`Members with ${role.name} [${count}]`)
				.setDescription(lines.join('\n'))
				.setColor(role.color || client.color.main)
				.setFooter({ text: `Page ${page + 1} of ${totalPages} • Total: ${count} members` })
				.setTimestamp();
		};

		const buildButtons = (page: number) => {
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("inrole_first")
					.setEmoji("⏮")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("inrole_prev")
					.setEmoji("◀")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("inrole_page")
					.setLabel(`${page + 1}/${totalPages}`)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("inrole_next")
					.setEmoji("▶")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === totalPages - 1),
				new ButtonBuilder()
					.setCustomId("inrole_last")
					.setEmoji("⏭")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === totalPages - 1),
			);
			return [row];
		};

		const embed = buildEmbed(currentPage);
		const components = totalPages > 1 ? buildButtons(currentPage) : [];

		const message = await ctx.sendMessage({
			embeds: [embed],
			components,
		});

		if (totalPages <= 1 || !message || !("createMessageComponentCollector" in message)) return;

		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 120000,
			filter: (i: any) => i.user.id === ctx.author.id,
		});

		collector.on("collect", async (i: any) => {
			try {
				await i.deferUpdate();
			} catch (err) {
				console.error("Failed to defer update:", err);
			}

			if (i.customId === "inrole_first") {
				currentPage = 0;
			} else if (i.customId === "inrole_prev") {
				currentPage = Math.max(0, currentPage - 1);
			} else if (i.customId === "inrole_next") {
				currentPage = Math.min(totalPages - 1, currentPage + 1);
			} else if (i.customId === "inrole_last") {
				currentPage = totalPages - 1;
			}

			await ctx.editMessage({
				embeds: [buildEmbed(currentPage)],
				components: buildButtons(currentPage),
			});
		});

		collector.on("end", () => {
			const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("inrole_first")
					.setEmoji("⏮")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("inrole_prev")
					.setEmoji("◀")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("inrole_page")
					.setLabel(`${currentPage + 1}/${totalPages}`)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("inrole_next")
					.setEmoji("▶")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("inrole_last")
					.setEmoji("⏭")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
			);
			ctx.editMessage({ components: [disabledRow] }).catch(() => {});
		});
	}
}
