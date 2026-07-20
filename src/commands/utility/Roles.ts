import { Command, Context } from "../../structures";
import {
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
	Role,
} from "discord.js";

export default class Roles extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "roles",
			description: {
				content: "List all roles in the server sorted by hierarchy",
				examples: ["roles"],
				usage: "roles",
			},
			category: "utility",
			aliases: ["rolelist", "serverroles"],
			cooldown: 5,
			args: false,
			vote: false,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
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
			slashCommand: false,
			hidden: true,
			options: [],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();

		const guild = ctx.guild;
		// Fetch all guild members to ensure accurate member counts
		await guild.members.fetch();
		const roles = guild.roles.cache
			.filter((role: Role) => role.id !== guild.id)
			.sort((a: Role, b: Role) => b.position - a.position);

		const totalCount = roles.size;
		if (totalCount === 0) {
			return ctx.reply({ content: `${client.emoji.cross} This server has no roles.` });
		}

		// Split roles into pages (15 roles per page)
		const rolesArray = [...roles.values()];
		const perPage = 15;
		const totalPages = Math.ceil(rolesArray.length / perPage);
		let currentPage = 0;

		const buildEmbed = (page: number) => {
			const start = page * perPage;
			const end = Math.min(start + perPage, rolesArray.length);
			const pageRoles = rolesArray.slice(start, end);

			const lines = pageRoles.map((role: Role) =>
				`<@&${role.id}> — \`${role.members.size} members\``
			);

			return new EmbedBuilder()
				.setTitle(`Roles in ${guild.name} [${totalCount}]`)
				.setDescription(lines.join("\n"))
				.setColor(client.color.main)
				.setFooter({ text: `Page ${page + 1} of ${totalPages} • Total: ${totalCount} roles` })
				.setTimestamp();
		};

		const buildButtons = (page: number) => {
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("roles_first")
					.setEmoji("⏮")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("roles_prev")
					.setEmoji("◀")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("roles_page")
					.setLabel(`${page + 1}/${totalPages}`)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("roles_next")
					.setEmoji("▶")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === totalPages - 1),
				new ButtonBuilder()
					.setCustomId("roles_last")
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

			if (i.customId === "roles_first") {
				currentPage = 0;
			} else if (i.customId === "roles_prev") {
				currentPage = Math.max(0, currentPage - 1);
			} else if (i.customId === "roles_next") {
				currentPage = Math.min(totalPages - 1, currentPage + 1);
			} else if (i.customId === "roles_last") {
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
					.setCustomId("roles_first")
					.setEmoji("⏮")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("roles_prev")
					.setEmoji("◀")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("roles_page")
					.setLabel(`${currentPage + 1}/${totalPages}`)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("roles_next")
					.setEmoji("▶")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("roles_last")
					.setEmoji("⏭")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
			);
			ctx.editMessage({ components: [disabledRow] }).catch(() => {});
		});
	}
}
