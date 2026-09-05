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
import { V2Helper } from './V2Helper';
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

                const pastAction = action.endsWith('e') ? `${action}d` : `${action}ed`;
                const layoutBack = V2Helper.createLayout({
                    description: `💞 <@${interaction.user.id}> ${pastAction} <@${initiatorId}> back!\n\n*They've ${pastAction} you **${pairBack.count}** times now!*`,
                    image: gifUrlBack || 'https://i.imgur.com/ud3EWNh.jpg',
                    borderless: true,
                    color: null,
                    allowedMentions: { users: [initiatorId], parse: [], roles: [] }
                });

                await interaction.followUp(layoutBack as any);
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
                        content: 'Only the spouse who initiated the divorce can confirm or cancel.',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                if (!isConfirm) {
                    const cancelLayout = V2Helper.createLayout({
                        title: '💍 Divorce Cancelled',
                        description: `You had second thoughts and decided to stay married to <@${spouseId}>!`,
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(cancelLayout as any);
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

                if (!marriage) {
                    const notMarriedLayout = V2Helper.createLayout({
                        title: '💔 Not Married',
                        description: 'This marriage record no longer exists.',
                        isAlert: true,
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(notMarriedLayout as any);
                    return true;
                }

                const marriedTime = Math.floor(new Date(marriage.marriedAt).getTime() / 1000);

                await client.prisma.marriage.delete({
                    where: { id: marriage.id }
                });

                const confirmLayout = V2Helper.createLayout({
                    title: '💔 Marriage Ended',
                    description: `<@${initiatorId}> and <@${spouseId}> are now officially divorced.\nThey were married since <t:${marriedTime}:D> (<t:${marriedTime}:R>).`,
                    borderless: true,
                    color: null,
                    buttons: []
                });
                await interaction.editReply(confirmLayout as any);
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
                    const layout = V2Helper.createLayout({
                        title: '👶 Proposal Declined',
                        description: `<@${childId}> declined the adoption proposal.`,
                        isAlert: true,
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(layout as any);
                    return true;
                }

                const marriage = await client.prisma.marriage.findFirst({
                    where: { OR: [{ user1Id: parentId }, { user2Id: parentId }] }
                });
                const spouseId = marriage ? (marriage.user1Id === parentId ? marriage.user2Id : marriage.user1Id) : null;

                await client.prisma.familyRelation.create({
                    data: {
                        parentId: parentId,
                        childId: childId
                    }
                }).catch(() => {});

                if (spouseId) {
                    await client.prisma.familyRelation.create({
                        data: {
                            parentId: spouseId,
                            childId: childId
                        }
                    }).catch(() => {});
                }

                const parentsMention = spouseId ? `<@${parentId}> and <@${spouseId}>` : `<@${parentId}>`;
                const layout = V2Helper.createLayout({
                    title: '🎉 Adoption Complete!',
                    description: `Welcome to the family, <@${childId}>!\nYou have been officially adopted by ${parentsMention}.`,
                    borderless: true,
                    color: null,
                    buttons: []
                });
                await interaction.editReply(layout as any);
                return true;
            }

            // ─── 5. TRUTH OR DARE (Cascading game replies without editing old message) ──
            if (customId.startsWith('tord_')) {
                // Format: tord_<action> or tord_<action>_<rating>
                const parts = customId.split('_');
                const action = (parts[1] || 'random') as 'truth' | 'dare' | 'random';
                const rating = parts[2]; // optional: pg, pg13, r

                const isNsfwChannel = !interaction.guildId || (interaction.channel as any)?.nsfw || (interaction.channel as any)?.type === 1;
                if (rating?.toLowerCase() === 'r' && !isNsfwChannel) {
                    await interaction.reply({
                        content: 'Rating **R** prompts can only be used in NSFW channels or DMs.',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferReply();
                const { TordHelper } = await import('./TordHelper');
                const prompt = await TordHelper.fetchPrompt(action, rating);
                const layout = TordHelper.createLayout(prompt, interaction.user.id, rating);
                await interaction.editReply(layout as any);
                return true;
            }

            // ─── 6. STREAKS & LEADERBOARD ───────────────────────────────────────
            if (customId.startsWith('streaks_lb_')) {
                const guildId = customId.replace('streaks_lb_', '');
                await interaction.deferUpdate();
                const { StreakHelper } = await import('./StreakHelper');
                const layout = await StreakHelper.buildLeaderboardLayout(client, guildId, interaction.user.id);
                await interaction.editReply(layout as any);
                return true;
            }

            if (customId.startsWith('streaks_user_')) {
                // Format: streaks_user_<guildId>_<userId>
                const parts = customId.split('_');
                const guildId = parts[2];
                const userId = parts[3];
                await interaction.deferUpdate();
                const targetUser = await client.users.fetch(userId).catch(() => interaction.user);
                const { StreakHelper } = await import('./StreakHelper');
                const layout = await StreakHelper.buildUserStreaksLayout(client, guildId, targetUser, interaction.user.id);
                await interaction.editReply(layout as any);
                return true;
            }

            // ─── 7. ABANDON FAMILY CONFIRMATIONS ──────────────────────────────────
            if (customId.startsWith('abandon_confirm_') || customId.startsWith('abandon_cancel_')) {
                const isConfirm = customId.startsWith('abandon_confirm_');
                const parts = customId.split('_');
                const initiatorId = parts[2];

                if (interaction.user.id !== initiatorId) {
                    await interaction.reply({
                        content: 'Only the user initiating the abandonment can decide.',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                if (!isConfirm) {
                    const cancelLayout = V2Helper.createLayout({
                        title: '🏠 Decision Cancelled',
                        description: 'You had second thoughts and decided to stay with your family!',
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(cancelLayout as any);
                    return true;
                }

                const parents = await client.prisma.familyRelation.findMany({
                    where: { childId: initiatorId }
                });

                if (parents.length === 0) {
                    const noParentsLayout = V2Helper.createLayout({
                        title: '👪 No Parents Found',
                        description: 'You do not have any registered parents to abandon.',
                        isAlert: true,
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(noParentsLayout as any);
                    return true;
                }

                const parentMentions = parents.map(p => `<@${p.parentId}>`).join(' & ');

                await client.prisma.familyRelation.deleteMany({
                    where: { childId: initiatorId }
                });

                const confirmLayout = V2Helper.createLayout({
                    title: '🏃 Family Abandoned',
                    description: `You have packed your bags, left home, and abandoned your parents: ${parentMentions}.\nYou are no longer listed as their child.`,
                    borderless: true,
                    color: null,
                    buttons: []
                });
                await interaction.editReply(confirmLayout as any);
                return true;
            }

            // ─── 8. DISOWN CHILD CONFIRMATIONS ────────────────────────────────────
            if (customId.startsWith('disown_confirm_') || customId.startsWith('disown_cancel_')) {
                const isConfirm = customId.startsWith('disown_confirm_');
                const parts = customId.split('_');
                const parentId = parts[2];
                const childId = parts[3];

                if (interaction.user.id !== parentId) {
                    await interaction.reply({
                        content: 'Only the parent initiating the disownment can decide.',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                await interaction.deferUpdate();

                if (!isConfirm) {
                    const cancelLayout = V2Helper.createLayout({
                        title: '🏠 Decision Cancelled',
                        description: `You decided not to disown <@${childId}>. They remain in the family!`,
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(cancelLayout as any);
                    return true;
                }

                const marriage = await client.prisma.marriage.findFirst({
                    where: { OR: [{ user1Id: parentId }, { user2Id: parentId }] }
                });
                const spouseId = marriage ? (marriage.user1Id === parentId ? marriage.user2Id : marriage.user1Id) : null;
                const parentIds = spouseId ? [parentId, spouseId] : [parentId];

                const relations = await client.prisma.familyRelation.findMany({
                    where: { parentId: { in: parentIds }, childId }
                });

                if (relations.length === 0) {
                    const notChildLayout = V2Helper.createLayout({
                        title: '👪 Not Your Child',
                        description: `<@${childId}> is no longer listed as your child.`,
                        isAlert: true,
                        borderless: true,
                        color: null,
                        buttons: []
                    });
                    await interaction.editReply(notChildLayout as any);
                    return true;
                }

                await client.prisma.familyRelation.deleteMany({
                    where: { parentId: { in: parentIds }, childId }
                });

                const confirmLayout = V2Helper.createLayout({
                    title: '💔 Child Disowned',
                    description: `You have officially disowned <@${childId}>.\nThey have been removed from your family tree.`,
                    borderless: true,
                    color: null,
                    buttons: []
                });
                await interaction.editReply(confirmLayout as any);
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
