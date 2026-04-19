import { 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType,
    ChannelType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class Info extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'info',
            description: {
                content: 'Get information about the server, users, or bot status.',
                usage: 'info <subcommand>',
                examples: ['info user', 'info server', 'info ping']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'Get information about a specific user.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'target', description: 'User to check', type: ApplicationCommandOptionType.User, required: false }
                    ]
                },
                {
                    name: 'server',
                    description: 'Get information about the current server.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'members',
                    description: 'Check the server member count and statistics.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'ping',
                    description: 'Check the bot heartbeat and latency.',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand() || args[0];

        switch (sub) {
            case 'user':
                return this.handleUser(client, ctx, args);
            case 'server':
                return this.handleServer(client, ctx);
            case 'members':
                return this.handleMembers(client, ctx);
            case 'ping':
                return this.handlePing(client, ctx);
            default:
                return ctx.replyV2({ description: 'Please specify a valid info category.', isAlert: true });
        }
    }

    private async handleUser(client: ExtendedClient, ctx: Context, args: string[]) {
        const member = await Resolver.resolveMember(ctx, ctx.options.getMember('target') || args[1]);
        if (!member) {
            return await ctx.replyV2({ description: 'Could not find that member.', isAlert: true });
        }

        const user = member.user;
        const roles = member.roles.cache
            .filter((role) => role.id !== ctx.guild.id)
            .sort((a, b) => b.position - a.position)
            .map((role) => role.toString());

        const embed = new EmbedBuilder()
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL())
            .setColor(member.displayColor || client.color.main)
            .addFields(
                { name: `${client.emoji.user} User`, value: `**ID:** \`${user.id}\`\n**Bot:** \`${user.bot ? 'Yes' : 'No'}\`\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: ' Membership', value: `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>\n**Top Role:** ${member.roles.highest}`, inline: true },
                { name: ` Roles (${roles.length})`, value: roles.length > 10 ? roles.slice(0, 10).join(', ') + ` and ${roles.length - 10} more...` : roles.join(', ') || 'None', inline: false }
            )
            .setTimestamp();

        return await ctx.reply({ embeds: [embed] });
    }

    private async handleServer(client: ExtendedClient, ctx: Context) {
        const guild = ctx.guild;
        const channels = guild.channels.cache;
        const roles = guild.roles.cache.filter((role: any) => role.id !== guild.id);

        const embed = new EmbedBuilder()
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ forceStatic: false }))
            .setColor(client.color.main)
            .addFields(
                { name: ' General', value: `**Owner:** <@${guild.ownerId}>\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n**Verification:** \`${guild.verificationLevel}\`\n**ID:** \`${guild.id}\``, inline: false },
                { name: ' Members', value: `**Total:** \`${guild.memberCount}\`\n**Boosts:** \`${guild.premiumSubscriptionCount || 0}\` (Tier ${guild.premiumTier})`, inline: true },
                { name: ' Channels', value: `**Text:** \`${channels.filter((c: any) => c.type === ChannelType.GuildText).size}\`\n**Voice:** \`${channels.filter((c: any) => c.type === ChannelType.GuildVoice).size}\`\n**Threads:** \`${channels.filter((c: any) => c.isThread()).size}\``, inline: true },
                { name: `${client.emoji.random} Misc`, value: `**Roles:** \`${roles.size}\`\n**Emojis:** \`${guild.emojis.cache.size}\`\n**Stickers:** \`${guild.stickers.cache.size}\``, inline: true }
            )
            .setTimestamp();

        if (guild.banner) embed.setImage(guild.bannerURL());
        return await ctx.reply({ embeds: [embed] });
    }

    private async handleMembers(client: ExtendedClient, ctx: Context) {
        const total = ctx.guild.memberCount;
        const bots = ctx.guild.members.cache.filter((m: any) => m.user.bot).size;
        const humans = total - bots;

        return await ctx.replyV2({
            title: ` Member Statistics`,
            description: `Analyzing population metrics for **${ctx.guild.name}**.`,
            fields: [
                { name: 'Total Accounts', value: `> \`${total}\` identities`, inline: true },
                { name: 'Human Factors', value: `> \`${humans}\` members`, inline: true },
                { name: 'Automated Units', value: `> \`${bots}\` bots`, inline: true }
            ],
            color: client.color.main
        });
    }

    private async handlePing(client: ExtendedClient, ctx: Context) {
        const wsPing = client.ws.ping;
        let nodePing = "N/A";

        try {
            const player = client.lavalink.getPlayer(ctx.guild.id);
            if (player) {
                const node = player.node;
                if (node && (node as any).heartBeatPing !== undefined) {
                    nodePing = `${(node as any).heartBeatPing}ms`;
                }
            }
        } catch {}

        const uptime = `${Math.floor(client.uptime! / 86400000)}d ${Math.floor(client.uptime! / 3600000) % 24}h ${Math.floor(client.uptime! / 60000) % 60}m`;

        return await ctx.replyV2({
            title: `**System Heartbeat**`,
            description: `Detailed diagnostics and latency benchmarks for **${client.user?.username}**.`,
            fields: [
                { name: `${client.emoji.info} **API LATENCY**`, value: `> \`${wsPing}ms\` (Discord API)`, inline: true },
                { name: `${client.emoji.music} **LAVALINK**`, value: `> \`${nodePing}\` (Voice Node)`, inline: true },
                { name: `${client.emoji.edit} **ENVIRONMENT**`, value: `> \`NodeJS ${process.version}\` \u2022 \`Up ${uptime}\``, inline: false }
            ],
            color: client.color.main
        });
    }
}
