import { type ButtonInteraction, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class TicketClose extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_close",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;

        // Fetch ticket from DB
        const ticket = await (this.client.prisma as any).ticket.findUnique({
            where: { channelId: interaction.channel.id }
        });

        if (!ticket) {
            return await interaction.reply({ content: '❌ Ticket data not found. I can only close processed tickets.', ephemeral: true });
        }

        const response = await interaction.reply({ 
            ...V2Helper.createLayout({
                title: '🔒 Close Confirmation',
                description: `Are you sure you want to close this ticket?\n\n**Note:** A transcript will be sent to <@${ticket.userId}>, and the channel will be deleted.\n\n<@${ticket.userId}>, please confirm if this ticket can be closed.`,
                isAlert: true,
                color: 0xFFA500,
                buttons: [
                    new ButtonBuilder()
                        .setCustomId('confirm_close')
                        .setLabel('Confirm Close')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_close')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                ]
            }) as any,
            fetchReply: true
        });

        const collector = (response as any).createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.customId === 'cancel_close') {
                if (i.user.id !== ticket.userId && !i.memberPermissions?.has('Administrator')) {
                    return await i.reply({ content: '❌ Only the ticket creator or an Admin can cancel the closure.', ephemeral: true });
                }
                await i.update({ content: '✅ Closure cancelled.', embeds: [], components: [] });
                return collector.stop('cancelled');
            }

            if (i.customId === 'confirm_close') {
                await i.update({ content: '🔒 Closing ticket and generating transcript...', embeds: [], components: [] });
                collector.stop('confirmed');
            }
        });

        collector.on('end', async (collected: any, reason: string) => {
            if (reason === 'cancelled') return;

            // Handle auto-close or confirmed close
            const channel = interaction.channel as any;
            if (!channel) return;

            // Generate Transcript
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcriptContent = messages.reverse().map((m: any) => 
                `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || (m.embeds.length > 0 ? '[Embed]' : '[No Content]')}`
            ).join('\n');

            const transcriptFile = new AttachmentBuilder(Buffer.from(transcriptContent), { name: `transcript-${channel.name}.txt` });

            // DM Creator
            try {
                const creator = await interaction.guild?.members.fetch(ticket.userId);
                if (creator) {
                    await creator.send({ 
                        content: `👋 Your ticket **#${channel.name}** in **${interaction.guild?.name}** has been closed. Here is your transcript:`,
                        files: [transcriptFile]
                    });
                }
            } catch (err) {
                console.log('Failed to DM transcript to user:', err);
            }

            // Update DB
            await (this.client.prisma as any).ticket.update({
                where: { id: ticket.id },
                data: { status: 'CLOSED' }
            });

            // Delete Channel after a short delay
            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);
        });
	}
}
