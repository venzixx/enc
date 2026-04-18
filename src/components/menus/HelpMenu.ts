import { type StringSelectMenuInteraction, ButtonBuilder, ButtonStyle } from "discord.js";
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

		const layout = V2Helper.createLayout({
			title: `${this.client.emoji.edit} **Module: ${category.charAt(0).toUpperCase() + category.slice(1)}**`,
			description: [
                `\u00BB **Commands in this module**`,
                ...commands.map(c => `**\`/${c.name}\`** \u2022 ${c.description.content}`)
            ].join('\n'),
			color: this.client.color.main,
            buttons
		});

		await interaction.update(layout as any);
	}
}
