import { type StringSelectMenuInteraction, ButtonBuilder, ButtonStyle, ApplicationCommandOptionType } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class HelpMenu extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "help_category",
		});
	}

	public async run(interaction: StringSelectMenuInteraction): Promise<any> {
		const category = interaction.values[0];
		const commands = this.client.commands.filter(c => c.category === category && !c.hidden);

        const buttons = [
            new ButtonBuilder()
                .setCustomId('help_back')
                .setEmoji(this.client.emoji.page.back)
                .setLabel('Back to Hub')
                .setStyle(ButtonStyle.Secondary)
        ];

        const commandsList = commands.map(c => {
            let text = `**\`/${c.name}\`** \u2022 ${c.description.content}`;

            // Special handling for the 'do' command to show reactions as prefix commands
            if (c.name === 'do') {
                const reactions = c.aliases.map(r => `\`${r}\``).join(', ');
                text += `\n\u3000\u2514 **Prefix Reactions**: ${reactions}`;
            }
            
            if (c.options && c.options.length > 0 && c.name !== 'do') { // Skip listing 25 subcommands for 'do' to keep it clean
                const subItems = c.options.filter(opt => 
                    opt.type === ApplicationCommandOptionType.Subcommand || 
                    opt.type === ApplicationCommandOptionType.SubcommandGroup
                );

                if (subItems.length > 0) {
                    subItems.forEach(sub => {
                        if (sub.type === ApplicationCommandOptionType.Subcommand) {
                            text += `\n\u3000\u2514 **\`/${c.name} ${sub.name}\`** \u2022 ${sub.description}`;
                        } else if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
                            if (sub.options) {
                                sub.options.forEach(s => {
                                    text += `\n\u3000\u2514 **\`/${c.name} ${sub.name} ${s.name}\`** \u2022 ${s.description}`;
                                });
                            }
                        }
                    });
                }
            }
            return text;
        }).join('\n\n');

		const layout = V2Helper.createLayout({
			title: `${this.client.emoji.edit} **Module: ${category.charAt(0).toUpperCase() + category.slice(1)}**`,
			description: [
                `\u00BB **Commands in this module**`,
                commandsList
            ].join('\n'),
			color: this.client.color.main,
            buttons
		});

		await interaction.update(layout as any);
	}
}
