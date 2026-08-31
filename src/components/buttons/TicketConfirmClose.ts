import { type ButtonInteraction, PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

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
                    description: `${this.client.emoji.cross || '❌'} Ticket data not found in database. This channel might not be a registered ticket.`,
                    isAlert: true,
                    borderless: true
                }) as any, 
                ephemeral: true 
            });
        }

        if (ticket.status === 'CLOSED') {
            return await interaction.reply({ 
                content: `${this.client.emoji.cross || '❌'} This ticket is already in the process of closing.`, 
                ephemeral: true 
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

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const isCreator = ticket.userId === interaction.user.id;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
        const isStaff = config?.supportRoleId ? member?.roles.cache.has(config.supportRoleId) : false;

        if (!isCreator && !isAdmin && !isStaff) {
            return await interaction.reply({ 
                content: `${this.client.emoji.cross || '❌'} Only the ticket creator or server support staff can close this ticket.`, 
                ephemeral: true 
            });
        }

        const transcriptEnabled = config ? config.transcriptEnabled : true;
        const transcriptDM = config ? config.transcriptDM : true;
        const transcriptChannelId = config ? config.transcriptChannelId : null;

        // Update close message to closing state
        await interaction.update({
            ...V2Helper.createLayout({
                title: '⏳ Closing Ticket',
                description: 'Generating transcript and closing channel in 5 seconds...',
                isAlert: true,
                color: 0xFFA500,
                borderless: true
            }) as any,
            components: []
        }).catch(() => {});

        const channel = interaction.channel as any;
        if (!channel) return;

        // Generate Transcript
        let transcriptFile: AttachmentBuilder | null = null;
        if (transcriptEnabled) {
            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                const transcriptContent = messages.reverse().map((m: any) => 
                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || (m.embeds.length > 0 ? '[Embed]' : '[No Content]')}`
                ).join('\n');

                transcriptFile = new AttachmentBuilder(Buffer.from(transcriptContent), { name: `transcript-${channel.name}.txt` });
            } catch (err) {
                console.error('Failed to generate transcript:', err);
            }
        }

        if (transcriptEnabled && transcriptFile) {
            // DM Creator
            if (transcriptDM) {
                try {
                    const creator = await interaction.guild?.members.fetch(ticket.userId).catch(() => null);
                    if (creator) {
                        await creator.send({ 
                            content: `Your ticket **#${channel.name}** in **${interaction.guild?.name}** has been closed. Here is your transcript:`,
                            files: [transcriptFile]
                        }).catch(() => {});
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
                        await (logChannel as any).send({
                            content: `Transcript for closed ticket **#${channel.name}** (Opened by <@${ticket.userId}>, Closed by ${interaction.user}):`,
                            files: [transcriptFile]
                        }).catch(() => {});
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

        // Delete Channel after 4 seconds
        setTimeout(async () => {
            await channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
        }, 4000);
	}
}
