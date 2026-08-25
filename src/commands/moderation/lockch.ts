import { PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';
import { LockManager } from '../../utils/LockManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class LockChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'lockch',
            description: {
                content: 'Locks the current or specified channel for everyone.',
                usage: 'lockch [channel]',
                examples: ['lockch', 'lockch #general']
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
                { name: 'channel', description: 'Channel to lock', type: 7, required: false }
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

        const channelName = (targetChannel as any).name;
        const force = args.includes('--force') || args.includes('-f');
        const confirmed = await ModConfirmation.ask({
            client,
            ctx,
            actionName: 'Lock Channel',
            targetName: `#${channelName} (${targetChannel.id})`,
            dangerLevel: 'warning',
            details: 'This will lock SendMessages/Connect permissions for @everyone.',
            confirmLabel: 'Confirm Lock',
            confirmEmoji: '🔒',
            force
        });

        if (!confirmed) return;

        const isVoice = targetChannel.isVoiceBased();
        const permissionsToLock = isVoice
            ? ['Connect', 'Speak', 'SendMessages'] as const
            : ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'] as const;

        const lockOverrides: Record<string, boolean> = {};
        for (const perm of permissionsToLock) {
            lockOverrides[perm] = false;
        }

        // Lock other role overrides
        const overwrites = targetChannel.permissionOverwrites.cache;
        for (const [id, overwrite] of overwrites.entries()) {
            // Only target roles (type 0), not members (type 1)
            // Skip @everyone (id === ctx.guild.id)
            if (overwrite.type !== 0 || id === ctx.guild.id) continue;

            const role = ctx.guild.roles.cache.get(id);
            if (!role) continue;

            // Skip admin/mod roles to keep them unlocked
            const isModOrAdmin = role.permissions.has(PermissionFlagsBits.Administrator) ||
                                 role.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                 role.permissions.has(PermissionFlagsBits.ManageMessages);
            if (isModOrAdmin) continue;

            // Check if this role has any of the locked permissions explicitly allowed in the channel
            const allowedHere: string[] = [];
            for (const perm of permissionsToLock) {
                if (overwrite.allow.has(PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits])) {
                    allowedHere.push(perm);
                }
            }

            if (allowedHere.length > 0) {
                // Save allowed permissions to state
                await LockManager.saveLockState(targetChannel.id, id, allowedHere);

                // Edit overwrite to deny these permissions
                const roleOverrides: Record<string, boolean> = {};
                for (const perm of allowedHere) {
                    roleOverrides[perm] = false;
                }
                await targetChannel.permissionOverwrites.edit(id, roleOverrides);
            }
        }

        // Lock @everyone
        await (targetChannel as TextChannel | VoiceChannel).permissionOverwrites.edit(ctx.guild.roles.everyone, lockOverrides);

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Locked',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: (targetChannel as any).name,
            details: `Locked channel #${(targetChannel as any).name} for everyone`,
            color: client.color.red
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Locked`,
            description: `Successfully locked ${targetChannel} for everyone.`,
            color: client.color.main
        });
    }
}
