import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { isDev } from '../../utils/devCheck';

export default class Verify extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'verify',
            aliases: ['manualverify', 'forceverify', 'v'],
            description: {
                content: 'Manually verify a user in the server (Owner and Extra Owners only).',
                usage: 'verify <@user|userId>',
                examples: ['verify @Ren', 'verify 1234567890']
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
                description: `${client.emoji.cross || '❌'} **Access Denied**: Only the **Server Owner** and **Extra Owners** can manually verify members.`, 
                borderless: true
            });
        }

        // 2. Resolve Target Member
        const targetStr = args[0];
        if (!targetStr) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} Please specify a user to verify.\n\n**Usage:** \`${ctx.prefix || ','}verify <@user|userId>\``, 
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

        // 3. Guild Verification Configuration Check
        const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
        if (!guildData || !guildData.verificationRoleId) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} Verification is not configured for this server. Please set a verified role first via \`,config verify <#channel> <@role>\` or on the dashboard.`, 
                borderless: true
            });
        }

        const role = ctx.guild.roles.cache.get(guildData.verificationRoleId);
        if (!role) {
            return await ctx.replyV2({ 
                description: `${client.emoji.cross || '❌'} The configured verification role (<@&${guildData.verificationRoleId}>) was not found in this server.`, 
                borderless: true
            });
        }

        // 4. Check If Already Verified
        if (member.roles.cache.has(role.id)) {
            return await ctx.replyV2({ 
                description: `${client.emoji.info || 'ℹ️'} **${member.user.tag}** is already verified!`, 
                borderless: true
            });
        }

        // 5. Execute Verification
        try {
            await member.roles.add(role.id, `Manual verification by ${ctx.author.tag}`);

            if (guildData.unverifiedRoleId && member.roles.cache.has(guildData.unverifiedRoleId)) {
                await member.roles.remove(guildData.unverifiedRoleId, `Manual verification passed`).catch(() => {});
            }
            if (guildData.verificationSilentRoleId && member.roles.cache.has(guildData.verificationSilentRoleId)) {
                await member.roles.remove(guildData.verificationSilentRoleId, `Manual verification passed`).catch(() => {});
            }

            // Optional Logging
            if (guildData.verificationLogChannelId) {
                const logChannel = ctx.guild.channels.cache.get(guildData.verificationLogChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x10b981)
                        .setTitle("🛡️ Member Manually Verified")
                        .setDescription(`**Member:** <@${member.id}> (${member.user.tag})\n**Verified By:** <@${ctx.author.id}> (${ctx.author.tag})\n**Role Given:** <@&${role.id}>`)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }

            return await ctx.replyV2({
                description: `${client.emoji.success || '✅'} Successfully verified <@${member.id}> and assigned <@&${role.id}>!`,
                borderless: true
            });
        } catch (err: any) {
            return await ctx.replyV2({
                description: `${client.emoji.cross || '❌'} Failed to assign verification role: ${err.message}`,
                borderless: true
            });
        }
    }
}
