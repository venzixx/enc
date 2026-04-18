import { PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Unbackroom extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unbackroom',
            description: {
                content: 'Restores user roles and unbanishes them from the backrooms.',
                usage: 'unbackroom <user>',
                examples: ['unbackroom @user']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: false,
            hidden: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.ManageRoles]
            },
            options: [
                { name: 'user', description: 'The user to rescue', type: 6, required: true }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const memberId = ctx.options.getMember('user') || args[0]?.replace(/[<@!>]/g, '');
        if (!memberId) return ctx.replyV2({ description: 'Please specify a user to rescue.', color: client.color.red, isAlert: true });

        const target = await ctx.guild.members.fetch(memberId).catch(() => null);
        if (!target) return ctx.replyV2({ description: 'Could not fetch member from server.', color: client.color.red, isAlert: true });

        const config = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
        if (!config?.backroomRoleId) {
            return ctx.replyV2({ description: 'The backrooms have not been set up.', color: client.color.red, isAlert: true });
        }

        const history = await (client.prisma as any).backroomHistory.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
        });

        if (!history) {
            return ctx.replyV2({ description: `${target} has no backroom history record. I cannot restore their original roles automatically.`, color: client.color.red, isAlert: true });
        }

        const rolesToRestore = JSON.parse(history.roleIds) as string[];
        
        // Remove backroom role and add saved roles
        await target.roles.set(rolesToRestore.filter(id => id !== config.backroomRoleId)).catch((err: any) => {
            console.error(err);
            return null;
        });

        await (client.prisma as any).backroomHistory.delete({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
        });

        return ctx.replyV2({
            title: `${client.emoji.success} User Rescued`,
            description: `${target} has been un-banished. Their previous roles were restored.`,
            color: client.color.main
        });
    }
}
