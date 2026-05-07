import { StringSelectMenuInteraction, ButtonBuilder, ButtonStyle } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";
import { env } from "../../env";

export default class SetupMenu extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: "setup_category",
        });
    }

    public async run(interaction: StringSelectMenuInteraction): Promise<any> {
        const category = interaction.values[0];
        const prefix = env.PREFIX || "e!";

        const backButton = new ButtonBuilder()
            .setCustomId("setup_back")
            .setLabel("Back to Dashboard")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("⬅️");

        let title = "";
        let description = "";
        let fields: { name: string, value: string }[] = [];

        switch (category) {
            case "setup_general":
                title = "⚙️ General Setup";
                description = "Configure the basic settings for your server.";
                fields = [
                    { name: "Prefix", value: `Use \`${prefix}prefix <new_prefix>\` to change the bot's prefix.` },
                    { name: "Greeter", value: `Use \`${prefix}welcome-setup\` to configure join/leave messages.` },
                    { name: "Join DM", value: `Use \`${prefix}joindm-setup\` to send a DM to new members.` }
                ];
                break;
            case "setup_mod":
                title = "🛡️ Moderation Setup";
                description = "Keep your server safe with these powerful tools.";
                fields = [
                    { name: "Auto-Mod", value: `Use \`${prefix}automod\` to configure spam/link filters.` },
                    { name: "Anti-Nuke", value: `Use \`${prefix}antinuke\` to protect against malicious admins.` },
                    { name: "Logging", value: `Use \`${prefix}log-setup\` to track member actions and message edits.` },
                    { name: "Verification", value: `Use \`${prefix}verify-setup\` to set up captcha/button verification.` }
                ];
                break;
            case "setup_social":
                title = "🎭 Social Setup";
                description = "Enhance server activity with fun interactions.";
                fields = [
                    { name: "Counting", value: `Use \`${prefix}counting-setup\` to start a counting game.` },
                    { name: "Story", value: `Use \`${prefix}story-setup\` to build collaborative stories.` },
                    { name: "Social Reactions", value: `Reactions like \`,hug\` and \`,slap\` are enabled by default!` }
                ];
                break;
            case "setup_utility":
                title = "🛠️ Utility Setup";
                description = "Tools to improve your server's workflow.";
                fields = [
                    { name: "Suggestions", value: `Use \`${prefix}suggestion-setup\` to collect user feedback.` },
                    { name: "Starboard", value: `Use \`${prefix}starboard-setup\` to highlight great messages.` },
                    { name: "Leveling", value: `Use \`${prefix}level-setup\` to configure the XP system.` },
                    { name: "Confessions", value: `Use \`${prefix}confess-setup\` for anonymous messages.` }
                ];
                break;
            case "setup_music":
                title = "🎵 Music Setup";
                description = "Configure the best music experience for your members.";
                fields = [
                    { name: "Request Channel", value: `Use \`/setup music action:Create\` to make a dedicated song-request channel.` },
                    { name: "DJ Roles", value: `Use \`${prefix}config dj\` to restrict music commands to specific roles.` }
                ];
                break;
        }

        const layout = V2Helper.createLayout({
            title: title,
            description: description,
            fields: fields,
            color: this.client.color.main,
            buttons: [backButton]
        });

        await interaction.update(layout as any);
    }
}
