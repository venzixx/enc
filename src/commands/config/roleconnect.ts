import { EmbedBuilder, PermissionFlagsBits, ApplicationCommandOptionType, Role, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class RoleConnect extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'roleconnect',
            description: {
                content: 'Link roles together so that giving one gives the others.',
                usage: 'roleconnect <add/remove/list> <trigger_role> [connected_role]',
                examples: ['roleconnect add @Vip @Premium', 'roleconnect remove @Vip @Premium', 'roleconnect list']
            },
            aliases: ['roleconnection'],
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.ManageRoles]
            },
            options: [
                {
                    name: 'add',
                    description: 'Connect a role to a trigger role',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'trigger',
                            description: 'The role that triggers the connection',
                            type: ApplicationCommandOptionType.Role,
                            required: true
                        },
                        {
                            name: 'target',
                            description: 'The role to be automatically given',
                            type: ApplicationCommandOptionType.Role,
                            required: true
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Disconnect a role from a trigger role',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'trigger',
                            description: 'The role that triggers the connection',
                            type: ApplicationCommandOptionType.Role,
                            required: true
                        },
                        {
                            name: 'target',
                            description: 'The role to disconnect',
                            type: ApplicationCommandOptionType.Role,
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all role connections',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const sub = ctx.options.getSubcommand();

        if (sub === 'add') {
            const trigger = ctx.options.getRole('trigger') as Role;
            const target = ctx.options.getRole('target') as Role;

            if (trigger.id === target.id) {
                return ctx.reply({ content: `${client.emoji.cross} Trigger role and target role cannot be the same.` });
            }

            try {
                await client.prisma.roleConnection.upsert({
                    where: {
                        guildId_triggerRoleId_connectedRoleId: {
                            guildId: ctx.guild.id,
                            triggerRoleId: trigger.id,
                            connectedRoleId: target.id
                        }
                    },
                    update: {},
                    create: {
                        guildId: ctx.guild.id,
                        triggerRoleId: trigger.id,
                        connectedRoleId: target.id
                    }
                });

                const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.success} Role Connection Added`)
                    .setDescription(`Successfully linked **${trigger.name}** to **${target.name}**.\nWhen a member receives the **${trigger.name}** role, they will also get **${target.name}**.`)
                    .setColor(client.color.main)
                    .setTimestamp();

                await ctx.reply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await ctx.reply({ content: `${client.emoji.cross} An error occurred while saving the role connection.` });
            }
        } else if (sub === 'remove') {
            const trigger = ctx.options.getRole('trigger') as Role;
            const target = ctx.options.getRole('target') as Role;

            try {
                await client.prisma.roleConnection.delete({
                    where: {
                        guildId_triggerRoleId_connectedRoleId: {
                            guildId: ctx.guild.id,
                            triggerRoleId: trigger.id,
                            connectedRoleId: target.id
                        }
                    }
                });

                const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.success} Role Connection Removed`)
                    .setDescription(`Successfully unlinked **${trigger.name}** and **${target.name}**.`)
                    .setColor(client.color.main)
                    .setTimestamp();

                await ctx.reply({ embeds: [embed] });
            } catch (error) {
                await ctx.reply({ content: `${client.emoji.cross} No such connection found between **${trigger.name}** and **${target.name}**.` });
            }
        } else if (sub === 'list') {
            const connections = await client.prisma.roleConnection.findMany({
                where: { guildId: ctx.guild.id }
            });

            if (connections.length === 0) {
                return ctx.reply({ content: `${client.emoji.cross} No role connections found for this server.` });
            }

            // Group by trigger role
            const grouped = connections.reduce((acc, conn) => {
                if (!acc[conn.triggerRoleId]) acc[conn.triggerRoleId] = [];
                acc[conn.triggerRoleId].push(conn.connectedRoleId);
                return acc;
            }, {} as Record<string, string[]>);

            const entries = Object.entries(grouped);
            const itemsPerPage = 5;
            const totalPages = Math.ceil(entries.length / itemsPerPage);
            let currentPage = 0;

            const generateEmbed = (page: number) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const currentEntries = entries.slice(start, end);

                const embed = new EmbedBuilder()
                    .setTitle('Role Connections')
                    .setColor(client.color.main)
                    .setTimestamp()
                    .setFooter({ text: `Page ${page + 1} of ${totalPages} | Total Triggers: ${entries.length}` });

                const description = currentEntries.map(([tRoleId, cRoleIds]) => {
                    const tRole = ctx.guild.roles.cache.get(tRoleId);
                    const cRoles = cRoleIds.map(id => ctx.guild.roles.cache.get(id)).filter(Boolean);
                    return `**${tRole ? `<@&${tRole.id}>` : 'Unknown Role'}**\n${cRoles.map(r => `\u2514 <@&${r!.id}>`).join('\n')}`;
                }).join('\n\n');

                embed.setDescription(description || 'No connections to display on this page.');
                return embed;
            };

            const generateButtons = (page: number) => {
                const row = new ActionRowBuilder<ButtonBuilder>();
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );
                return row;
            };

            const response = await ctx.reply({ 
                embeds: [generateEmbed(currentPage)], 
                components: totalPages > 1 ? [generateButtons(currentPage)] : [],
                fetchReply: true
            });

            if (totalPages > 1) {
                const collector = (response as any).createMessageComponentCollector({
                    filter: (i: any) => i.user.id === ctx.author.id,
                    time: 60000,
                    componentType: ComponentType.Button
                });

                collector.on('collect', async (i: any) => {
                    if (i.customId === 'prev') currentPage--;
                    if (i.customId === 'next') currentPage++;

                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                });

                collector.on('end', async () => {
                    const disabledRow = generateButtons(currentPage);
                    disabledRow.components.forEach(c => c.setDisabled(true));
                    await (response as any).edit({ components: [disabledRow] }).catch(() => null);
                });
            }
        }
    }
}
