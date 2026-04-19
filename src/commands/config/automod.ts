import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Automod extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'automod',
            description: {
                content: 'Manage the custom Auto-Mod security suite.',
                usage: 'automod <status|enable|disable|blacklist>',
                examples: ['automod status', 'automod blacklist add word']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'status',
                    description: 'View current Auto-Mod configuration.',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'enable',
                    description: 'Enable the global Auto-Mod master switch.',
                    type: 1
                },
                {
                    name: 'disable',
                    description: 'Disable the global Auto-Mod master switch.',
                    type: 1
                },
                {
                    name: 'blacklist',
                    description: 'Manage the neural word blacklist.',
                    type: 2, // SUB_COMMAND_GROUP
                    options: [
                        {
                            name: 'add',
                            description: 'Add a phrase to the blacklist.',
                            type: 1,
                            options: [
                                {
                                    name: 'phrase',
                                    description: 'The word or phrase to block.',
                                    type: 3,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'remove',
                            description: 'Remove a phrase from the blacklist.',
                            type: 1,
                            options: [
                                {
                                    name: 'phrase',
                                    description: 'The word or phrase to unblock.',
                                    type: 3,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'show',
                            description: 'List all blacklisted phrases.',
                            type: 1
                        }
                    ]
                },
                {
                    name: 'heat',
                    description: 'Monitor the Anti-Nuke Thermal Layer.',
                    type: 2,
                    options: [
                        {
                            name: 'status',
                            description: 'Display all active user thermal signatures.',
                            type: 1
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        if (!ctx.interaction) return;
        const interaction = ctx.interaction as ChatInputCommandInteraction;
        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);

        if (group === 'blacklist') {
            return this.handleBlacklist(client, interaction);
        }

        if (group === 'heat') {
            return this.handleHeatStatus(client, interaction);
        }

        switch (sub) {
            case 'status':
                return this.sendStats(client, interaction);
            case 'enable':
                return this.toggleMaster(client, interaction, true);
            case 'disable':
                return this.toggleMaster(client, interaction, false);
        }
    }

    private async handleHeatStatus(client: ExtendedClient, interaction: ChatInputCommandInteraction) {
        const { HeatManager } = require('../../utils/HeatManager');
        const activeHeat = HeatManager.getAllHeat(interaction.guildId!);

        const embed = new EmbedBuilder()
            .setTitle('🔥 Thermal Security Radar')
            .setColor(client.color.main)
            .setTimestamp();

        if (activeHeat.length === 0) {
            embed.setDescription('*The server is currently operating at optimal temperatures. No active thermal signatures detected.*');
        } else {
            const heatList = activeHeat.map((h: any) => {
                const barLength = 10;
                const filled = Math.round((h.value / 100) * barLength);
                const bar = '▓'.repeat(filled) + '░'.repeat(barLength - filled);
                const color = h.value > 80 ? '🔴' : h.value > 50 ? '🟠' : '🟢';
                return `${color} <@${h.userId}>: \`${bar}\` **${Math.round(h.value)}%**`;
            }).join('\n');

            embed.setDescription(`**Active Thermal Signatures:**\n\n${heatList}\n\n*Heat decays every 10 seconds. Users hitting 100% will be neutralized.*`);
        }

        return interaction.reply({ embeds: [embed] });
    }

    private async toggleMaster(client: ExtendedClient, interaction: ChatInputCommandInteraction, state: boolean) {
        await client.prisma.guild.update({
            where: { id: interaction.guildId! },
            data: { autoModEnabled: state }
        });

        const embed = new EmbedBuilder()
            .setTitle(state ? `${client.emoji.success} Auto-Mod Activated` : `${client.emoji.exclamation} Auto-Mod Deactivated`)
            .setDescription(`The global master switch has been set to **${state ? 'ENABLED' : 'DISABLED'}**.`)
            .setColor(state ? client.color.main : client.color.red)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    private async sendStats(client: ExtendedClient, interaction: ChatInputCommandInteraction) {
        const guildData = await client.prisma.guild.findUnique({
            where: { id: interaction.guildId! },
            include: { autoModFilters: true }
        });

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Auto-Mod Manifest')
            .setColor(client.color.main)
            .setThumbnail(interaction.guild?.iconURL() || null)
            .addFields(
                { name: 'Master Switch', value: guildData?.autoModEnabled ? '🟢 ENABLED' : '🔴 DISABLED', inline: false }
            );

        if (guildData?.autoModFilters?.length) {
            const filterList = guildData.autoModFilters.map(f => {
                const status = f.enabled ? '🟢' : '🔴';
                return `${status} **${f.type}**: ${f.action}`;
            }).join('\n');
            embed.addFields({ name: 'Active Filters', value: filterList || 'None configured.' });
        } else {
            embed.addFields({ name: 'Active Filters', value: 'None configured.' });
        }

        return interaction.reply({ embeds: [embed] });
    }

    private async handleBlacklist(client: ExtendedClient, interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        const filter = await client.prisma.autoModFilter.findUnique({
            where: { guildId_type: { guildId, type: 'WORDS' } }
        });

        let words: string[] = JSON.parse(filter?.data || '[]');

        if (sub === 'show') {
            const embed = new EmbedBuilder()
                .setTitle('📓 Neural Blacklist')
                .setDescription(words.length ? `\`\`\`${words.join(', ')}\`\`\`` : '*No blacklisted phrases protocolled.*')
                .setColor(client.color.main);
            return interaction.reply({ embeds: [embed] });
        }

        const phrase = interaction.options.getString('phrase', true).toLowerCase();

        if (sub === 'add') {
            if (words.includes(phrase)) return interaction.reply({ content: 'That phrase is already blacklisted.', ephemeral: true });
            words.push(phrase);
        } else if (sub === 'remove') {
            if (!words.includes(phrase)) return interaction.reply({ content: 'That phrase is not in the blacklist.', ephemeral: true });
            words = words.filter(w => w !== phrase);
        }

        await client.prisma.autoModFilter.upsert({
            where: { guildId_type: { guildId, type: 'WORDS' } },
            update: { data: JSON.stringify(words) },
            create: { guildId, type: 'WORDS', enabled: true, data: JSON.stringify(words) }
        });

        return interaction.reply({ 
            content: `${client.emoji.success} Neural blacklist updated. \`${phrase}\` has been **${sub === 'add' ? 'added to' : 'removed from'}** the filter.` 
        });
    }
}
