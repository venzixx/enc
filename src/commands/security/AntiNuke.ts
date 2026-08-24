import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class AntiNukeStatus extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'antinuke',
            aliases: ['antiraid', 'ans', 'securitystatus'],
            description: {
                content: 'Check the real-time Anti-Nuke status, active shield layers, and security configurations.',
                usage: 'antinuke [status]',
                examples: ['antinuke', 'antinuke status']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'status',
                    description: 'View server Anti-Nuke and security shield status',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        const [guildData, devAntiNuke, extraOwners, trustedAdmins] = await Promise.all([
            client.prisma.guild.findUnique({
                where: { id: ctx.guild.id },
                include: { antiNukeConfig: true }
            }),
            (client.prisma as any).devAntiNuke.findUnique({
                where: { guildId: ctx.guild.id }
            }),
            client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } }),
            client.prisma.trustedUser.findMany({ where: { guildId: ctx.guild.id } })
        ]);

        const isMasterOn = !!guildData?.antiNukeEnabled;
        const isDevOn = !!devAntiNuke?.enabled;

        // Categories status
        const banOn = !!guildData?.antiNukeBan;
        const kickOn = !!guildData?.antiNukeKick;
        const channelOn = !!guildData?.antiNukeChannel;
        const roleOn = !!guildData?.antiNukeRole;
        const botOn = !!guildData?.antiNukeBot;
        const webhookOn = !!guildData?.antiNukeWebhook;

        const getIndicator = (state: boolean) => state ? `${client.emoji.success} \`ACTIVE\`` : `${client.emoji.cross} \`DISABLED\``;

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.antinuke_siren} Anti-Nuke Security Radar — ${ctx.guild.name}`)
            .setColor(isMasterOn ? 0x22c55e : (isDevOn ? 0x3b82f6 : 0xef4444))
            .setDescription(
                `Comprehensive real-time status of server anti-raid containment and protection layers.\n\n` +
                `### ${client.emoji.shield} Master Shield Status\n` +
                `• **Server Anti-Nuke:** ${isMasterOn ? `${client.emoji.success} **ONLINE & PROTECTING**` : `${client.emoji.cross} **OFFLINE (DISABLED)**`}\n` +
                `• **Developer Anti-Nuke:** ${isDevOn ? `${client.emoji.shield} **ACTIVE (Dev Shield Enabled)**` : `${client.emoji.cross} **INACTIVE**`}\n\n` +
                `### ${client.emoji.mod_lock} Active Shield Modules\n` +
                `• ${client.emoji.mod_ban} **Ban Protection:** ${getIndicator(banOn)}\n` +
                `• ${client.emoji.mod_kick} **Kick Protection:** ${getIndicator(kickOn)}\n` +
                `• ${client.emoji.folder_module} **Channel Protection:** ${getIndicator(channelOn)}\n` +
                `• ${client.emoji.folder_module} **Role Protection:** ${getIndicator(roleOn)}\n` +
                `• ${client.emoji.system_bot} **Bot Shield:** ${getIndicator(botOn)}\n` +
                `• ${client.emoji.link} **Webhook Guard:** ${getIndicator(webhookOn)}\n\n` +
                `### ${client.emoji.crown_owner} Security Hierarchy\n` +
                `• **Extra Owners (${extraOwners.length}):** ${extraOwners.length ? extraOwners.map((e: any) => `<@${e.userId}>`).join(', ') : '*None*'}\n` +
                `• **Trusted Admins (${trustedAdmins.length}):** ${trustedAdmins.length ? trustedAdmins.map((t: any) => `<@${t.userId}>`).join(', ') : '*None*'}`
            )
            .addFields({
                name: `${client.emoji.ping_bolt} Quick Actions`,
                value:
                    '• `e!s extraowner <add|remove|list>` — Configure Extra Owners\n' +
                    '• `e!s trusted <add|remove|list>` — Configure Trusted Admins\n' +
                    '• `e!s whitelist <add|remove|list>` — Configure AutoMod Whitelist\n' +
                    '• `e!lockdown` — Deploy Emergency Containment'
            })
            .setFooter({ text: `Enc Security Core • Server ID: ${ctx.guild.id}` })
            .setTimestamp();

        return await ctx.sendMessage({ embeds: [embed] });
    }
}
