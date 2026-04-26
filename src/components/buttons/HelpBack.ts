import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";
import Help from "../../commands/utility/Help";

export default class HelpBack extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "help_back",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
        // Restore the main help layout
        const homeLayout = Help.getHomeLayout(this.client);
        
        // Convert the layout to raw JSON using V2Helper
        const layout = V2Helper.createLayout(homeLayout);

		await interaction.update(layout as any);
	}
}
