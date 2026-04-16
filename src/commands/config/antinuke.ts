import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    ChannelType
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class AntiNuke extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'antinuke',
            description: {
                content: 'Manage the Wick-style Anti-Nuke security system.',
                usage: 'antinuke <subcommand>',
                examples: ['antinuke status', 'antinuke enable', 'antinuke trust add @User']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.Administrator]
            },
            options: [
                {
                    name: 'status',
                    description: 'Show the Anti-Nuke dashboard and security audit.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'config',
                    description: 'Manage the Anti-Nuke global state or specific categories.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'category',
                            description: 'Select "Global" or a specific category',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Global System', value: 'antiNukeEnabled' },
                                { name: 'Ban Protection', value: 'antiNukeBan' },
                                { name: 'Kick Protection', value: 'antiNukeKick' },
                                { name: 'Channel Protection', value: 'antiNukeChannel' },
                                { name: 'Role Protection', value: 'antiNukeRole' },
                                { name: 'Bot Shield', value: 'antiNukeBot' },
                                { name: 'Webhook Integrity', value: 'antiNukeWebhook' }
                            ]
                        },
                        {
                            name: 'state',
                            description: 'Enable or disable protection',
                            type: ApplicationCommandOptionType.Boolean,
                            required: true
                        }
                    ]
                },
                {
                    name: 'trust',
                    description: 'Manage the security whitelist (Extra Admins).',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'Whether to add or remove from whitelist',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Add', value: 'add' },
                                { name: 'Remove', value: 'remove' }
                            ]
                        },
                        {
                            name: 'target',
                            description: 'The user or role to trust/untrust',
                            type: ApplicationCommandOptionType.Mentionable,
                            required: true
                        }
                    ]
                },
                {
                    name: 'extraowner',
                    description: 'Manage the Extra Owner inner circle.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'Whether to add or remove extra owner',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Add', value: 'add' },
                                { name: 'Remove', value: 'remove' }
                            ]
                        },
                        {
                            name: 'user',
                            description: 'The user to add/remove',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const subcommand = ctx.options.getSubcommand();

        // Security Check: Only the Server Owner or an Extra Owner can use /antinuke
        const isOwner = ctx.guild.ownerId === ctx.author.id;
        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
        const isExtraOwner = extraOwners.some((eo: any) => eo.userId === ctx.author.id);

        if (!isOwner && !isExtraOwner) {
            return await ctx.reply({ 
                content: '❌ Only the **Server Owner** or an **Extra Owner** can manage Anti-Nuke settings.', 
                ephemeral: true 
            });
        }

        if (subcommand === 'status') {
            return this.handleStatus(client, ctx);
        }

        if (subcommand === 'config') {
            const category = ctx.options.getString('category');
            const state = ctx.options.getBoolean('state');

            await client.prisma.guild.upsert({
                where: { id: ctx.guild.id },
                update: { [category]: state },
                create: { id: ctx.guild.id, [category]: state }
            });

            const name = category === 'antiNukeEnabled' ? 'Global Anti-Nuke' : category.replace('antiNuke', '') + ' Protection';
            return await ctx.reply({ content: `🛡️ **${name}** has been **${state ? 'Enabled' : 'Disabled'}**.` });
        }

        if (subcommand === 'trust') {
            const action = ctx.options.getString('action');
            const target = ctx.options.getMentionable('target');

            if (action === 'add') {
                if ('username' in target) { // User
                    await client.prisma.whitelistedUser.upsert({
                        where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } },
                        update: {},
                        create: { guildId: ctx.guild.id, userId: target.id }
                    });
                } else { // Role
                    await client.prisma.whitelistedRole.upsert({
                        where: { guildId_roleId: { guildId: ctx.guild.id, roleId: target.id } },
                        update: {},
                        create: { guildId: ctx.guild.id, roleId: target.id }
                    });
                }
                return await ctx.reply({ content: `✅ Added **${target.displayName || target.name}** to the security whitelist.` });
            } else {
                if ('username' in target) {
                    await client.prisma.whitelistedUser.deleteMany({ where: { guildId: ctx.guild.id, userId: target.id } });
                } else {
                    await client.prisma.whitelistedRole.deleteMany({ where: { guildId: ctx.guild.id, roleId: target.id } });
                }
                return await ctx.reply({ content: `🗑️ Removed **${target.displayName || target.name}** from the security whitelist.` });
            }
        }

        if (subcommand === 'extraowner') {
            const action = ctx.options.getString('action');
            const user = ctx.options.getUser('user');

            if (action === 'add') {
                await client.prisma.extraOwner.upsert({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } },
                    update: {},
                    create: { guildId: ctx.guild.id, userId: user.id }
                });
                return await ctx.reply({ content: `👑 Added **${user.tag}** as an **Extra Owner**.` });
            } else {
                await client.prisma.extraOwner.deleteMany({ where: { guildId: ctx.guild.id, userId: user.id } });
                return await ctx.reply({ content: `🗑️ Removed **${user.tag}** from the Extra Owners.` });
            }
        }
    }

    private async handleStatus(client: ExtendedClient, ctx: Context) {
        const guildData = await client.prisma.guild.findUnique({
            where: { id: ctx.guild.id },
            include: {
                extraOwners: true,
                whitelistedUsers: true,
                whitelistedRoles: true
            }
        });

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Anti-Nuke Dashboard')
            .setColor(client.color.main)
            .setThumbnail(ctx.guild.iconURL())
            .addFields(
                { name: '📡 System Status', value: `Global: ${guildData?.antiNukeEnabled ? '✅' : '❌'}`, inline: true },
                { name: '🛡️ Categories', value: [
                    `${guildData?.antiNukeBan ? '✅' : '❌'} Ban`,
                    `${guildData?.antiNukeKick ? '✅' : '❌'} Kick`,
                    `${guildData?.antiNukeChannel ? '✅' : '❌'} Channel`,
                    `${guildData?.antiNukeRole ? '✅' : '❌'} Role`,
                    `${guildData?.antiNukeBot ? '✅' : '❌'} Bot`,
                    `${guildData?.antiNukeWebhook ? '✅' : '❌'} Webhook`,
                ].join('\n'), inline: true },
                { name: '👑 Extra Owners', value: guildData?.extraOwners.length ? guildData.extraOwners.map(o => `<@${o.userId}>`).join(', ') : 'None', inline: false }
            );

        // Security Audit Logic
        const members = await ctx.guild.members.fetch();
        const threats = members.filter((m: any) => 
            !m.user.bot && 
            m.id !== ctx.guild.ownerId &&
            !guildData?.extraOwners.some((eo: any) => eo.userId === m.id) &&
            !guildData?.whitelistedUsers.some((wu: any) => wu.userId === m.id) &&
            !m.roles.cache.some((r: any) => guildData?.whitelistedRoles.some((wr: any) => wr.roleId === r.id)) &&
            (m.permissions.has(PermissionFlagsBits.Administrator) || m.permissions.has(PermissionFlagsBits.ManageGuild))
        );

        let threatList = threats.size > 0 
           ? threats.map((m: any) => `• <@${m.id}> (\`${m.id}\`)`).slice(0, 10).join('\n') + (threats.size > 10 ? `\n*+ ${threats.size - 10} more*` : '')
           : '✅ No at-risk users found.';

        embed.addFields({ name: '🚨 Security Audit (Un-whitelisted Privileged Users)', value: threatList });

        return await ctx.reply({ embeds: [embed] });
    }
}
