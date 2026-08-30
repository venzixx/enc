import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    Message
} from 'discord.js';
import { Context } from '../structures';
import { ExtendedClient } from '../client';

export interface ModConfirmationOptions {
    client: ExtendedClient;
    ctx: Context;
    actionName: string;
    targetName: string;
    targetAvatar?: string | null;
    dangerLevel?: 'danger' | 'warning' | 'primary';
    reason?: string;
    duration?: string;
    details?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    confirmLabel?: string;
    cancelLabel?: string;
    confirmEmoji?: string;
    timeoutMs?: number;
    force?: boolean;
}

export class ModConfirmation {
    public static async ask(options: ModConfirmationOptions): Promise<boolean> {
        const {
            client,
            ctx,
            actionName,
            targetName,
            targetAvatar,
            dangerLevel = 'danger',
            reason,
            duration,
            details,
            fields = [],
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel',
            confirmEmoji,
            timeoutMs = 60000,
            force = false
        } = options;

        if (force) return true;

        const color = dangerLevel === 'danger'
            ? (client.color?.red ?? 0xef4444)
            : dangerLevel === 'warning'
                ? (client.color?.yellow ?? 0xf59e0b)
                : (client.color?.main ?? 0x3b82f6);

        const buttonStyle = dangerLevel === 'danger'
            ? ButtonStyle.Danger
            : dangerLevel === 'warning'
                ? ButtonStyle.Primary
                : ButtonStyle.Success;

        const emojiHeader = dangerLevel === 'danger'
            ? (client.emoji?.antinuke_siren ?? '⚠️')
            : (client.emoji?.shield ?? '🛡️');

        const descLines = [
            'Are you sure you want to execute **' + actionName + '** on **' + targetName + '**?',
            '',
            '• **Target:** ' + targetName + '',
            '• **Moderator:** <@' + ctx.author.id + '> (' + ctx.author.tag + ')'
        ];

        if (duration) {
            descLines.push('• **Duration:** ' + duration + '');
        }
        if (reason) {
            descLines.push('• **Reason:** ' + reason);
        }
        if (details) {
            descLines.push('• **Details:** ' + details);
        }
        descLines.push('');
        descLines.push('*Please confirm below to proceed with this moderation action.*');

        const embed = new EmbedBuilder()
            .setTitle(emojiHeader + ' Moderation Confirmation: ' + actionName)
            .setColor(color)
            .setDescription(descLines.join('\n'))
            .setFooter({ text: 'Auto-cancelling in ' + Math.round(timeoutMs / 1000) + 's if not confirmed' })
            .setTimestamp();

        if (targetAvatar) {
            embed.setThumbnail(targetAvatar);
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        const confirmBtn = new ButtonBuilder()
            .setCustomId('mod_confirm_' + Date.now() + '_' + ctx.author.id)
            .setLabel(confirmLabel)
            .setStyle(buttonStyle);

        if (confirmEmoji) {
            confirmBtn.setEmoji(confirmEmoji);
        }

        const cancelBtn = new ButtonBuilder()
            .setCustomId('mod_cancel_' + Date.now() + '_' + ctx.author.id)
            .setLabel(cancelLabel)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

        let msg: Message | any;
        if (ctx.isInteraction && ctx.interaction?.deferred) {
            msg = await ctx.interaction.editReply({ embeds: [embed], components: [row] });
        } else if (ctx.isInteraction && ctx.interaction?.replied) {
            msg = await ctx.interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            msg = await ctx.sendMessage({ embeds: [embed], components: [row] });
        }

        try {
            const confirmation = await msg.awaitMessageComponent({
                filter: (i: any) => {
                    if (i.user.id !== ctx.author.id) {
                        i.reply({
                            content: (client.emoji?.cross ?? '❌') + ' Only the moderator (<@' + ctx.author.id + '>) who initiated this action can confirm.',
                            ephemeral: true
                        }).catch(() => {});
                        return false;
                    }
                    return true;
                },
                componentType: ComponentType.Button,
                time: timeoutMs
            });

            if (confirmation.customId.startsWith('mod_confirm_')) {
                await confirmation.deferUpdate().catch(() => {});

                // Delete or clear confirmation prompt so only the final done embed remains
                if (!ctx.isInteraction && msg) {
                    if (msg.deletable) {
                        await msg.delete().catch(() => {});
                    }
                    (ctx as any).response = null;
                } else if (ctx.isInteraction && ctx.interaction) {
                    await ctx.interaction.editReply({ components: [] }).catch(() => {});
                }

                return true;
            } else {
                await confirmation.deferUpdate().catch(() => {});
                const cancelEmbed = new EmbedBuilder()
                    .setTitle((client.emoji?.cross ?? '❌') + ' Moderation Action Cancelled')
                    .setDescription('The **' + actionName + '** action against **' + targetName + '** was cancelled. No changes were made.')
                    .setColor(client.color?.yellow ?? 0xf59e0b)
                    .setTimestamp();

                if (ctx.isInteraction && ctx.interaction) {
                    await ctx.interaction.editReply({ embeds: [cancelEmbed], components: [] }).catch(() => {});
                } else if (msg.editable) {
                    await msg.edit({ embeds: [cancelEmbed], components: [] }).catch(() => {});
                }
                return false;
            }
        } catch (e) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏱️ Confirmation Timed Out')
                .setDescription('The confirmation prompt for **' + actionName + '** on **' + targetName + '** timed out. No action was taken.')
                .setColor(client.color?.red ?? 0xef4444)
                .setTimestamp();

            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            } else if (msg.editable) {
                await msg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
            return false;
        }
    }
}