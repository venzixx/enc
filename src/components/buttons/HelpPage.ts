import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";
import Help from "../../commands/utility/Help";

export default class HelpPage extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "help_page",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		// customId format: help_page_<category>_<page>
		const match = interaction.customId.match(/^help_page_([a-zA-Z0-9_-]+)_(\d+)$/);
		if (!match) return;

		const category = match[1];
		const page = parseInt(match[2], 10) || 1;

		const layoutOptions = Help.getCategoryLayout(this.client, category, page);
		const layout = V2Helper.createLayout(layoutOptions);

		await interaction.update(layout as any).catch((err) => {
			console.error('Failed to update help page:', err);
		});
	}
}
