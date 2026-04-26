import { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class StreakTierCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'streaktier',
            description: {
                content: 'Manage streak tiers for your server.',
                usage: 'streaktier <add|remove|list>',
                examples: ['streaktier add Bronze 10', 'streaktier list']
            },
            category: 'config',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'add',
                    description: 'Add a new streak tier',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'name',
                            description: 'Name of the tier (e.g. Bronze, Gold)',
                            type: ApplicationCommandOptionType.String,
                            required: true
                        },
                        {
                            name: 'threshold',
                            description: 'Number of messages per day to maintain this streak',
                            type: ApplicationCommandOptionType.Integer,
                            required: true,
                            min_value: 1
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove a streak tier',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'threshold',
                            description: 'The threshold of the tier to remove',
                            type: ApplicationCommandOptionType.Integer,
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all configured streak tiers',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<void> {
        const subcommand = ctx.options.getSubcommand();

        if (subcommand === 'add') {
            const name = ctx.options.getString('name', true);
            const threshold = ctx.options.getInteger('threshold', true);

            // Check if threshold already exists
            const existing = await client.prisma.streakTier.findUnique({
                where: {
                    guildId_threshold: {
                        guildId: ctx.guild!.id,
                        threshold
                    }
                }
            });

            if (existing) {
                await ctx.reply({ content: `❌ A streak tier with a threshold of **${threshold}** already exists (${existing.name}). Please remove it first or use a different threshold.` });
                return;
            }

            await client.prisma.streakTier.create({
                data: {
                    guildId: ctx.guild!.id,
                    name,
                    threshold
                }
            });

            await ctx.reply({ content: `✅ Successfully created the **${name}** streak tier! Users must send **${threshold}** messages per day to maintain it.` });
        } else if (subcommand === 'remove') {
            const threshold = ctx.options.getInteger('threshold', true);

            const existing = await client.prisma.streakTier.findUnique({
                where: {
                    guildId_threshold: {
                        guildId: ctx.guild!.id,
                        threshold
                    }
                }
            });

            if (!existing) {
                await ctx.reply({ content: `❌ No streak tier found with a threshold of **${threshold}**.` });
                return;
            }

            await client.prisma.streakTier.delete({
                where: {
                    id: existing.id
                }
            });

            await ctx.reply({ content: `✅ Successfully removed the **${existing.name}** streak tier.` });
        } else if (subcommand === 'list') {
            const tiers = await client.prisma.streakTier.findMany({
                where: { guildId: ctx.guild!.id },
                orderBy: { threshold: 'asc' }
            });

            if (tiers.length === 0) {
                await ctx.reply({ content: `No streak tiers have been configured for this server yet. Use \`/streaktier add\` to create one.` });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🔥 Streak Tiers`)
                .setColor(client.color.main)
                .setDescription(tiers.map(t => `**${t.name}** - ${t.threshold} msg/day`).join('\n'))
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });
        }
    }
}
