import { PermissionFlagsBits, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class Close extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'close',
            aliases: ['ticketclose', 'tclose'],
            description: {
                content: 'Close the current ticket channel.',
                usage: 'close',
                examples: ['close']
            },
            category: 'tickets',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                client: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages]
            }
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild || !ctx.channel) return;

        const ticket = await (client.prisma as any).ticket.findUnique({ 
            where: { channelId: ctx.channel.id } 
        });

        if (!ticket) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} This channel is not a registered ticket.`, 
                isAlert: true,
                borderless: true 
            });
        }

        if (ticket.status === 'CLOSED') {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} This ticket is already in the process of closing.`, 
                isAlert: true,
                borderless: true 
            });
        }

        // Send Persistent Borderless V2 Close Confirmation Layout
        const closePayload = V2Helper.createLayout({
            title: '🔒 Ticket Close Confirmation',
            description: `Are you sure you want to close this ticket?\n\n**Note:** Transcripts will be archived, and this channel will be closed.\n\n<@${ticket.userId}> or Support Staff, please confirm below.`,
            isAlert: true,
            color: 0xFFA500,
            borderless: true,
            buttons: [
                new ButtonBuilder()
                    .setCustomId('ticket_confirm_close')
                    .setLabel('Confirm Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_cancel_close')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            ]
        });

        return await ctx.reply(closePayload as any);
    }
}
