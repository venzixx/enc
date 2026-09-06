import { type ButtonInteraction, PermissionFlagsBits } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class TicketCancelClose extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_cancel_close",
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
                    description: 'Ticket data not found.',
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
                    description: 'Only the ticket creator or server support staff can cancel ticket closure.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any 
            });
        }

        const cancelLayout = V2Helper.createLayout({
            title: `${this.client.emoji.success || '✅'} Ticket Closure Cancelled`,
            description: 'The ticket will remain open.',
            borderless: true,
            color: null
        });

        await interaction.update(cancelLayout as any).catch(async () => {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate().catch(() => {});
            }
        });
	}
}
