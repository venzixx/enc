import { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
		const commandName = ctx.options.getString('command');

		if (commandName) {
			const command = client.commands.get(commandName) || client.commands.find(c => c.aliases.includes(commandName));
			if (!command) {
				return await ctx.replyV2({ 
                    title: '\uD83D\uDCD6 Help Error', 
                    description: `\u274C Command \`${commandName}\` not found.`,
                    isAlert: true,
                    color: 0xFF0000,
                    ephemeral: true
                });
			}

			return await ctx.replyV2({
                title: `\uD83D\uDCD6 Command: ${command.name}`,
                description: command.description.content,
                fields: [
					{ name: '\uD83D\uDCC2 Module', value: `\`${command.category}\``, inline: true },
					{ name: '\u23F3 Cooldown', value: `\`${command.cooldown}s\``, inline: true },
					{ name: '\uD83D\uDEE0\uFE0F Usage', value: `\`/${command.name} ${command.description.usage}\``, inline: false },
					{ name: '\uD83D\uDCA1 Examples', value: command.description.examples.map(e => `\`/${e}\``).join('\n'), inline: false }
                ],
                color: client.color.main,
                image: 'https://i.imgur.com/uC0aLz1.png'
            });
		}

		// Use replyV2 to ensure the home layout is rendered correctly as Type 17
		await ctx.replyV2(Help.getHomeLayout(client));
	}

    public static getHomeLayout(client: ExtendedClient) {
		const totalCategories = [...new Set(client.commands.map(c => c.category))].length;
		const totalCommands = client.commands.size;
		const categories = [...new Set(client.commands.map(c => c.category))].sort();
		
		const menu = new StringSelectMenuBuilder()
			.setCustomId('help_category')
			.setPlaceholder('\uD83D\uDCC2 Select a Module...')
			.addOptions(
				categories.map(cat => ({
					label: cat.charAt(0).toUpperCase() + cat.slice(1),
					value: cat,
					description: `Explore all ${cat} commands`,
                    emoji: Help.getCategoryEmoji(cat)
				}))
			);

        const buttons = [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('Support')
                    .setURL('https://discord.gg/encl')
                    .setStyle(ButtonStyle.Link)
            )
        ];

		return {
            title: '\uD83D\uDEE0\uFE0F **Enc Command Hub**',
            description: [
                `\u00BB **Status Report**`,
                `Currently operating with **${totalCategories}** specialized modules and **${totalCommands}** commands.`,
                ``,
                `\u00BB **Feature Modules**`,
                `\`\`\`ansi`,
                `\u001b[0;37m${categories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('  \u2022  ')}\u001b[0m`,
                `\`\`\``,
                ``,
                `\u00BB **Useful Links**`,
                `[Support Server](https://discord.gg/encl)`,
                ``,
                `> Select a module from the menu below to explore.`
            ].join('\n'),
            color: client.color.main,
            footer: 'Premium Utility \u2022 Monochromatic V2 Engine',
            selectMenu: menu,
            actionRows: buttons
        } as any;
    }

    public static getCategoryEmoji(category: string): string {
        switch(category.toLowerCase()) {
            case 'general': return '\uD83C\uDF10';
            case 'info': return '\u2139\uFE0F';
            case 'moderation': return '\uD83D\uDEE1\uFE0F';
            case 'music': return '\uD83C\uDFB5';
            case 'fun': return '\uD83C\uDFAE';
            case 'tools': return '\uD83D\uDEE0\uFE0F';
            case 'systems': return '\u2699\uFE0F';
            case 'voice': return '\uD83D\uDD0A';
            case 'config': return '\u2699\uFE0F';
            case 'management': return '\uD83D\uDC54';
            case 'utility': return '\uD83D\uDD27';
            case 'social': return '\uD83D\uDCAC';
            case 'owner': return '\uD83D\uDC51';
            case 'tickets': return '\uD83C\uDFAB';
            case 'leveling': return '\uD83D\uDCC8';
            case 'giveaway': return '\uD83C\uDF89';
            default: return '\uD83D\uDCC1';
        }
    }
}
