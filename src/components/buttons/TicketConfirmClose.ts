import { type ButtonInteraction, PermissionFlagsBits, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";
import { TicketTranscript } from "../../utils/TicketTranscript";

export default class TicketConfirmClose extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_confirm_close",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;

        // Fetch ticket from DB
        const ticket = await (this.client.prisma as any).ticket.findUnique({
            where: { channelId: interaction.channel.id }
        });

        if (!ticket) {
            return await interaction.reply({ 
                ...V2Helper.createLayout({
                    title: `${this.client.emoji.cross || '❌'} Not Found`,
                    description: 'Ticket data not found in database. This channel might not be a registered ticket.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any
            });
        }

        if (ticket.status === 'CLOSED') {
            return await interaction.reply({ 
                ...V2Helper.createLayout({
                    title: `${this.client.emoji.cross || '❌'} Already Closing`,
                    description: 'This ticket is already in the process of closing.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any
            });
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

        const member = interaction.member ? interaction.member as any : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const isCreator = ticket.userId === interaction.user.id;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
        const isStaff = config?.supportRoleId ? member?.roles?.cache?.has(config.supportRoleId) : false;

        if (!isCreator && !isAdmin && !isStaff) {
            return await interaction.reply({ 
                ...V2Helper.createLayout({
                    title: `${this.client.emoji.cross || '❌'} Permission Denied`,
                    description: 'Only the ticket creator or server support staff can close this ticket.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any
            });
        }

        const transcriptEnabled = config ? config.transcriptEnabled : true;
        const transcriptDM = config ? config.transcriptDM : true;
        const transcriptChannelId = config ? config.transcriptChannelId : null;

        // Immediately update interaction to Closing State (removes buttons automatically)
        const closingLayout = V2Helper.createLayout({
            title: '⏳ Closing Ticket',
            description: 'Generating HTML transcript and closing channel...',
            isAlert: true,
            borderless: true,
            color: null
        });

        await interaction.update(closingLayout as any).catch(async () => {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate().catch(() => {});
            }
        });

        const channel = interaction.channel as TextChannel;
        if (!channel) return;

        // Generate Modern HTML Transcript
        let transcriptFile: AttachmentBuilder | null = null;
        if (transcriptEnabled) {
            try {
                transcriptFile = await TicketTranscript.generate(channel, ticket, {
                    closer: interaction.user
                });
            } catch (err) {
                console.error('Failed to generate HTML transcript:', err);
            }
        }

        if (transcriptEnabled && transcriptFile) {
            // DM Creator
            if (transcriptDM) {
                try {
                    const creator = await interaction.guild?.members.fetch(ticket.userId).catch(() => null);
                    if (creator) {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle(`📁 Ticket Closed: #${channel.name}`)
                            .setDescription(`Your ticket in **${interaction.guild?.name}** has been closed.\n\nA full HTML transcript of the conversation has been attached below for your records.`)
                            .setColor(0x9333ea);

                        await creator.send({ 
                            embeds: [dmEmbed],
                            files: [transcriptFile]
                        }).catch((err) => {
                            console.error('Failed to DM transcript to user:', err);
                        });
                    }
                } catch (err) {
                    console.log('Failed to DM transcript to user:', err);
                }
            }

            // Send to log channel
            if (transcriptChannelId) {
                try {
                    const logChannel = await interaction.guild?.channels.fetch(transcriptChannelId).catch(() => null);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📁 Ticket Closed & Archived')
                            .setDescription(
                                `Ticket **#${channel.name}** has been closed.\n\n` +
                                `• **Creator:** <@${ticket.userId}> (\`${ticket.userId}\`)\n` +
                                `• **Closed By:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                                `• **Closed At:** <t:${Math.floor(Date.now() / 1000)}:F>`
                            )
                            .setColor(0x9333ea);

                        await (logChannel as any).send({
                            embeds: [logEmbed],
                            files: [transcriptFile],
                            allowedMentions: { parse: [], roles: [], users: [] }
                        }).catch((err: any) => {
                            console.error('Failed to send transcript to log channel:', err);
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
        }).catch(() => {});

        // Delete Channel after 3 seconds
        setTimeout(async () => {
            await channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
        }, 3000);
	}
}
