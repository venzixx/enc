import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { isDev } from '../../utils/devCheck';
import { V2Helper } from '../../utils/V2Helper';

export default class Unverify extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unverify',
            aliases: ['unv', 'deverify', 'removeverify'],
            description: {
                content: 'Manually unverify a user, strip verification roles, and reset their verification status (Owner and Extra Owners only).',
                usage: 'unverify <@user|userId> [reason]',
                examples: ['unverify @Ren', 'unverify 1234567890 Alt account investigation']
            },
            category: 'moderation',
            cooldown: 2,
            slashCommand: false, // Prefix-only command
            options: []
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        // 1. Authorization: Only Server Owner, Bot Developers, and Extra Owners
        const isGuildOwner = ctx.guild.ownerId === ctx.author.id;
        const isBotDev = await isDev(client, ctx.author.id);
        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
        const isExtraOwner = isGuildOwner || isBotDev || extraOwners.some((eo: any) => eo.userId === ctx.author.id);

        if (!isExtraOwner) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} **Access Denied**: Only the **Server Owner** and **Extra Owners** can unverify members.`, 
                borderless: true
            });
        }

        // 2. Resolve Target Member
        const targetStr = args[0];
        if (!targetStr) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} Please specify a user to unverify.

**Usage:** \`${ctx.prefix || ','}unverify <@user|userId> [reason]\``, 
                borderless: true
            });
        }

        const member = await Resolver.resolveMember(ctx, targetStr);
        if (!member) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} Could not find that member in this server.`, 
                borderless: true
            });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        // 3. Guild Verification Configuration Check
        const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
        if (!guildData || !guildData.verificationRoleId) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} Verification is not configured for this server.`, 
                borderless: true
            });
        }

        const role = ctx.guild.roles.cache.get(guildData.verificationRoleId);

        // 4. Execute Unverification
        try {
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role.id, `Unverified by ${ctx.author.tag}: ${reason}`).catch(() => {});
            }

            if (guildData.unverifiedRoleId && !member.roles.cache.has(guildData.unverifiedRoleId)) {
                await member.roles.add(guildData.unverifiedRoleId, `Reset to unverified status`).catch(() => {});
            }
            if (guildData.verificationSilentRoleId && !member.roles.cache.has(guildData.verificationSilentRoleId)) {
                await member.roles.add(guildData.verificationSilentRoleId, `Reset to unverified status`).catch(() => {});
            }

            // Wipe database device and session records for this user in this guild
            await client.prisma.verifiedDevice.deleteMany({
                where: { guildId: ctx.guild.id, userId: member.id }
            }).catch(() => {});

            await client.prisma.verificationSession.deleteMany({
                where: { guildId: ctx.guild.id, userId: member.id }
            }).catch(() => {});

            // Optional Discord Logging
            if (guildData.verificationLogChannelId) {
                const logChannel = ctx.guild.channels.cache.get(guildData.verificationLogChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const layout = V2Helper.createLayout({
                        title: "🚫 Member Unverified",
                        description: `**Member:** <@${member.id}> (${member.user.tag})
**Status:** Unverified & Access Revoked
**Unverified By:** <@${ctx.author.id}> (${ctx.author.tag})
**Reason:** ${reason}
**Role Removed:** ${role ? `<@&${role.id}>` : 'None'}`,
                        footer: "Encl Security Engine",
                        timestamp: true,
                        borderless: true
                    });
                    await (logChannel as any).send({
                        ...layout,
                        allowedMentions: { parse: [], roles: [], users: [] }
                    }).catch(() => {});
                }
            }

            // Record in database AuditLog
            await client.prisma.auditLog.create({
                data: {
                    guildId: ctx.guild.id,
                    type: "VERIFICATION",
                    event: "UNVERIFY",
                    status: "SUCCESS",
                    executorId: ctx.author.id,
                    executorTag: ctx.author.tag,
                    targetId: member.id,
                    targetName: member.user.tag,
                    details: `Unverified by ${ctx.author.tag} • Reason: ${reason}`
                }
            }).catch(() => {});

            return await ctx.replyV2({
                description: `${client.emoji.success || '✅'} Successfully unverified **<@${member.id}>** and reset their verification roles.
**Reason:** ${reason}`,
                borderless: true
            });
        } catch (err: any) {
            return await ctx.replyV2({
                description: `${client.emoji.cross || '❌'} Failed to unverify member: ${err.message}`,
                borderless: true
            });
        }
    }
}
