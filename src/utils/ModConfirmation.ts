import {
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Message
} from 'discord.js';
import { Context } from '../structures';
import { ExtendedClient } from '../client';
import { V2Helper } from './V2Helper';

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

        const layout = V2Helper.createLayout({
            title: `${emojiHeader} Moderation Confirmation: ${actionName}`,
            description: descLines.join('\n'),
            borderless: true,
            color: null,
            thumbnail: targetAvatar || undefined,
            fields: fields.length > 0 ? fields : undefined,
            footer: 'Auto-cancelling in ' + Math.round(timeoutMs / 1000) + 's if not confirmed',
            buttons: [confirmBtn, cancelBtn]
        });

        let msg: Message | any;
        if (ctx.isInteraction && (ctx.interaction?.deferred || ctx.interaction?.replied)) {
            msg = await ctx.interaction.editReply(layout as any);
        } else if (ctx.isInteraction && ctx.interaction) {
            await ctx.interaction.reply(layout as any);
            msg = await ctx.interaction.fetchReply();
        } else {
            msg = await ctx.sendMessage(layout as any);
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

                if (!ctx.isInteraction && msg) {
                    if (msg.deletable) {
                        await msg.delete().catch(() => {});
                    }
                    (ctx as any).response = null;
                }

                return true;
            } else {
                await confirmation.deferUpdate().catch(() => {});
                const cancelLayout = V2Helper.createLayout({
                    title: `${client.emoji?.cross ?? '❌'} Moderation Action Cancelled`,
                    description: 'The **' + actionName + '** action against **' + targetName + '** was cancelled. No changes were made.',
                    borderless: true,
                    color: null,
                    isAlert: true
                });

                if (ctx.isInteraction && ctx.interaction) {
                    await ctx.interaction.editReply(cancelLayout as any).catch(() => {});
                } else if (msg?.editable) {
                    await msg.edit(cancelLayout as any).catch(() => {});
                }
                return false;
            }
        } catch (e) {
            const timeoutLayout = V2Helper.createLayout({
                title: '⏱️ Confirmation Timed Out',
                description: 'The confirmation prompt for **' + actionName + '** on **' + targetName + '** timed out. No action was taken.',
                borderless: true,
                color: null,
                isAlert: true
            });

            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.editReply(timeoutLayout as any).catch(() => {});
            } else if (msg?.editable) {
                await msg.edit(timeoutLayout as any).catch(() => {});
            }
            return false;
        }
    }
}