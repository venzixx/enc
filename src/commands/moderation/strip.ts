import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    GuildMember, 
    Role,
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { isDev } from '../../utils/devCheck';

const DANGEROUS_PERMS = [
    { flag: PermissionFlagsBits.Administrator, label: 'Administrator' },
    { flag: PermissionFlagsBits.ManageGuild, label: 'Manage Server' },
    { flag: PermissionFlagsBits.ManageRoles, label: 'Manage Roles' },
    { flag: PermissionFlagsBits.ManageChannels, label: 'Manage Channels' },
    { flag: PermissionFlagsBits.KickMembers, label: 'Kick Members' },
    { flag: PermissionFlagsBits.BanMembers, label: 'Ban Members' },
    { flag: PermissionFlagsBits.ModerateMembers, label: 'Timeout/Mute' },
    { flag: PermissionFlagsBits.ManageMessages, label: 'Manage Messages' },
    { flag: PermissionFlagsBits.ManageWebhooks, label: 'Manage Webhooks' },
    { flag: PermissionFlagsBits.ManageGuildExpressions, label: 'Manage Emojis/Stickers' },
    { flag: PermissionFlagsBits.MentionEveryone, label: 'Mention Everyone' },
    { flag: PermissionFlagsBits.ViewAuditLog, label: 'View Audit Log' },
    { flag: PermissionFlagsBits.ManageEvents, label: 'Manage Events' },
    { flag: PermissionFlagsBits.ManageThreads, label: 'Manage Threads' },
    { flag: PermissionFlagsBits.MuteMembers, label: 'Voice Mute' },
    { flag: PermissionFlagsBits.DeafenMembers, label: 'Voice Deafen' },
    { flag: PermissionFlagsBits.MoveMembers, label: 'Voice Move' },
];

export default class StripCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'strip',
            aliases: ['rolestrip', 'stripstaff', 'stripdangerous'],
            description: {
                content: 'Strip all dangerous and staff permissions/roles from a member (Admin only).',
                usage: 'strip <user>',
                examples: ['strip @User']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'user',
                    description: 'The member to strip dangerous roles from',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const developer = await isDev(client, ctx.author.id);
        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        const isOwner = BOT_OWNERS.has(ctx.author.id);
        const isAdmin = ctx.member?.permissions.has(PermissionFlagsBits.Administrator) || ctx.author.id === ctx.guild.ownerId || isOwner || developer;

        if (!isAdmin) {
            return ctx.reply({ content: `${client.emoji.cross} Only administrators can use the \`strip\` command.` });
        }

        let target: GuildMember | null = null;
        if (ctx.interaction) {
            target = ctx.options.getMember('user') as GuildMember;
        } else {
            target = await Resolver.resolveMember(ctx, args[0]);
        }

        if (!target) {
            return ctx.reply({ content: `${client.emoji.cross} Could not find that member in this server. Usage: \`${ctx.prefix}strip <user>\`` });
        }

        if (target.id === ctx.guild.ownerId) {
            return ctx.reply({ content: `${client.emoji.cross} You cannot strip roles from the server owner.` });
        }

        if (target.id === ctx.author.id && !isOwner) {
            return ctx.reply({ content: `${client.emoji.cross} You cannot strip roles from yourself.` });
        }

        const isCallerGuildOwner = ctx.author.id === ctx.guild.ownerId;
        if (!isCallerGuildOwner && !isOwner && target.roles.highest.position >= ctx.member!.roles.highest.position) {
            return ctx.reply({ content: `${client.emoji.cross} Hierarchy Violation: You cannot strip roles from someone with an equal or higher role than you.` });
        }

        const botMember = ctx.guild.members.me as GuildMember;
        const botHighest = botMember.roles.highest.position;

        const dangerousRolesToRemove: { role: Role; perms: string[] }[] = [];
        const unmanageableDangerousRoles: { role: Role; perms: string[] }[] = [];
        const safeRolesKept: Role[] = [];

        for (const [, memberRole] of target.roles.cache) {
            if (memberRole.id === ctx.guild.id) continue; // skip @everyone

            const permsFound = DANGEROUS_PERMS
                .filter(p => memberRole.permissions.has(p.flag))
                .map(p => p.label);

            if (permsFound.length > 0) {
                if (memberRole.managed || memberRole.position >= botHighest) {
                    unmanageableDangerousRoles.push({ role: memberRole, perms: permsFound });
                } else {
                    dangerousRolesToRemove.push({ role: memberRole, perms: permsFound });
                }
            } else {
                safeRolesKept.push(memberRole);
            }
        }

        if (dangerousRolesToRemove.length === 0 && unmanageableDangerousRoles.length === 0) {
            return ctx.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🛡️ Role Strip Check')
                        .setDescription(`**${target.user.tag}** has no dangerous or staff permissions.\n\nAll **${safeRolesKept.length}** normal role(s) remain untouched.`)
                        .setColor(client.color.main)
                        .setFooter({ text: `Requested by ${ctx.author.tag}` })
                        .setTimestamp()
                ]
            });
        }

        if (dangerousRolesToRemove.length > 0) {
            await target.roles.remove(
                dangerousRolesToRemove.map(r => r.role),
                `Dangerous roles stripped by admin ${ctx.author.tag}`
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Dangerous Roles Stripped')
            .setDescription(`Processed role strip for **${target.user.tag}** (${target.id})`)
            .setColor(dangerousRolesToRemove.length > 0 ? client.color.main : client.color.red)
            .setFooter({ text: `Stripped by ${ctx.author.tag}` })
            .setTimestamp();

        if (dangerousRolesToRemove.length > 0) {
            const removedText = dangerousRolesToRemove
                .map(r => `• <@&${r.role.id}> (\`${r.perms.slice(0, 3).join(', ')}${r.perms.length > 3 ? ` +${r.perms.length - 3} more` : ''}\`)`)
                .join('\n');
            embed.addFields({
                name: `❌ Stripped Roles (${dangerousRolesToRemove.length})`,
                value: removedText.length > 1024 ? removedText.slice(0, 1020) + '...' : removedText
            });
        }

        if (unmanageableDangerousRoles.length > 0) {
            const unmanagedText = unmanageableDangerousRoles
                .map(r => `• <@&${r.role.id}> (${r.role.managed ? 'Managed Role' : 'Above Bot Role'})`)
                .join('\n');
            embed.addFields({
                name: `⚠️ Could Not Remove (${unmanageableDangerousRoles.length})`,
                value: unmanagedText.length > 1024 ? unmanagedText.slice(0, 1020) + '...' : unmanagedText
            });
        }

        const keptText = safeRolesKept.length > 0
            ? safeRolesKept.map(r => `<@&${r.id}>`).join(', ')
            : 'None';
        embed.addFields({
            name: `✅ Kept Normal Roles (${safeRolesKept.length})`,
            value: keptText.length > 1024 ? keptText.slice(0, 1020) + '...' : keptText
        });

        return ctx.reply({ embeds: [embed] });
    }
}
