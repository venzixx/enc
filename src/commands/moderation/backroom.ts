import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Backroom extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'backroom',
            description: {
                content: 'Banish or unbansh a user to the backrooms, or set it up.',
                usage: 'backroom <add/remove/setup>',
                examples: ['backroom setup', 'backroom add @user', 'backroom remove @user']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels]
            },
            options: [
                {
                    name: 'setup',
                    description: 'Creates the Backroom role and channel, updating config.',
                    type: 1
                },
                {
                    name: 'add',
                    description: 'Strips all roles and banishes user to the backrooms.',
                    type: 1,
                    options: [
                        { name: 'user', description: 'The user to banish', type: 6, required: true }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Restores user roles and unbanishes them.',
                    type: 1,
                    options: [
                        { name: 'user', description: 'The user to rescue', type: 6, required: true }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand();

        if (sub === 'setup') {
            const existing = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });

            // Create backroom role
            const role = await ctx.guild.roles.create({
                name: 'The Backrooms',
                color: '#000000',
                reason: 'Backroom Setup'
            });

            // Create backroom channel
            const channel = await ctx.guild.channels.create({
                name: 'the-backrooms',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: ctx.guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: role.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    }
                ],
                reason: 'Backroom Setup'
            });

            // Put it in DB
            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: {
                    backroomRoleId: role.id,
                    backroomChannelId: channel.id
                }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Backroom Setup Complete`,
                description: `Created role ${role} and channel ${channel}.`,
                color: client.color.main
            });
        }

        if (sub === 'add') {
            const memberId = ctx.options.getMember('user');
            if (!memberId) return ctx.replyV2({ description: 'Member not found.', color: client.color.red, isAlert: true });
            
            const target = await ctx.guild.members.fetch(memberId).catch(() => null);
            if (!target) return ctx.replyV2({ description: 'Could not fetch member from server.', color: client.color.red, isAlert: true });

            const config = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
            if (!config?.backroomRoleId) {
                return ctx.replyV2({ description: 'The backrooms have not been set up. Use `/backroom setup` first.', color: client.color.red, isAlert: true });
            }

            // Save old roles
            const oldRoles = (target.roles.cache as any).filter((r: any) => r.id !== ctx.guild.id && r.name !== '@everyone').map((r: any) => r.id);
            
            await (client.prisma as any).backroomHistory.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } },
                update: { roleIds: JSON.stringify(oldRoles) },
                create: { guildId: ctx.guild.id, userId: target.id, roleIds: JSON.stringify(oldRoles) }
            });

            // Remove all roles and add backroom role
            await target.roles.set([config.backroomRoleId]).catch(() => null);

            return ctx.replyV2({
                title: `${client.emoji.success} User Banished`,
                description: `${target} has been sent to the Backrooms. All their roles have been saved and stripped.`,
                color: client.color.main
            });
        }

        if (sub === 'remove') {
            const memberId = ctx.options.getMember('user');
            if (!memberId) return ctx.replyV2({ description: 'Member not found.', color: client.color.red, isAlert: true });

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
                return ctx.replyV2({ description: `${target} has no backroom history. We cannot restore their rules natively.`, color: client.color.red, isAlert: true });
            }

            const rolesToRestore = JSON.parse(history.roleIds) as string[];
            
            // Set roles back (filtering out backroom if it's there somehow)
            const rolesObj = (target.roles.cache as any).map((r: any) => r.id).filter((id: any) => id !== config.backroomRoleId);
            
            await target.roles.set([...rolesToRestore, ...rolesObj]).catch(() => null);
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
}
