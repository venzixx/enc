import { type VoiceState, ChannelType, PermissionFlagsBits, Events } from "discord.js";
import { Event } from "../../structures";
import { ExtendedClient } from "../../client";
import { LavamusicEventType } from "../../types/events";

export default class VoiceStateUpdate extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			name: Events.VoiceStateUpdate,
			type: LavamusicEventType.Client,
		});
	}

	public async run(oldState: VoiceState, newState: VoiceState): Promise<any> {
		const { guild, member } = newState;
		if (!guild || !member || member.user.bot) return;

        // Fetch config
        const config = await (this.client.prisma as any).voiceConfig.findUnique({
            where: { guildId: guild.id }
        });

        if (!config) return;

        // 1) JOIN TO CREATE Logic
        if (newState.channelId === config.createChannelId) {
            try {
                const tempChannel = await guild.channels.create({
                    name: `${member.user.username}'s Channel`,
                    type: ChannelType.GuildVoice,
                    parent: config.categoryId,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                        },
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MoveMembers],
                        }
                    ]
                });

                // Move member to the new channel
                await member.voice.setChannel(tempChannel);

                // Save to DB
                await (this.client.prisma as any).tempVoice.create({
                    data: {
                        guildId: guild.id,
                        channelId: tempChannel.id,
                        ownerId: member.id
                    }
                });
            } catch (error) {
                console.error('Error creating temp voice channel:', error);
            }
        }

        // 2) CLEANUP Logic
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            const oldChannel = oldState.channel;
            if (oldChannel && oldChannel.members.size === 0) {
                // Check if it's a temp voice channel
                const tempVoice = await (this.client.prisma as any).tempVoice.findUnique({
                    where: { channelId: oldChannel.id }
                });

                if (tempVoice) {
                    try {
                        await oldChannel.delete();
                        await (this.client.prisma as any).tempVoice.delete({
                            where: { channelId: oldChannel.id }
                        });
                    } catch (error) {
                        console.error('Error deleting empty temp voice channel:', error);
                    }
                }
            }
        }
	}
}
