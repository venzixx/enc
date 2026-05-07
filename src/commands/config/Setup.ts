import { 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    PermissionFlagsBits,
    ApplicationCommandOptionType 
} from "discord.js";
import { Command, Context } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class Setup extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: "setup",
            description: {
                content: "Central configuration hub for all bot modules.",
                examples: ["setup", "setup music"],
                usage: "setup",
            },
            category: "config",
            aliases: ["config", "dashboard"],
            cooldown: 5,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
            },
            slashCommand: true,
            options: [
                {
                    name: "music",
                    description: "Set up the music song-request channel.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "action",
                            description: "Create or delete the music channel",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: "Create", value: "create" },
                                { name: "Delete", value: "delete" }
                            ]
                        }
                    ]
                }
            ],
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const subCommand = ctx.options.getSubcommand();

        if (subCommand === 'music') {
            const action = ctx.options.getString('action');
            // Handle legacy music setup logic if needed, or just redirect
            return await ctx.replyV2({
                title: "Music Setup Redirect",
                description: `Use the setup dashboard to manage music and all other modules!`,
                isAlert: true
            });
        }

        return await ctx.replyV2(this.getDashboardLayout());
    }

    private getDashboardLayout() {
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

        return {
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
        };
    }
}
