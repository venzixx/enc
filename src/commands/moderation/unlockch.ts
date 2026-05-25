import { PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';
import { LockManager } from '../../utils/LockManager';

export default class UnlockChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unlockch',
            description: {
                content: 'Unlocks the current or specified channel for everyone.',
                usage: 'unlockch [channel]',
                examples: ['unlockch', 'unlockch #general']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: false,
            hidden: true,
            permissions: {
                user: [PermissionFlagsBits.ManageChannels],
                client: [PermissionFlagsBits.ManageChannels]
            },
            options: [
                { name: 'channel', description: 'Channel to unlock', type: 7, required: false }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        let targetId = ctx.options.getChannel('channel')?.id || args[0]?.replace(/[<#@!>]/g, '');
        let targetChannel = targetId ? await ctx.guild.channels.fetch(targetId).catch(() => null) : ctx.channel;

        if (!targetChannel || targetChannel.isDMBased()) {
            return ctx.replyV2({ description: 'Invalid channel specified.', color: client.color.red, isAlert: true });
        }

        const isVoice = targetChannel.isVoiceBased();
        const permissionsToUnlock = isVoice
            ? ['Connect', 'Speak', 'SendMessages']
            : ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'];

        // Retrieve saved lock state
        const savedState = await LockManager.getAndClearLockState(targetChannel.id);

        // Restore role overrides
        for (const [roleId, allowedPermissions] of Object.entries(savedState)) {
            const role = ctx.guild.roles.cache.get(roleId);
            if (!role) continue;

            const restoreOverrides: Record<string, boolean | null> = {};
            for (const perm of permissionsToUnlock) {
                if (allowedPermissions.includes(perm)) {
                    restoreOverrides[perm] = true; // Restore to allowed
                } else {
                    restoreOverrides[perm] = null; // Set to neutral/inherit
                }
            }
            await targetChannel.permissionOverwrites.edit(roleId, restoreOverrides);
        }

        // Unlock @everyone
        const everyoneOverrides: Record<string, null> = {};
        for (const perm of permissionsToUnlock) {
            everyoneOverrides[perm] = null;
        }
        await (targetChannel as TextChannel | VoiceChannel).permissionOverwrites.edit(ctx.guild.roles.everyone, everyoneOverrides);

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Unlocked',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: (targetChannel as any).name,
            details: `Unlocked channel #${(targetChannel as any).name} for everyone`,
            color: client.color.green
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Unlocked`,
            description: `Successfully unlocked ${targetChannel} for everyone.`,
            color: client.color.main
        });
    }
}
