import { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Help extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'help',
			description: {
				content: 'Displays all available commands dynamically grouped by category.',
				usage: 'help [command]',
				examples: ['help', 'help ping']
			},
			category: 'general',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'command',
					description: 'Information about a specific command',
					type: 3, // STRING
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const commandName = ctx.options?.getString?.('command') || _args[0];

		if (commandName) {
			return await this.showCommandDetail(client, ctx, commandName);
		}

		await ctx.replyV2(Help.getHomeLayout(client));
	}

	/**
	 * Shows detailed information about a specific command.
	 */
	private async showCommandDetail(client: ExtendedClient, ctx: Context, commandName: string): Promise<any> {
		const command = client.commands.get(commandName) || client.commands.find(c => c.aliases && c.aliases.includes(commandName));
		if (!command) {
			return await ctx.replyV2({ 
				title: 'Command Not Found', 
				description: `${client.emoji.cross} No command found matching \`${commandName}\`.`,
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		const lines: string[] = [
			command.description?.content || 'No description provided.',
			'',
			`${client.emoji.tool_wrench || '🛠️'} **Module** · \`${command.category}\`　　${client.emoji.clock_time || '⏱️'} **Cooldown** · \`${command.cooldown || 3}s\``,
			`${client.emoji.system_info || 'ℹ️'} **Usage** · \`/${command.name} ${command.description?.usage || ''}\``,
		];

		// Subcommands
		if (command.options && command.options.length > 0) {
			const subItems = command.options.filter((opt: any) => 
				opt.type === ApplicationCommandOptionType.Subcommand || opt.type === ApplicationCommandOptionType.SubcommandGroup
			);

			if (subItems.length > 0) {
				lines.push('', `**Subcommands**`);
				subItems.forEach((sub: any) => {
					if (sub.type === ApplicationCommandOptionType.Subcommand) {
						lines.push(`\u3000\u2514 \`${sub.name}\` · ${sub.description}`);
					} else if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
						lines.push(`\u3000\u2514 \`${sub.name}\` (Group)`);
						if (sub.options) {
							sub.options.forEach((s: any) => {
								lines.push(`\u3000\u3000\u2514 \`${s.name}\` · ${s.description}`);
							});
						}
					}
				});
			}
		}

		// Examples
		if (command.description?.examples && command.description.examples.length > 0) {
			lines.push('', `**Examples**`);
			lines.push(command.description.examples.map((e: string) => `\`/${e}\``).join('　'));
		}

		const layout: any = {
			title: `${Help.getCategoryEmoji(command.category, client)} ${command.name}`,
			description: lines.join('\n'),
			borderless: true,
			color: null,
			footer: `Module: ${command.category}`,
			buttons: [
				new ButtonBuilder()
					.setCustomId('help_back')
					.setLabel('Back to Hub')
					.setStyle(ButtonStyle.Secondary)
			]
		};

		return await ctx.replyV2(layout);
	}

	/**
	 * Builds the home help layout with category select menu.
	 */
	public static getHomeLayout(client: ExtendedClient) {
		const visibleCommands = client.commands.filter(c => !c.hidden);
		const categories = [...new Set(visibleCommands.map(c => c.category))].sort();
		const totalCommands = visibleCommands.size;

		// Build category descriptions with command counts
		const categoryLines = categories.map(cat => {
			const count = visibleCommands.filter(c => c.category === cat).size;
			const emoji = Help.getCategoryEmoji(cat, client);
			const name = cat.charAt(0).toUpperCase() + cat.slice(1);
			return `${emoji} **${name}** · \`${count} cmds\``;
		});

		const menu = new StringSelectMenuBuilder()
			.setCustomId('help_category')
			.setPlaceholder('Browse a module...')
			.addOptions(
				categories.map(cat => {
					const emojiResolvable = Help.getCategoryMenuEmoji(cat, client);
					return {
						label: cat.charAt(0).toUpperCase() + cat.slice(1),
						value: cat,
						description: `Explore ${visibleCommands.filter(c => c.category === cat).size} commands in ${cat}`,
						emoji: emojiResolvable
					};
				})
			);

		const buttons = [
			new ButtonBuilder()
				.setLabel('Support')
				.setURL('https://discord.gg/zzN2vn6bwd')
				.setStyle(ButtonStyle.Link)
		];

		return {
			title: `${client.emoji.system_bot || '🤖'} Enc · Command Hub`,
			description: [
				`Explore **${totalCommands}** commands across **${categories.length}** modules.`,
				`Select a module below or use \`/help <command>\` for detailed syntax.`,
				'',
				categoryLines.join('\n'),
			].join('\n'),
			borderless: true,
			color: null,
			footer: `Premium Utility • Monochromatic V2 Engine`,
			selectMenu: menu,
			buttons
		} as any;
	}

	/**
	 * Builds the category view layout for a selected module with pagination support.
	 */
	public static getCategoryLayout(client: ExtendedClient, category: string, page = 1) {
		const commands = client.commands.filter(c => c.category === category && !c.hidden);
		const commandList = Array.from(commands.values());
		const totalCommands = commandList.length;

		const pageSize = 12; // Keeps displayable text well under Discord's 4000 char limit
		const totalPages = Math.max(1, Math.ceil(totalCommands / pageSize));
		const currentPage = Math.min(Math.max(1, page), totalPages);

		const startIdx = (currentPage - 1) * pageSize;
		const pageCommands = commandList.slice(startIdx, startIdx + pageSize);

		const commandsList = pageCommands.map(c => {
			let text = `**\`/${c.name}\`** · ${c.description?.content || 'No description'}`;

			// If command has subcommands, show a concise inline list of subcommands
			if (c.options && c.options.length > 0 && c.name !== 'do') {
				const subNames: string[] = [];
				c.options.forEach((opt: any) => {
					if (opt.type === ApplicationCommandOptionType.Subcommand) {
						subNames.push(`\`${opt.name}\``);
					} else if (opt.type === ApplicationCommandOptionType.SubcommandGroup && opt.options) {
						opt.options.forEach((s: any) => subNames.push(`\`${opt.name} ${s.name}\``));
					}
				});

				if (subNames.length > 0) {
					text += `\n\u3000\u2514 ${subNames.join(' ')}`;
				}
			}

			// Special handling for the 'do' command to show reactions as prefix commands
			if (c.name === 'do' && c.aliases && c.aliases.length > 0) {
				const reactions = c.aliases.slice(0, 15).map(r => `\`${r}\``).join(', ');
				text += `\n\u3000\u2514 **Reactions**: ${reactions}${c.aliases.length > 15 ? '...' : ''}`;
			}

			return text;
		}).join('\n\n');

		const categoryEmoji = Help.getCategoryEmoji(category, client);
		const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

		const buttons: ButtonBuilder[] = [];

		if (totalPages > 1) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`help_page_${category}_${currentPage - 1}`)
					.setLabel('Previous')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(currentPage <= 1)
			);
		}

		buttons.push(
			new ButtonBuilder()
				.setCustomId('help_back')
				.setLabel('Back to Hub')
				.setStyle(ButtonStyle.Secondary)
		);

		if (totalPages > 1) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`help_page_${category}_${currentPage + 1}`)
					.setLabel('Next')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(currentPage >= totalPages)
			);
		}

		return {
			title: `${categoryEmoji} **${categoryName}** · ${totalCommands} commands`,
			description: commandsList || 'No visible commands in this module.',
			borderless: true,
			color: null,
			footer: totalPages > 1 
				? `Page ${currentPage} of ${totalPages} • Use /help <command> for syntax` 
				: `Use /help <command> for detailed syntax`,
			buttons
		};
	}

	public static getCategoryEmoji(category: string, client: ExtendedClient): string {
		switch(category.toLowerCase()) {
			case 'general': return client.emoji.system_info;
			case 'info': return client.emoji.system_info;
			case 'moderation': return client.emoji.mod_ban;
			case 'music': return client.emoji.music_headphones;
			case 'fun': return client.emoji.fun_game;
			case 'tools': return client.emoji.tool_wrench;
			case 'systems': return client.emoji.system_cpu;
			case 'voice': return client.emoji.vc_create;
			case 'config': return client.emoji.vc_settings;
			case 'management': return client.emoji.user;
			case 'utility': return client.emoji.search_glass;
			case 'social': return client.emoji.marriage_heart;
			case 'owner': return client.emoji.crown_owner;
			case 'tickets': return client.emoji.ticket_pass;
			case 'leveling': return client.emoji.level_trophy;
			case 'giveaway': return client.emoji.giveaway_gift;
			case 'marriage': return client.emoji.marriage_ring;
			case 'dev': return client.emoji.system_bot;
			default: return client.emoji.folder_module;
		}
	}

	public static getCategoryMenuEmoji(category: string, client: ExtendedClient): string {
		const str = Help.getCategoryEmoji(category, client);
		const idMatch = str.match(/\d+/)?.[0];
		return idMatch || str;
	}
}
