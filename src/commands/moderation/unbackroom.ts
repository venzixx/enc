import { 
    PermissionFlagsBits, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { ModConfirmation } from '../../utils/ModConfirmation';
import { logModerationAction } from '../../utils/Logger';

export default class Unbackroom extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unbackroom',
            aliases: ['rescue', 'freebackroom'],
            description: {
                content: 'Restores user roles and unbanishes them from the backrooms.',
                usage: 'unbackroom <user>',
                examples: ['unbackroom @user']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.ManageRoles]
            },
            options: [
                { 
                    name: 'user', 
                    description: 'The member to rescue from the backrooms', 
                    type: ApplicationCommandOptionType.User, 
                    required: true 
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const targetUser = ctx.isInteraction 
            ? ctx.options.getUser('user') 
            : (ctx.message?.mentions.users.first() || (args[0] ? await client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null));

        if (!targetUser) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross} Missing User`,
                description: 'Please specify a member to rescue from the backrooms.', 
                borderless: true,
                isAlert: true,
                color: null 
            });
        }

        const target = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
        if (!target) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross} Member Not Found`,
                description: 'Could not fetch that member from this server.', 
                borderless: true,
                isAlert: true,
                color: null 
            });
        }

        const config = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
        if (!config?.backroomRoleId) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross} Not Configured`,
                description: 'The backrooms have not been set up in this server. Run `/backroom setup` first.', 
                borderless: true,
                isAlert: true,
                color: null 
            });
        }

        // Find active backroom case for this member
        const activeCase = await client.prisma.case.findFirst({
            where: {
                guildId: ctx.guild.id,
                targetId: target.id,
                type: 'BACKROOM',
                active: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const force = args.includes('--force') || args.includes('-f');
        const confirmed = await ModConfirmation.ask({
            client,
            ctx,
            actionName: 'Rescue from Backrooms',
            targetName: `${target.user.tag} (${target.id})`,
            targetAvatar: target.user.displayAvatarURL(),
            dangerLevel: 'primary',
            details: 'This will restore their saved roles and remove them from quarantine.',
            confirmLabel: 'Confirm Rescue',
            confirmEmoji: '✨',
            force
        });

        if (!confirmed) return;

        let rolesToRestore: string[] = [];
        if (activeCase?.removedRoles) {
            try {
                rolesToRestore = JSON.parse(activeCase.removedRoles);
            } catch (_) {}
        }

        // Filter valid server roles (excluding backroom role) and preserve current managed roles
        const validRoles = rolesToRestore.filter(id => id !== config.backroomRoleId && ctx.guild.roles.cache.has(id));
        const currentManaged = (target.roles.cache as any).filter((r: any) => r.managed).map((r: any) => r.id);
        const finalRoles = Array.from(new Set([...validRoles, ...currentManaged]));

        await target.roles.set(finalRoles).catch(() => null);

        if (activeCase) {
            await client.prisma.case.update({
                where: { id: activeCase.id },
                data: { active: false }
            });
        }

        await logModerationAction(client, ctx.guild, 'Rescue from Backrooms', ctx.author, target.user, 'Rescued from Backrooms');

        return ctx.replyV2({
            title: `${client.emoji.success} Member Rescued from Backrooms`,
            description: 
                `${target} has been un-banished and rescued from the Backrooms!\n\n` +
                `• **Target:** ${target.user.tag} (\`${target.id}\`)\n` +
                `• **Moderator:** <@${ctx.author.id}>\n` +
                `• **Restored Roles:** ${validRoles.length} role(s) restored\n` +
                `• **Quarantine Status:** Removed from quarantine`,
            borderless: true,
            color: null
        });
    }
}
