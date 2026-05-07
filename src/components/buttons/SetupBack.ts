import { ButtonInteraction, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class SetupBack extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: "setup_back",
        });
    }

    public async run(interaction: ButtonInteraction): Promise<any> {
        const menu = new StringSelectMenuBuilder()
            .setCustomId("setup_category")
            .setPlaceholder("Select a category to configure...")
            .addOptions([
                {
                    label: "General Settings",
                    description: "Prefix, Welcomer, and Basic Info",
                    value: "setup_general",
                    emoji: "⚙️"
                },
                {
                    label: "Moderation & Safety",
                    description: "Auto-Mod, Anti-Nuke, and Logging",
                    value: "setup_mod",
                    emoji: "🛡️"
                },
                {
                    label: "Social & Expressions",
                    description: "Reactions, Counting, and Story",
                    value: "setup_social",
                    emoji: "🎭"
                },
                {
                    label: "Utility & Engagement",
                    description: "Starboard, Suggestions, and Leveling",
                    value: "setup_utility",
                    emoji: "🛠️"
                },
                {
                    label: "Music & Multimedia",
                    description: "Song Requests and Player Config",
                    value: "setup_music",
                    emoji: "🎵"
                }
            ]);

        const layout = V2Helper.createLayout({
            title: "Server Setup Dashboard",
            description: [
                "Welcome to the **Enc Control Panel**. Use the menu below to configure each module of the bot for your server.",
                "",
                "### 🚀 Getting Started",
                "• **General**: Set your custom prefix and welcome messages.",
                "• **Moderation**: Enable powerful protection for your server.",
                "• **Social**: Configure the anime reaction system and games.",
                "",
                "> Select a category below to see detailed setup commands."
            ].join("\n"),
            color: this.client.color.main,
            thumbnail: this.client.user?.displayAvatarURL(),
            selectMenu: menu,
            footer: "Enc Management Suite • Monochromatic V2"
        });

        await interaction.update(layout as any);
    }
}
