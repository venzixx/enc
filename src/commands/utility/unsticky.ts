import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Unsticky extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unsticky',
            description: {
                content: 'Remove the sticky message from this channel.',
                usage: 'unsticky',
                examples: ['unsticky']
            },
            category: 'tools',
            cooldown: 3,
            slashCommand: false,
            hidden: true,
            permissions: {
                user: [PermissionFlagsBits.ManageMessages],
                client: [PermissionFlagsBits.ManageMessages]
            }
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const exists = await client.prisma.stickyMessage.findUnique({
            where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } }
        });

        if (!exists) {
            return await ctx.reply({ 
                content: `${client.emoji.info} There is no sticky message configured for this channel.`, 
                ephemeral: true 
            });
        }

        // Delete the last sent message if it exists
        if (exists.lastMsgId) {
            const lastMsg = await ctx.channel.messages.fetch(exists.lastMsgId).catch(() => null);
            if (lastMsg) await lastMsg.delete().catch(() => {});
        }

        await client.prisma.stickyMessage.delete({
            where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } }
        });

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Sticky Removed`)
            .setDescription('The sticky message has been successfully removed from this channel.')
            .setColor(client.color.main)
            .setTimestamp();

        return await ctx.reply({ embeds: [embed] });
    }
}
