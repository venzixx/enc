import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, EmbedBuilder, User } from 'discord.js';
import { ExtendedClient } from '../client';
import { Context } from '../structures';
import logger from '../structures/Logger';

export class NsfwGuard {
    /**
     * Verifies that the command author is allowed to use NSFW commands:
     * - In Guilds: Checks that the channel is marked as NSFW.
     * - Across Guilds & DMs: Checks that the author has verified 18+ consent in the database;
     *   prompts with interactive buttons if not yet verified.
     */
    public static async ensureAuthorConsent(client: ExtendedClient, ctx: Context): Promise<boolean> {
        // 1. Guild Channel Age-Restricted Check
        if (ctx.guild) {
            const channel = ctx.channel as any;
            const isNsfw = Boolean(channel?.nsfw || (channel?.isThread && channel.isThread() && channel.parent?.nsfw));

            if (!isNsfw) {
                const notNsfwEmbed = new EmbedBuilder()
                    .setTitle('🔞 Age-Restricted Channel Required')
                    .setDescription('This command can only be executed in channels marked as **Age-Restricted (NSFW)** or in **Direct Messages (DMs)**.')
                    .setColor(client.color.red || 0xef4444);

                await ctx.sendMessage({
                    embeds: [notNsfwEmbed],
                    ephemeral: true
                } as any);
                return false;
            }
        }

        // 2. Author 18+ Database Consent Check
        const userConfig = await client.prisma.userConfig.findUnique({
            where: { userId: ctx.author.id }
        });

        if (userConfig?.nsfwConsent) {
            return true;
        }

        // 3. Interactive 18+ Age Gate Prompt
        const embed = new EmbedBuilder()
            .setTitle('🔞 18+ Age Verification & Consent Required')
            .setDescription(
                'You are attempting to access adult (18+) content with ENC.\n\n' +
                'By clicking **"I am 18+ & Agree"**, you confirm that:\n' +
                '• You are at least **18 years of age** (or legal age in your jurisdiction).\n' +
                '• You explicitly consent to viewing and using adult material with this bot.\n' +
                '• You understand you can revoke this consent anytime using `,nsfw revoke` or `/nsfw optout`.\n\n' +
                '*If you are under 18 or do not wish to view adult material, please click "Decline".*'
            )
            .setColor(client.color.yellow || 0xf59e0b)
            .setFooter({ text: 'Safety & Age Verification Protocol' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`author_nsfw_agree_${ctx.author.id}`)
                .setLabel('I am 18+ & Agree')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔞'),
            new ButtonBuilder()
                .setCustomId(`author_nsfw_decline_${ctx.author.id}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const promptMsg = await ctx.sendMessage({
            embeds: [embed],
            components: [row]
        });

        let targetMsg: any = promptMsg;
        if (ctx.interaction) {
            targetMsg = await ctx.interaction.fetchReply().catch(() => promptMsg);
        }

        if (!targetMsg || !('awaitMessageComponent' in targetMsg)) {
            return false;
        }

        try {
            const confirmation = await targetMsg.awaitMessageComponent({
                componentType: ComponentType.Button,
                time: 60000,
                filter: (i: any) => i.user.id === ctx.author.id
            });

            // Immediately acknowledge the button interaction to prevent any Discord timeout or double-ack!
            if (!confirmation.replied && !confirmation.deferred) {
                await confirmation.deferUpdate().catch(() => {});
            }

            if (confirmation.customId === `author_nsfw_agree_${ctx.author.id}`) {
                await client.prisma.userConfig.upsert({
                    where: { userId: ctx.author.id },
                    update: { nsfwConsent: true, nsfwConsentAt: new Date() },
                    create: { userId: ctx.author.id, nsfwConsent: true, nsfwConsentAt: new Date() }
                });

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Age Verification Confirmed')
                    .setDescription('Your 18+ consent has been recorded. Executing command...')
                    .setColor(client.color.main || 0x22c55e);

                await confirmation.editReply({
                    embeds: [successEmbed],
                    components: []
                }).catch(async () => {
                    await targetMsg.edit?.({
                        embeds: [successEmbed],
                        components: []
                    }).catch(() => {});
                });

                return true;
            } else {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('❌ Age Verification Declined')
                    .setDescription('You declined the age verification. NSFW commands will remain locked.')
                    .setColor(client.color.red || 0xef4444);

                await confirmation.editReply({
                    embeds: [declineEmbed],
                    components: []
                }).catch(async () => {
                    await targetMsg.edit?.({
                        embeds: [declineEmbed],
                        components: []
                    }).catch(() => {});
                });

                return false;
            }
        } catch (err: any) {
            const isTimeout = err?.code === 'InteractionCollectorError' || 
                             err?.message?.toLowerCase().includes('time') ||
                             err?.name === 'CollectionTimeout';

            if (isTimeout) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Verification Timed Out')
                    .setDescription('Age verification timed out. Please run the command again to verify.')
                    .setColor(client.color.red || 0xef4444);

                await targetMsg.edit?.({
                    embeds: [timeoutEmbed],
                    components: []
                }).catch(() => {});
            } else {
                logger.error(`[NSFW_GUARD_ERROR] Author verification error:`, err);
            }

            return false;
        }
    }

    /**
     * Verifies that the targeted user has consented and verified their 18+ status.
     * If not verified, sends an interactive consent prompt specifically to the target user.
     * If they accept, saves their consent and continues the command!
     */
    public static async ensureTargetConsent(client: ExtendedClient, ctx: Context, targetUser: User): Promise<boolean> {
        // Block bots
        if (targetUser.bot) {
            const botEmbed = new EmbedBuilder()
                .setDescription('🤖 **Bots cannot be targeted** in NSFW interaction commands.')
                .setColor(client.color.red || 0xef4444);

            await ctx.sendMessage({ embeds: [botEmbed] });
            return false;
        }

        // Query target user's 18+ consent status
        const targetConfig = await client.prisma.userConfig.findUnique({
            where: { userId: targetUser.id }
        });

        if (targetConfig?.nsfwConsent) {
            return true;
        }

        // 1-on-1 DM check: Target user cannot verify inside another user's private 1-on-1 DM channel
        if ((ctx.channel as any)?.type === ChannelType.DM && targetUser.id !== ctx.author.id) {
            const dmNotice = new EmbedBuilder()
                .setTitle('⚠️ Target User Unverified')
                .setDescription(
                    `<@${targetUser.id}> has not yet verified their 18+ age status with ENC.\n\n` +
                    `Since this is a private 1-on-1 DM, they cannot access this verification prompt here.\n` +
                    `Please ask <@${targetUser.id}> to run an NSFW command or \`,nsfw verify\` in a server or direct message with ENC to verify first!`
                )
                .setColor(client.color.yellow || 0xf59e0b);

            await ctx.sendMessage({ embeds: [dmNotice] });
            return false;
        }

        // Target user is unverified -> Send interactive consent prompt specifically to target user
        const embed = new EmbedBuilder()
            .setTitle('🔞 18+ Age Verification & Mutual Consent Required')
            .setDescription(
                `<@${targetUser.id}>, <@${ctx.author.id}> wants to use an NSFW interaction command with you.\n\n` +
                'To ensure safety and mutual consent, please confirm that you are at least **18 years of age** ' +
                'and consent to participating in adult interactions with ENC.\n\n' +
                'Click **"I am 18+ & Agree"** to confirm and proceed with the interaction, or **"Decline"** to cancel.'
            )
            .setColor(client.color.yellow || 0xf59e0b)
            .setFooter({ text: 'Safety & Mutual Consent Protocol' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`target_nsfw_agree_${targetUser.id}`)
                .setLabel('I am 18+ & Agree')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔞'),
            new ButtonBuilder()
                .setCustomId(`target_nsfw_decline_${targetUser.id}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const promptMsg = await ctx.sendMessage({
            content: `<@${targetUser.id}>`,
            embeds: [embed],
            components: [row],
            allowedMentions: { users: [targetUser.id], parse: [], roles: [] }
        });

        let targetMsg: any = promptMsg;
        if (ctx.interaction) {
            targetMsg = await ctx.interaction.fetchReply().catch(() => promptMsg);
        }

        if (!targetMsg || !('awaitMessageComponent' in targetMsg)) {
            return false;
        }

        try {
            const confirmation = await targetMsg.awaitMessageComponent({
                componentType: ComponentType.Button,
                time: 60000,
                filter: (i: any) => i.user.id === targetUser.id
            });

            // Immediately acknowledge the button interaction to prevent timeouts or double-ack
            if (!confirmation.replied && !confirmation.deferred) {
                await confirmation.deferUpdate().catch(() => {});
            }

            if (confirmation.customId === `target_nsfw_agree_${targetUser.id}`) {
                await client.prisma.userConfig.upsert({
                    where: { userId: targetUser.id },
                    update: { nsfwConsent: true, nsfwConsentAt: new Date() },
                    create: { userId: targetUser.id, nsfwConsent: true, nsfwConsentAt: new Date() }
                });

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Mutual Consent Confirmed')
                    .setDescription(`Your 18+ consent has been recorded. Executing interaction...`)
                    .setColor(client.color.main || 0x22c55e);

                await confirmation.editReply({
                    embeds: [successEmbed],
                    components: []
                }).catch(async () => {
                    await targetMsg.edit?.({
                        embeds: [successEmbed],
                        components: []
                    }).catch(() => {});
                });

                return true;
            } else {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('❌ Interaction Cancelled')
                    .setDescription(`<@${targetUser.id}> declined the 18+ verification prompt. The interaction was cancelled.`)
                    .setColor(client.color.red || 0xef4444);

                await confirmation.editReply({
                    embeds: [declineEmbed],
                    components: []
                }).catch(async () => {
                    await targetMsg.edit?.({
                        embeds: [declineEmbed],
                        components: []
                    }).catch(() => {});
                });

                return false;
            }
        } catch (err: any) {
            const isTimeout = err?.code === 'InteractionCollectorError' || 
                             err?.message?.toLowerCase().includes('time') ||
                             err?.name === 'CollectionTimeout';

            if (isTimeout) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Verification Timed Out')
                    .setDescription(`<@${targetUser.id}> did not respond to the 18+ verification prompt in time. Interaction cancelled.`)
                    .setColor(client.color.red || 0xef4444);

                await targetMsg.edit?.({
                    embeds: [timeoutEmbed],
                    components: []
                }).catch(() => {});
            } else {
                logger.error(`[NSFW_GUARD_ERROR] Target verification error:`, err);
            }

            return false;
        }
    }

    /**
     * Backward-compat alias for ensureAuthorConsent.
     */
    public static async ensureNsfw(client: ExtendedClient, ctx: Context): Promise<boolean> {
        return this.ensureAuthorConsent(client, ctx);
    }

    /**
     * Revokes 18+ consent for the user.
     */
    public static async revokeConsent(client: ExtendedClient, ctx: Context): Promise<any> {
        await client.prisma.userConfig.upsert({
            where: { userId: ctx.author.id },
            update: { nsfwConsent: false, nsfwConsentAt: null },
            create: { userId: ctx.author.id, nsfwConsent: false }
        });

        const revokeEmbed = new EmbedBuilder()
            .setTitle('🔒 Consent Revoked')
            .setDescription('Your 18+ NSFW consent has been revoked. You will be prompted again before accessing NSFW commands.')
            .setColor(client.color.main || 0x22c55e);

        return ctx.sendMessage({ embeds: [revokeEmbed] });
    }
}
