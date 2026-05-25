import { 
    EmbedBuilder, 
    ApplicationCommandOptionType,
    ChannelType,
    version as djsVersion
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import os from 'os';

export default class Info extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'info',
            description: {
                content: 'Access the system information hub for server, user, or bot diagnostics.',
                usage: 'info <subcommand>',
                examples: ['info user @member', 'info server', 'info bot']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'Analyze identity and membership data for a user.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'target', description: 'User to analyze', type: ApplicationCommandOptionType.User, required: false }
                    ]
                },
                {
                    name: 'server',
                    description: 'Retrieve technical and demographic data for this server.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'bot',
                    description: 'View system status, resource usage, and core bot information.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'ping',
                    description: 'Measure websocket heartbeat and node latency benchmarks.',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = (ctx.options.getSubcommand() || args[0] || 'bot').toLowerCase();

        switch (sub) {
            case 'user':
            case 'u':
            case 'member':
                return this.handleUser(client, ctx, args);
            case 'server':
            case 's':
            case 'guild':
                return this.handleServer(client, ctx);
            case 'bot':
            case 'b':
            case 'stats':
                return this.handleBot(client, ctx);
            case 'ping':
                return this.handlePing(client, ctx);
            default:
                return ctx.replyV2({ description: 'Please specify a valid info category.', isAlert: true });
        }
    }

    public async handleUser(client: ExtendedClient, ctx: Context, args: string[]) {
        const member = await Resolver.resolveMember(ctx, ctx.options.getMember('target') || args[1]) || ctx.member;
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
                { name: `${client.emoji.user} Identity`, value: `**ID:** \`${user.id}\`\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: `${client.emoji.shield} Membership`, value: `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>\n**Top Role:** ${member.roles.highest}`, inline: true },
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
                { name: `${client.emoji.info} General`, value: `**Owner:** <@${guild.ownerId}>\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n**Verification:** \`${guild.verificationLevel}\`\n**ID:** \`${guild.id}\``, inline: false },
                { name: `${client.emoji.user} Members`, value: `**Total:** \`${guild.memberCount}\`\n**Boosts:** \`${guild.premiumSubscriptionCount || 0}\` (Tier ${guild.premiumTier})`, inline: true },
                { name: ` Channels`, value: `**Text:** \`${channels.filter((c: any) => c.type === ChannelType.GuildText).size}\`\n**Voice:** \`${channels.filter((c: any) => c.type === ChannelType.GuildVoice).size}\``, inline: true },
                { name: `${client.emoji.random} Misc`, value: `**Roles:** \`${roles.size}\` \u2022 **Emojis:** \`${guild.emojis.cache.size}\``, inline: true }
            )
            .setTimestamp();

        if (guild.banner) embed.setImage(guild.bannerURL());
        return await ctx.reply({ embeds: [embed] });
    }

    public async handleBot(client: ExtendedClient, ctx: Context) {
        const uptime = `${Math.floor(client.uptime! / 86400000)}d ${Math.floor(client.uptime! / 3600000) % 24}h ${Math.floor(client.uptime! / 60000) % 60}m`;
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        const embed = new EmbedBuilder()
            .setTitle(`${client.user?.username} System Overview`)
            .setThumbnail(client.user?.displayAvatarURL() || null)
            .setColor(client.color.main)
            .setDescription(`**Enc Nexus** is a sovereign multi-purpose bot designed for elite guild governance and automated security.`)
            .addFields(
                { name: `${client.emoji.info} Statistics`, value: `**Guilds:** \`${client.guilds.cache.size}\`\n**Users:** \`${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}\` identities\n**Channels:** \`${client.channels.cache.size}\``, inline: true },
                { name: `${client.emoji.edit} Hardware`, value: `**Uptime:** \`${uptime}\`\n**Memory:** \`${memoryUsage} MB\` usage\n**Platform:** \`${os.platform()}\` (\`${os.arch()}\`)`, inline: true },
                { name: `${client.emoji.music} Software`, value: `**Library:** \`Discord.js v${djsVersion}\`\n**Runtime:** \`Node ${process.version}\`\n**Dashboard:** [bot.encl.asia](https://bot.encl.asia)`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Enc Nexus OS v2.0' });

        return await ctx.reply({ embeds: [embed] });
    }

    private async handlePing(client: ExtendedClient, ctx: Context) {
        const wsPing = client.ws.ping;
        return await ctx.replyV2({
            title: `System Latency`,
            description: `**Websocket Heartbeat:** \`${wsPing}ms\``,
            color: client.color.main
        });
    }
}
