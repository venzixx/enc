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
            return await interaction.reply({ content: `${this.client.emoji.cross} Ticket data not found. I can only close processed tickets.`, ephemeral: true });
        }

        // Fetch TicketConfig
        let config = null;
        if (ticket.panelId) {
            config = await (this.client.prisma as any).ticketConfig.findUnique({
                where: {
                    guildId_panelId: {
                        guildId: ticket.guildId,
                        panelId: ticket.panelId
                    }
                }
            });
        }
        if (!config) {
            config = await (this.client.prisma as any).ticketConfig.findFirst({
                where: { guildId: ticket.guildId }
            });
        }

        const useV2 = config ? config.useV2 : false;
        const transcriptEnabled = config ? config.transcriptEnabled : true;
        const transcriptDM = config ? config.transcriptDM : true;
        const transcriptChannelId = config ? config.transcriptChannelId : null;

        // Deciding Close Confirmation Layout based on useV2
        let closePayload: any = {};
        if (useV2) {
            closePayload = V2Helper.createLayout({
                title: ' Close Confirmation',
                description: `Are you sure you want to close this ticket?\n\n**Note:** Transcripts will be sent based on panel settings, and the channel will be deleted.\n\n<@${ticket.userId}>, please confirm if this ticket can be closed.`,
                isAlert: true,
                color: 0xFFA500,
                buttons: [
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                ]
            }) as any;
        } else {
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Close Confirmation')
                .setDescription(`Are you sure you want to close this ticket?\n\n**Note:** Transcripts will be sent based on panel settings, and the channel will be deleted.\n\n<@${ticket.userId}>, please confirm if this ticket can be closed.`)
                .setColor(0xFFA500);

            const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            closePayload = {
                embeds: [confirmEmbed],
                components: [confirmRow]
            };
        }

        const response = await interaction.reply({ 
            ...closePayload,
            fetchReply: true
        });

        const collector = (response as any).createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.customId === 'cancel_close') {
                if (i.user.id !== ticket.userId && !i.memberPermissions?.has('Administrator')) {
                    return await i.reply({ content: `${this.client.emoji.cross} Only the ticket creator or an Admin can cancel the closure.`, ephemeral: true });
                }
                if (useV2) {
                    await i.update({ 
                        ...V2Helper.createLayout({
                            title: 'Closure Cancelled',
                            description: 'The ticket will remain open.',
                            isAlert: false,
                            color: 0x22c55e
                        }) as any,
                        components: [] 
                    });
                } else {
                    await i.update({ 
                        embeds: [new EmbedBuilder().setTitle('Closure Cancelled').setDescription('The ticket will remain open.').setColor(0x22c55e)],
                        components: [] 
                    });
                }
                return collector.stop('cancelled');
            }

            if (i.customId === 'confirm_close') {
                if (useV2) {
                    await i.update({ 
                        ...V2Helper.createLayout({
                            title: 'Closing Ticket',
                            description: 'Generating transcript and closing...',
                            isAlert: true,
                            color: 0xFFA500
                        }) as any,
                        components: [] 
                    });
                } else {
                    await i.update({ 
                        embeds: [new EmbedBuilder().setTitle('Closing Ticket').setDescription('Generating transcript and closing...').setColor(0xFFA500)],
                        components: [] 
                    });
                }
                collector.stop('confirmed');
            }
        });

        collector.on('end', async (collected: any, reason: string) => {
            if (reason === 'cancelled') return;

            const channel = interaction.channel as any;
            if (!channel) return;

            // Generate Transcript
            let transcriptFile: AttachmentBuilder | null = null;
            if (transcriptEnabled) {
                const messages = await channel.messages.fetch({ limit: 100 });
                const transcriptContent = messages.reverse().map((m: any) => 
                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || (m.embeds.length > 0 ? '[Embed]' : '[No Content]')}`
                ).join('\n');

                transcriptFile = new AttachmentBuilder(Buffer.from(transcriptContent), { name: `transcript-${channel.name}.txt` });
            }

            if (transcriptEnabled && transcriptFile) {
                // DM Creator
                if (transcriptDM) {
                    try {
                        const creator = await interaction.guild?.members.fetch(ticket.userId);
                        if (creator) {
                            await creator.send({ 
                                content: `Your ticket **#${channel.name}** in **${interaction.guild?.name}** has been closed. Here is your transcript:`,
                                files: [transcriptFile]
                            });
                        }
                    } catch (err) {
                        console.log('Failed to DM transcript to user:', err);
                    }
                }

                // Send to log channel
                if (transcriptChannelId) {
                    try {
                        const logChannel = await interaction.guild?.channels.fetch(transcriptChannelId);
                        if (logChannel && logChannel.isTextBased()) {
                            await (logChannel as any).send({
                                content: `Transcript for closed ticket **#${channel.name}** (Opened by <@${ticket.userId}>):`,
                                files: [transcriptFile]
                            });
                        }
                    } catch (err) {
                        console.log('Failed to send transcript to log channel:', err);
                    }
                }
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
