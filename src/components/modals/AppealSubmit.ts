import { ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class AppealSubmit extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: "appeal_submit"
        });
    }

    public async run(interaction: ModalSubmitInteraction): Promise<any> {
        const parts = interaction.customId.split("_");
        const guildId = parts[2];
        const type = parts[3];
        const appealReason = interaction.fields.getTextInputValue("appeal_reason");

        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = await this.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                return await interaction.editReply({ content: "I couldn't find the server you are appealing for." });
            }

            await this.client.prisma.appeal.create({
                data: {
                    guildId: guildId,
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    type: type,
                    reason: "Automated appeal submission",
                    appealReason: appealReason,
                    status: "PENDING"
                }
            });

            const successEmbed = new EmbedBuilder()
                .setTitle(`${this.client.emoji.success} Appeal Submitted`)
                .setDescription(`Your appeal for **${guild.name}** has been successfully submitted and is now pending review by the staff.`)
                .addFields({ name: `${this.client.emoji.info} Explanation`, value: appealReason })
                .setColor(this.client.color.green)
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });
            
        } catch (error) {
            console.error("Error in appeal_submit:", error);
            await interaction.editReply({ content: "There was an error processing your appeal. Please try again later." });
        }
    }
}
