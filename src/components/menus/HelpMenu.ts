import { type StringSelectMenuInteraction } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";
import Help from "../../commands/utility/Help";

export default class HelpMenu extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "help_category",
		});
	}

	public async run(interaction: StringSelectMenuInteraction): Promise<any> {
		const category = interaction.values[0];

		// Use the centralized category layout from Help command
		const layoutOptions = Help.getCategoryLayout(this.client, category);
		const layout = V2Helper.createLayout(layoutOptions);

		await interaction.update(layout as any).catch((err) => {
			console.error('Failed to update help menu:', err);
		});
	}
}
