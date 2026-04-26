import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonInteraction 
} from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class AppealInit extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: "appeal_init"
        });
    }

    public async run(interaction: ButtonInteraction): Promise<any> {
        const parts = interaction.customId.split("_");
        const guildId = parts[2];
        const type = parts[3];

        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return await interaction.reply({ 
                content: `${this.client.emoji.cross} I can no longer find the server you are appealing for. Please use the **Appeal via Web** button instead.`, 
                ephemeral: true 
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`appeal_submit_${guildId}_${type}`)
            .setTitle(`Appeal ${type}`);

        const appealInput = new TextInputBuilder()
            .setCustomId("appeal_reason")
            .setLabel("Why should your sanction be reviewed?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Provide a detailed explanation of why you believe this sanction was unfair or should be lifted...")
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(appealInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }
}
