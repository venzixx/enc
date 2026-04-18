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
                    title: 'Help Error', 
                    description: `${client.emoji.cross} Command \`${commandName}\` not found.`,
                    isAlert: true,
                    color: 0xFF0000,
                    ephemeral: true
                });
			}

			return await ctx.replyV2({
                title: `Command: ${command.name}`,
                description: command.description.content,
                fields: [
					{ name: `${client.emoji.edit} Module`, value: `\`${command.category}\``, inline: true },
					{ name: `${client.emoji.clock} Cooldown`, value: `\`${command.cooldown}s\``, inline: true },
					{ name: `${client.emoji.edit} Usage`, value: `\`/${command.name} ${command.description.usage}\``, inline: false },
					{ name: `${client.emoji.info} Examples`, value: command.description.examples.map(e => `\`/${e}\``).join('\n'), inline: false }
                ],
                color: client.color.main,
                image: 'https://i.imgur.com/uC0aLz1.png'
            });
		}

		// Use replyV2 to ensure the home layout is rendered correctly as Type 17
		await ctx.replyV2(Help.getHomeLayout(client));
	}

    public static getHomeLayout(client: ExtendedClient) {
		const visibleCommands = client.commands.filter(c => !c.hidden);
		const totalCategories = [...new Set(visibleCommands.map(c => c.category))].length;
		const totalCommands = visibleCommands.size;
		const categories = [...new Set(visibleCommands.map(c => c.category))].sort();
		
		const menu = new StringSelectMenuBuilder()
			.setCustomId('help_category')
			.setPlaceholder('Select a Module...')
			.addOptions(
				categories.map(cat => ({
					label: cat.charAt(0).toUpperCase() + cat.slice(1),
					value: cat,
					description: `Explore all ${cat} commands`,
                    emoji: Help.getCategoryEmoji(cat, client)
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
            title: `**Enc Command Hub**`,
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
            default: return client.emoji.info;
        }
    }
}
