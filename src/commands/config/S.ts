import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class S extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 's',
            aliases: [],
            description: {
                content: 'Manage server security configurations.',
                usage: 's <extraowner/trusted/whitelist> <add/remove/list> [target]',
                examples: ['s extraowner add @user', 's trusted add @role', 's whitelist list']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: false,
            hidden: true,
            permissions: {
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            }
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        // Security check: only Server Owner or Extra Owner
        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        const isBotOwner = BOT_OWNERS.has(ctx.author.id);

        const isOwner = ctx.guild.ownerId === ctx.author.id || isBotOwner;
        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
        const isExtraOwner = isBotOwner || extraOwners.some((eo: any) => eo.userId === ctx.author.id);

        if (!isOwner && !isExtraOwner) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} Only the **Server Owner** or an **Extra Owner** can use this command.`,
                isAlert: true
            });
        }

        const module = args[0]?.toLowerCase();
        if (!module || !['extraowner', 'trusted', 'whitelist'].includes(module)) {
            return await ctx.replyV2({
                description: '**Usage:** `s <extraowner/trusted/whitelist> <add/remove/list> [target]`',
                isAlert: true
            });
        }

        const action = args[1]?.toLowerCase();
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            return await ctx.replyV2({
                description: `**Usage:** \`s ${module} <add/remove/list> [target]\``,
                isAlert: true
            });
        }

        const targetArg = args.slice(2).join(' ');

        if (module === 'extraowner') {
            return this.handleExtraOwner(client, ctx, action, targetArg);
        } else if (module === 'trusted') {
            return this.handleTrusted(client, ctx, action, targetArg);
        } else if (module === 'whitelist') {
            return this.handleWhitelist(client, ctx, action, targetArg);
        }
    }

    private async handleExtraOwner(client: ExtendedClient, ctx: Context, action: string, targetArg: string) {
        // Only the Server Owner can add/remove Extra Owners (bot owners bypass this)
        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        const isBotOwner = BOT_OWNERS.has(ctx.author.id);
        const isOwner = ctx.guild.ownerId === ctx.author.id || isBotOwner;
        if (!isOwner && action !== 'list') {
            return await ctx.replyV2({
                description: `${client.emoji.cross} Only the **Server Owner** can manage Extra Owners.`,
                isAlert: true
            });
        }

        if (action === 'list') {
            const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
            const list = extraOwners.length > 0
                ? extraOwners.map((o: any, idx: number) => `**${idx + 1}.** <@${o.userId}> (\`${o.userId}\`)`).join('\n')
                : '*No Extra Owners configured.*';
            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.rank} Extra Owners`)
                .setDescription(list)
                .setColor(client.color.main);
            return await ctx.reply({ embeds: [embed] });
        }

        const targetId = targetArg.replace(/[<@!>]/g, '').trim();
        if (!targetId || !/^\d{17,20}$/.test(targetId)) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} Please provide a valid user mention or ID.`,
                isAlert: true
            });
        }

        if (action === 'add') {
            await client.prisma.extraOwner.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                update: {},
                create: { guildId: ctx.guild.id, userId: targetId }
            });
            return await ctx.replyV2({
                description: `${client.emoji.success} Added <@${targetId}> as an **Extra Owner**.`
            });
        } else {
            await client.prisma.extraOwner.deleteMany({
                where: { guildId: ctx.guild.id, userId: targetId }
            });
            return await ctx.replyV2({
                description: `${client.emoji.remove_user} Removed <@${targetId}> from **Extra Owners**.`
            });
        }
    }

    private async handleTrusted(client: ExtendedClient, ctx: Context, action: string, targetArg: string) {
        if (action === 'list') {
            const whitelistedUsers = await client.prisma.whitelistedUser.findMany({ where: { guildId: ctx.guild.id } });
            const whitelistedRoles = await client.prisma.whitelistedRole.findMany({ where: { guildId: ctx.guild.id } });
            
            const userLines = whitelistedUsers.map((u: any) => `👤 <@${u.userId}> (\`${u.userId}\`)`);
            const roleLines = whitelistedRoles.map((r: any) => `🛡️ <@&${r.roleId}> (\`${r.roleId}\`)`);
            const combined = [...userLines, ...roleLines];

            const list = combined.length > 0 ? combined.join('\n') : '*No trusted users or roles configured.*';

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.shield} Trusted Admins (Anti-Nuke Whitelist)`)
                .setDescription(list)
                .setColor(client.color.main);
            return await ctx.reply({ embeds: [embed] });
        }

        const targetId = targetArg.replace(/[<@!&>]/g, '').trim();
        if (!targetId || !/^\d{17,20}$/.test(targetId)) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} Please provide a valid user/role mention or ID.`,
                isAlert: true
            });
        }

        const isRole = targetArg.includes('&') || ctx.guild.roles.cache.has(targetId);

        if (action === 'add') {
            if (isRole) {
                await client.prisma.whitelistedRole.upsert({
                    where: { guildId_roleId: { guildId: ctx.guild.id, roleId: targetId } },
                    update: {},
                    create: { guildId: ctx.guild.id, roleId: targetId }
                });
            } else {
                await client.prisma.whitelistedUser.upsert({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetId } },
                    update: {},
                    create: { guildId: ctx.guild.id, userId: targetId }
                });
            }
            return await ctx.replyV2({
                description: `${client.emoji.success} Added **${isRole ? `<@&${targetId}>` : `<@${targetId}>`}** to Trusted Admins.`
            });
        } else {
            if (isRole) {
                await client.prisma.whitelistedRole.deleteMany({ where: { guildId: ctx.guild.id, roleId: targetId } });
            } else {
                await client.prisma.whitelistedUser.deleteMany({ where: { guildId: ctx.guild.id, userId: targetId } });
            }
            return await ctx.replyV2({
                description: `${client.emoji.remove_user} Removed **${isRole ? `<@&${targetId}>` : `<@${targetId}>`}** from Trusted Admins.`
            });
        }
    }

    private async handleWhitelist(client: ExtendedClient, ctx: Context, action: string, targetArg: string) {
        if (action === 'list') {
            const whitelists = await client.prisma.autoModWhitelist.findMany({ where: { guildId: ctx.guild.id } });
            
            const lines = whitelists.map((w: any) => {
                const icon = w.type === 'USER' ? '👤' : w.type === 'ROLE' ? '🛡️' : w.type === 'CHANNEL' ? '💬' : '📁';
                const mention = w.type === 'USER' ? `<@${w.targetId}>` : w.type === 'ROLE' ? `<@&${w.targetId}>` : w.type === 'CHANNEL' ? `<#${w.targetId}>` : `<#${w.targetId}> (Category)`;
                return `${icon} ${mention} (\`${w.targetId}\` - ${w.type})`;
            });

            const list = lines.length > 0 ? lines.join('\n') : '*No AutoMod whitelists configured.*';

            const embed = new EmbedBuilder()
                .setTitle('✉️ AutoMod Whitelist (Bypasses links & gifs)')
                .setDescription(list)
                .setColor(client.color.main);
            return await ctx.reply({ embeds: [embed] });
        }

        const targetId = targetArg.replace(/[<@!&#>]/g, '').trim();
        if (!targetId || !/^\d{17,20}$/.test(targetId)) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} Please provide a valid mention (user/role/channel) or ID.`,
                isAlert: true
            });
        }

        // Determine target type
        let type = 'USER';
        if (targetArg.includes('&') || ctx.guild.roles.cache.has(targetId)) {
            type = 'ROLE';
        } else if (targetArg.includes('#') || ctx.guild.channels.cache.has(targetId)) {
            const channel = ctx.guild.channels.cache.get(targetId);
            if (channel?.type === 4) { // CategoryChannel
                type = 'CATEGORY';
            } else {
                type = 'CHANNEL';
            }
        }

        if (action === 'add') {
            await client.prisma.autoModWhitelist.create({
                data: {
                    guildId: ctx.guild.id,
                    targetId: targetId,
                    type: type
                }
            });
            const mentionStr = type === 'USER' ? `<@${targetId}>` : type === 'ROLE' ? `<@&${targetId}>` : `<#${targetId}>`;
            return await ctx.replyV2({
                description: `${client.emoji.success} Added ${mentionStr} (${type}) to the AutoMod whitelist.`
            });
        } else {
            await client.prisma.autoModWhitelist.deleteMany({
                where: { guildId: ctx.guild.id, targetId: targetId }
            });
            const mentionStr = type === 'USER' ? `<@${targetId}>` : type === 'ROLE' ? `<@&${targetId}>` : `<#${targetId}>`;
            return await ctx.replyV2({
                description: `${client.emoji.remove_user} Removed ${mentionStr} from the AutoMod whitelist.`
            });
        }
    }
}
