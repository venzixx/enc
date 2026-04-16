import { type ButtonInteraction, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, AnySelectMenuInteraction, UserSelectMenuBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class VoiceControl extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "vc", // Matches vc_*
		});
	}

	public async run(interaction: any): Promise<any> {
		if (!interaction.guild || !interaction.member) return;

        // Defer interaction for slow operations (prisma, channel updates)
        if (interaction.isButton() || interaction.isAnySelectMenu()) {
            await interaction.deferUpdate().catch(() => {});
        }

        // Handle Select Menu for Adding User
        if (interaction.isAnySelectMenu() && interaction.customId.startsWith('vc_add_user_')) {
            const channelId = interaction.customId.replace('vc_add_user_', '');
            const channel = interaction.guild.channels.cache.get(channelId) as any;
            if (!channel) return;

            // Check if user is still owner
            const tempVoice = await (this.client.prisma as any).tempVoice.findUnique({
                where: { channelId }
            });

            if (!tempVoice || tempVoice.ownerId !== interaction.user.id) {
                return await interaction.editReply({ 
                    ...V2Helper.createLayout({
                        title: '❌ Error',
                        description: 'You are no longer the owner of this voice channel.',
                        isAlert: true,
                        color: this.client.color.red,
                        ephemeral: true
                    }) as any
                });
            }

            const targetId = (interaction as any).values[0];
            await channel.permissionOverwrites.edit(targetId, {
                Connect: true,
                ViewChannel: true
            });

            return await interaction.editReply({ 
                ...V2Helper.createLayout({
                    title: '✅ User Added',
                    description: `Successfully granted access to <@${targetId}>!`,
                    isAlert: true,
                    color: this.client.color.main,
                    ephemeral: true
                }) as any
            });
        }

        if (!interaction.isButton()) return;

        const member = interaction.member as any;
        const voiceChannel = member.voice.channel;

        // Fetch temp voice channel info
        const tempVoice = await (this.client.prisma as any).tempVoice.findFirst({
            where: { 
                guildId: interaction.guild.id,
                channelId: voiceChannel?.id || '' 
            }
        });

        const action = interaction.customId.replace('vc_', '');

        // Special case: Claim
        if (action === 'claim') {
            if (!voiceChannel) {
                return await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '❌ Voice Error',
                        description: 'You must be in a voice channel to claim it!',
                        isAlert: true,
                        color: this.client.color.red,
                        ephemeral: true
                    }) as any
                });
            }
            
            const currentTempVoice = await (this.client.prisma as any).tempVoice.findUnique({
                where: { channelId: voiceChannel.id }
            });

            if (!currentTempVoice) {
                return await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '❌ Voice Error',
                        description: 'This is not a temporary voice channel.',
                        isAlert: true,
                        color: this.client.color.red,
                        ephemeral: true
                    }) as any
                });
            }

            const ownerInChannel = voiceChannel.members.has(currentTempVoice.ownerId);

            if (ownerInChannel) {
                return await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '❌ Claim Denied',
                        description: 'The current owner is still in the channel!',
                        isAlert: true,
                        color: this.client.color.red,
                        ephemeral: true
                    }) as any
                });
            }

            await (this.client.prisma as any).tempVoice.update({
                where: { channelId: voiceChannel.id },
                data: { ownerId: interaction.user.id }
            });

            return await interaction.followUp({ 
                ...V2Helper.createLayout({
                    title: '✅ Claimed!',
                    description: 'You are now the owner of this voice channel!',
                    isAlert: true,
                    color: this.client.color.main,
                    ephemeral: true
                }) as any
            });
        }

        // Check if the user is in their own temp VC for other actions
        if (!voiceChannel || !tempVoice || (tempVoice.ownerId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))) {
            return await interaction.followUp({ 
                ...V2Helper.createLayout({
                    title: '❌ Permission Denied',
                    description: 'You must be the owner of the temporary voice channel you are currently in to use these controls!',
                    isAlert: true,
                    color: this.client.color.red,
                    ephemeral: true
                }) as any
            });
        }

        switch (action) {
            case 'hide': 
            case 'show': {
                const isHidden = action === 'hide';
                await (voiceChannel as any).permissionOverwrites.edit(interaction.guild.id, {
                    ViewChannel: !isHidden
                });
                await (this.client.prisma as any).tempVoice.update({
                    where: { channelId: voiceChannel.id },
                    data: { isHidden }
                });
                await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: `✅ Channel ${isHidden ? 'Hidden' : 'Visible'}`,
                        description: `The channel is now **${isHidden ? 'hidden from' : 'visible to'}** @everyone.`,
                        isAlert: true,
                        color: this.client.color.main,
                        ephemeral: true
                    }) as any
                });
                break;
            }
            case 'lock':
            case 'unlock': {
                const isLocked = action === 'lock';
                await (voiceChannel as any).permissionOverwrites.edit(interaction.guild.id, {
                    Connect: !isLocked
                });
                await (this.client.prisma as any).tempVoice.update({
                    where: { channelId: voiceChannel.id },
                    data: { isLocked }
                });
                await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: `✅ Channel ${isLocked ? 'Locked' : 'Unlocked'}`,
                        description: `The channel is now **${isLocked ? 'locked' : 'unlocked'}**.`,
                        isAlert: true,
                        color: this.client.color.main,
                        ephemeral: true
                    }) as any
                });
                break;
            }
            case 'rename': {
                const modal = new ModalBuilder()
                    .setCustomId('vc_rename_modal')
                    .setTitle('Rename Voice Channel');

                const nameInput = new TextInputBuilder()
                    .setCustomId('new_name')
                    .setLabel('New Name')
                    .setValue(voiceChannel.name)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
                await interaction.showModal(modal);
                break;
            }
            case 'add': {
                // Return a user select menu for adding users
                await interaction.reply({
                    ...V2Helper.createLayout({
                        title: '👤 Add User to Voice',
                        description: 'Select a user below to grant them access to your voice channel.',
                        ephemeral: true,
                        color: this.client.color.main,
                        selectMenu: new UserSelectMenuBuilder()
                            .setCustomId(`vc_add_user_${voiceChannel.id}`)
                            .setPlaceholder('Select a user...')
                            .setMinValues(1)
                            .setMaxValues(1)
                    }) as any
                });
                break;
            }
            case 'limit_up': {
                const newLimit = Math.min(voiceChannel.userLimit + 1, 99);
                await (voiceChannel as any).setUserLimit(newLimit);
                await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '✅ Limit Updated',
                        description: `User limit increased to **${newLimit === 0 ? 'Unlimited' : newLimit}**.`,
                        isAlert: true,
                        color: this.client.color.main,
                        ephemeral: true
                    }) as any
                });
                break;
            }
            case 'limit_down': {
                const newLimit = Math.max(voiceChannel.userLimit - 1, 0);
                await (voiceChannel as any).setUserLimit(newLimit);
                await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '✅ Limit Updated',
                        description: `User limit decreased to **${newLimit === 0 ? 'Unlimited' : newLimit}**.`,
                        isAlert: true,
                        color: this.client.color.main,
                        ephemeral: true
                    }) as any
                });
                break;
            }
            case 'info': {
                await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '🎙️ VC Information',
                        fields: [
                            { name: 'Owner', value: `<@${tempVoice.ownerId}>`, inline: true },
                            { name: 'Channel', value: `${voiceChannel.name}`, inline: true },
                            { name: 'Status', value: `${tempVoice.isLocked ? '🔒 Locked' : '🔓 Unlocked'} | ${tempVoice.isHidden ? '👁️ Hidden' : '👁️ Visible'}`, inline: true },
                            { name: 'Limit', value: `${voiceChannel.userLimit === 0 ? 'Unlimited' : voiceChannel.userLimit}`, inline: true }
                        ],
                        color: this.client.color.main,
                        ephemeral: true
                    }) as any
                });
                break;
            }
            case 'delete': {
                await interaction.followUp({ 
                    ...V2Helper.createLayout({
                        title: '🗑️ Deleting Channel',
                        description: 'Your temporary voice channel is being deleted...',
                        isAlert: true,
                        color: this.client.color.red,
                        ephemeral: true
                    }) as any
                });
                
                await (this.client.prisma as any).tempVoice.delete({
                    where: { channelId: voiceChannel.id }
                }).catch(() => {});
                
                await voiceChannel.delete().catch(() => {});
                break;
            }
        }
	}
}
