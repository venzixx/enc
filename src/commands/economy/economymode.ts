import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class EconomyMode extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'economymode',
            aliases: ['ecomode', 'seteconomy'],
            description: {
                content: 'Switch this server between Global Economy (0) and Server-Specific Economy (1).',
                usage: 'economymode [global|server|0|1]',
                examples: ['economymode', 'economymode server', 'economymode global', 'economymode 1']
            },
            category: 'economy',
            cooldown: 5,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild]
            },
            slashCommand: true,
            options: [
                {
                    name: 'mode',
                    description: 'Choose economy scope: global (0) or server (1)',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'Global Economy (0)', value: '0' },
                        { name: 'Server-Specific Economy (1)', value: '1' }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) {
            return ctx.replyV2({
                title: 'Server Only',
                description: 'Economy mode settings can only be configured within a server.',
                borderless: true,
                color: null
            });
        }

        const currentGuild = await client.prisma.guild.findUnique({
            where: { id: ctx.guild.id },
            select: { economyMode: true }
        });

        const currentMode = currentGuild?.economyMode ?? 0;
        const rawArg = ctx.isInteraction ? ctx.options.getString('mode') : args[0];

        if (!rawArg) {
            const currentLabel = currentMode === 1 ? '🏠 Server-Specific (1)' : '🌍 Global Economy (0)';
            return ctx.replyV2({
                title: '⚙️ Economy Mode Configuration',
                description:
                    `**Current Mode:** \`${currentLabel}\`\n\n` +
                    `**Options:**\n` +
                    `• \`,economymode global\` (or \`0\`) — Balances are shared globally across all servers and DMs.\n` +
                    `• \`,economymode server\` (or \`1\`) — Balances are completely isolated to this server only.`,
                borderless: true,
                color: null
            });
        }

        const input = rawArg.trim().toLowerCase();
        let newMode: number | null = null;

        if (input === '0' || input === 'global' || input === 'off') {
            newMode = 0;
        } else if (input === '1' || input === 'server' || input === 'local' || input === 'on') {
            newMode = 1;
        }

        if (newMode === null) {
            return ctx.replyV2({
                title: '❌ Invalid Mode',
                description: 'Please specify either `global` (`0`) or `server` (`1`).',
                borderless: true,
                color: null
            });
        }

        await client.prisma.guild.upsert({
            where: { id: ctx.guild.id },
            update: { economyMode: newMode },
            create: { id: ctx.guild.id, economyMode: newMode }
        });

        const newLabel = newMode === 1 ? '🏠 Server-Specific Economy (1)' : '🌍 Global Economy (0)';

        return ctx.replyV2({
            title: '✅ Economy Mode Updated',
            description:
                `The economy mode for **${ctx.guild.name}** is now set to:\n` +
                `**\`${newLabel}\`**\n\n` +
                (newMode === 1
                    ? '• Balances earned here will remain isolated to this server.'
                    : '• Members will now access and spend their universal Global Zer balance.'),
            borderless: true,
            color: null
        });
    }
}
