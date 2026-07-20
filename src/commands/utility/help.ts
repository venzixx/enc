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
		const commandName = ctx.options.getString('command') || _args[0];

		if (commandName) {
			return await this.showCommandDetail(client, ctx, commandName);
		}

		await ctx.replyV2(Help.getHomeLayout(client));
	}

	/**
	 * Shows detailed information about a specific command.
	 */
	private async showCommandDetail(client: ExtendedClient, ctx: Context, commandName: string): Promise<any> {
		const command = client.commands.get(commandName) || client.commands.find(c => c.aliases.includes(commandName));
		if (!command) {
			return await ctx.replyV2({ 
				title: 'Command Not Found', 
				description: `${client.emoji.cross} No command found matching \`${commandName}\`.`,
				isAlert: true,
				color: 0xFF0000,
				ephemeral: true
			});
		}

		const lines: string[] = [
			command.description.content,
			'',
			`${client.emoji.edit} **Module** · \`${command.category}\`　　${client.emoji.clock} **Cooldown** · \`${command.cooldown}s\``,
			`${client.emoji.info} **Usage** · \`/${command.name} ${command.description.usage}\``,
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
		if (command.description.examples && command.description.examples.length > 0) {
			lines.push('', `**Examples**`);
			lines.push(command.description.examples.map((e: string) => `\`/${e}\``).join('　'));
		}

		const layout: any = {
			title: `${Help.getCategoryEmoji(command.category, client)} ${command.name}`,
			description: lines.join('\n'),
			color: client.color.main,
			footer: `Module: ${command.category}`,
			buttons: [
				new ButtonBuilder()
					.setCustomId('help_back')
					.setEmoji(client.emoji.page.back)
					.setLabel('Back')
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
			return `${emoji} **${name}** · ${count} commands`;
		});

		const menu = new StringSelectMenuBuilder()
			.setCustomId('help_category')
			.setPlaceholder('📂 Browse a module...')
			.addOptions(
				categories.map(cat => ({
					label: cat.charAt(0).toUpperCase() + cat.slice(1),
					value: cat,
					description: `View ${visibleCommands.filter(c => c.category === cat).size} commands`,
					emoji: Help.getCategoryEmoji(cat, client)
				}))
			);

		const buttons = [
			new ButtonBuilder()
				.setLabel('Support')
				.setURL('https://discord.gg/zzN2vn6bwd')
				.setStyle(ButtonStyle.Link)
		];

		return {
			title: `**Enc** · Command Hub`,
			description: [
				`Browse **${totalCommands}** commands across **${categories.length}** modules.`,
				`Select a module below or use \`/help <command>\` for details.`,
				'',
				categoryLines.join('\n'),
			].join('\n'),
			color: client.color.main,
			footer: `Premium Utility • Monochromatic V2 Engine`,
			selectMenu: menu,
			buttons
		} as any;
	}

	/**
	 * Builds the category view layout for a selected module.
	 */
	public static getCategoryLayout(client: ExtendedClient, category: string) {
		const commands = client.commands.filter(c => c.category === category && !c.hidden);

		const commandsList = commands.map(c => {
			let text = `**\`/${c.name}\`** · ${c.description.content}`;

			// Special handling for the 'do' command to show reactions as prefix commands
			if (c.name === 'do') {
				const reactions = c.aliases.map(r => `\`${r}\``).join(', ');
				text += `\n\u3000\u2514 **Prefix Reactions**: ${reactions}`;
			}
			
			if (c.options && c.options.length > 0 && c.name !== 'do') {
				const subItems = c.options.filter((opt: any) => 
					opt.type === ApplicationCommandOptionType.Subcommand || 
					opt.type === ApplicationCommandOptionType.SubcommandGroup
				);

				if (subItems.length > 0) {
					subItems.forEach((sub: any) => {
						if (sub.type === ApplicationCommandOptionType.Subcommand) {
							text += `\n\u3000\u2514 \`/${c.name} ${sub.name}\` · ${sub.description}`;
						} else if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
							if (sub.options) {
								sub.options.forEach((s: any) => {
									text += `\n\u3000\u2514 \`/${c.name} ${sub.name} ${s.name}\` · ${s.description}`;
								});
							}
						}
					});
				}
			}
			return text;
		}).join('\n\n');

		const categoryEmoji = Help.getCategoryEmoji(category, client);
		const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

		return {
			title: `${categoryEmoji} **${categoryName}** · ${commands.size} commands`,
			description: commandsList || 'No visible commands in this module.',
			color: client.color.main,
			footer: `Use /help <command> for detailed info`,
			buttons: [
				new ButtonBuilder()
					.setCustomId('help_back')
					.setEmoji(client.emoji.page.back)
					.setLabel('Back')
					.setStyle(ButtonStyle.Secondary)
			]
		};
	}

	public static getCategoryEmoji(category: string, client: ExtendedClient): string {
		switch(category.toLowerCase()) {
			case 'general': return client.emoji.info;
			case 'info': return client.emoji.info;
			case 'moderation': return client.emoji.shield;
			case 'music': return client.emoji.music;
			case 'fun': return client.emoji.random;
			case 'tools': return client.emoji.edit;
			case 'systems': return client.emoji.edit;
			case 'voice': return client.emoji.mic;
			case 'config': return client.emoji.edit;
			case 'management': return client.emoji.user;
			case 'utility': return client.emoji.edit;
			case 'social': return client.emoji.user;
			case 'owner': return client.emoji.rank;
			case 'tickets': return client.emoji.edit;
			case 'leveling': return client.emoji.rank;
			case 'giveaway': return client.emoji.random;
			case 'marriage': return client.emoji.user;
			case 'dev': return client.emoji.hammer;
			default: return client.emoji.info;
		}
	}
}
