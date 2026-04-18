import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class OwnerTransfer extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'owner',
			description: {
				content: 'Transfer ownership of your temporary voice channel.',
				usage: 'owner <user>',
				examples: ['owner @user']
			},
			category: 'owner',
			cooldown: 5,
			slashCommand: true,
			permissions: {
				client: [PermissionFlagsBits.ManageChannels]
			},
			options: [
				{
					name: 'user',
					description: 'The user to transfer ownership to',
					type: 6, // USER
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        if (!ctx.guild) return;
        const member = ctx.member as any;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return await ctx.reply({ content: ' You must be in your temporary voice channel to transfer ownership.', ephemeral: true });
        }

        const tempVoice = await (client.prisma as any).tempVoice.findUnique({
            where: { channelId: voiceChannel.id }
        });

        if (!tempVoice) {
            return await ctx.reply({ content: ' This is not a temporary voice channel.', ephemeral: true });
        }

        if (tempVoice.ownerId !== ctx.author.id && !ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return await ctx.reply({ content: ' Only the current owner or an Admin can transfer ownership.', ephemeral: true });
        }

        const targetUser = ctx.options.getUser('user');
        if (!targetUser) return await ctx.reply({ content: ' User not found.', ephemeral: true });

        if (targetUser.bot) {
            return await ctx.reply({ content: ' You cannot transfer ownership to a bot.', ephemeral: true });
        }

        if (targetUser.id === ctx.author.id) {
            return await ctx.reply({ content: ' You are already the owner!', ephemeral: true });
        }

        // Check if target is in the VC
        if (!voiceChannel.members.has(targetUser.id)) {
            return await ctx.reply({ content: ' The target user must be inside the voice channel to receive ownership.', ephemeral: true });
        }

        // Update DB
        await (client.prisma as any).tempVoice.update({
            where: { channelId: voiceChannel.id },
            data: { ownerId: targetUser.id }
        });

        // Update Channel Permissions
        await (voiceChannel as any).permissionOverwrites.edit(ctx.author.id, {
            ManageChannels: null,
            MoveMembers: null
        });
        await (voiceChannel as any).permissionOverwrites.edit(targetUser.id, {
            ManageChannels: true,
            MoveMembers: true
        });

        await ctx.reply({ content: `${client.emoji.success} Ownership of the channel has been transferred to ${targetUser}.` });
	}
}
