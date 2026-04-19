import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Autorole extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'autorole',
            description: {
                content: 'Manage the role automatically given to new members.',
                usage: 'autorole <add/remove> [role]',
                examples: ['autorole add @Member', 'autorole remove']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: false,
            hidden: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.Administrator]
            },
            options: [
                {
                    name: 'add',
                    description: 'Set a role for new members to receive',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role to assign', type: 8, required: true }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Disable the autorole feature',
                    type: 1
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const sub = ctx.options.getSubcommand();

        if (sub === 'add') {
            const role = ctx.options.getRole('role');

            await client.prisma.guild.upsert({
                where: { id: ctx.guild.id },
                update: { autoroleId: role.id },
                create: { id: ctx.guild.id, autoroleId: role.id }
            });

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Autorole Enabled`)
                .setDescription(`New members will now automatically receive the **${role.name}** role.`)
                .setColor(client.color.main)
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });
        } else {
            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: { autoroleId: null }
            });

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Autorole Disabled`)
                .setDescription('The autorole feature has been disabled. New members will no longer receive a default role.')
                .setColor(client.color.main)
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });
        }
    }
}
