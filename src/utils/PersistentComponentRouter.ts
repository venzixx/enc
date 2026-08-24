import {
    ButtonInteraction,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { ExtendedClient } from '../client';
import SocialUtils from './SocialUtils';
import logger from '../structures/Logger';

export class PersistentComponentRouter {
    /**
     * Handles persistent stateless buttons that survive bot restarts and collector timeouts.
     * Returns true if handled, false otherwise.
     */
    public static async handle(client: ExtendedClient, interaction: ButtonInteraction): Promise<boolean> {
        const customId = interaction.customId;
        if (!customId) return false;

        try {
            // ─── 1. SOCIAL / ACTION COMMANDS (Kiss, Hug, Slap, Cuddle, etc.) ────
            if (customId.startsWith('social_')) {
                // Format: social_<action>_<initiatorId> or social_<action>_<initiatorId>_<targetId>
                const parts = customId.split('_');
                const action = parts[1];
                const initiatorId = parts[2];
                const targetId = parts[3];

                // If targetId is encoded, verify only target can click
                if (targetId && interaction.user.id !== targetId) {
                    await interaction.reply({
                        content: `Only <@${targetId}> can react back!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                // If no targetId encoded, prevent clicking your own action back
                if (!targetId && interaction.user.id === initiatorId) {
                    await interaction.reply({
                        content: `You cannot react back to yourself!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                const gifUrlBack = await SocialUtils.fetchGif(client, action);
                const pairBack = await (client.prisma as any).socialAction.upsert({
                    where: { userId_fromId_action: { userId: initiatorId, fromId: interaction.user.id, action } },
                    update: { count: { increment: 1 } },
                    create: { userId: initiatorId, fromId: interaction.user.id, action, count: 1 }
                });

                await interaction.followUp({
                    content: `<@${initiatorId}>`,
                    embeds: [
                        client.embed()
                            .setDescription(`💞 **${interaction.user.username}** ${action}ed **<@${initiatorId}>** back!\n\n*They've ${action}ed you **${pairBack.count}** times now!*`)
                            .setImage(gifUrlBack || 'https://i.imgur.com/ud3EWNh.jpg')
                            .setColor(client.color.main)
                    ]
                });
                return true;
            }

            // ─── 2. MARRIAGE PROPOSALS ──────────────────────────────────────────
            if (customId.startsWith('marry_accept_') || customId.startsWith('marry_deny_')) {
                const isAccept = customId.startsWith('marry_accept_');
                const parts = customId.split('_');
                const proposerId = parts[2];
                const targetId = parts[3];

                if (interaction.user.id !== targetId) {
                    await interaction.reply({
                        content: `Only <@${targetId}> can answer this marriage proposal.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                if (!isAccept) {
                    await interaction.editReply({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('💔 Proposal Declined')
                                .setDescription(`<@${targetId}> declined <@${proposerId}>'s proposal.`)
                                .setColor(client.color.red)
                        ],
                        components: []
                    });
                    return true;
                }

                // Check current status
                const check1 = await client.prisma.marriage.findFirst({
                    where: { OR: [{ user1Id: proposerId }, { user2Id: proposerId }] }
                });
                const check2 = await client.prisma.marriage.findFirst({
                    where: { OR: [{ user1Id: targetId }, { user2Id: targetId }] }
                });

                if (check1 || check2) {
                    await interaction.editReply({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('💍 Marriage Error')
                                .setDescription('One of the users has already married someone else.')
                                .setColor(client.color.red)
                        ],
                        components: []
                    });
                    return true;
                }

                await client.prisma.marriage.create({
                    data: {
                        user1Id: proposerId,
                        user2Id: targetId,
                        proposerId: proposerId
                    }
                });

                await interaction.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('💖 Just Married!')
                            .setDescription(`Congratulations <@${proposerId}> and <@${targetId}>! You are now happily married.`)
                            .setColor(client.color.main)
                            .setTimestamp()
                    ],
                    components: []
                });
                return true;
            }

            // ─── 3. DIVORCE CONFIRMATIONS ───────────────────────────────────────
            if (customId.startsWith('divorce_confirm_') || customId.startsWith('divorce_cancel_')) {
                const isConfirm = customId.startsWith('divorce_confirm_');
                const parts = customId.split('_');
                const initiatorId = parts[2];
                const spouseId = parts[3];

                if (interaction.user.id !== initiatorId) {
                    await interaction.reply({
                        content: 'Only the user initiating the divorce can confirm.',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                if (!isConfirm) {
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('💍 Divorce Aborted')
                                .setDescription(`Divorce request cancelled. You remain married to <@${spouseId}>.`)
                                .setColor(client.color.main)
                        ],
                        components: []
                    });
                    return true;
                }

                const marriage = await client.prisma.marriage.findFirst({
                    where: {
                        OR: [
                            { user1Id: initiatorId, user2Id: spouseId },
                            { user1Id: spouseId, user2Id: initiatorId }
                        ]
                    }
                });

                if (marriage) {
                    await client.prisma.marriage.delete({
                        where: { id: marriage.id }
                    });
                }

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('💔 Marriage Ended')
                            .setDescription(`You and <@${spouseId}> are now divorced.`)
                            .setColor(client.color.red)
                    ],
                    components: []
                });
                return true;
            }

            // ─── 4. ADOPTION PROPOSALS ──────────────────────────────────────────
            if (customId.startsWith('adopt_accept_') || customId.startsWith('adopt_deny_')) {
                const isAccept = customId.startsWith('adopt_accept_');
                const parts = customId.split('_');
                const parentId = parts[2];
                const childId = parts[3];

                if (interaction.user.id !== childId) {
                    await interaction.reply({
                        content: 'Only the recipient of the adoption proposal can reply.',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                if (!isAccept) {
                    await interaction.editReply({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('👶 Proposal Declined')
                                .setDescription(`<@${childId}> declined the adoption proposal.`)
                                .setColor(client.color.red)
                        ],
                        components: []
                    });
                    return true;
                }

                await client.prisma.familyRelation.create({
                    data: {
                        parentId: parentId,
                        childId: childId
                    }
                }).catch(() => {});

                await interaction.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🎉 Adoption Complete!')
                            .setDescription(`<@${childId}> has been adopted by <@${parentId}>!`)
                            .setColor(client.color.main)
                            .setTimestamp()
                    ],
                    components: []
                });
                return true;
            }

            return false;
        } catch (error: any) {
            if (error.code === 10062) return true; // Interaction already expired, ignored
            logger.error(`[PERSISTENT_COMPONENT_ROUTER] Error processing ${customId}: ${error}`);
            return false;
        }
    }
}
