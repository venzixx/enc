import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Routes
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class ServerBanner extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'serverbanner',
            aliases: ['sbanner', 'guildbanner', 'gbanner'],
            description: {
                content: 'Get the high-resolution server banner or splash of any server you run this in (User-Installable).',
                usage: 'serverbanner',
                examples: ['serverbanner', 'sbanner']
            },
            category: 'utility',
            cooldown: 2,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const guildId = ctx.guild?.id || ctx.interaction?.guildId;

        if (!guildId) {
            return await ctx.replyV2({ 
                description: 'Please run this command inside a Discord server.', 
                isAlert: true,
                ephemeral: true
            });
        }

        let guildName = ctx.guild?.name;
        let bannerHash = ctx.guild?.banner;
        let splashHash = ctx.guild?.splash;

        // 1. Check client cache or fetch if bot is in the server
        let targetGuild = ctx.guild || client.guilds.cache.get(guildId);
        if (!targetGuild) {
            targetGuild = await client.guilds.fetch(guildId).catch(() => null);
        }

        if (targetGuild) {
            guildName = targetGuild.name;
            bannerHash = targetGuild.banner;
            splashHash = targetGuild.splash;
        } else {
            // 2. Bot is not in the guild (User-Installed execution) -> Fetch via Guild Preview (Community servers)
            const preview = await client.rest.get(Routes.guildPreview(guildId)).catch(() => null) as any;
            if (preview) {
                guildName = preview.name;
                bannerHash = preview.banner;
                splashHash = preview.splash;
            } else {
                // 3. Fallback: Check if widget is enabled
                const widget = await fetch(`https://discord.com/api/v10/guilds/${guildId}/widget.json`)
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null);
                if (widget && widget.name) {
                    guildName = widget.name;
                }
            }
        }

        const activeHash = bannerHash || splashHash;
        const isSplashOnly = !bannerHash && Boolean(splashHash);

        if (!activeHash) {
            if (targetGuild) {
                return await ctx.replyV2({ 
                    description: `**${guildName || 'This server'}** does not have a server banner or splash set.`, 
                    isAlert: true 
                });
            } else {
                return await ctx.replyV2({ 
                    description: `Unable to access this server's banner. Because the bot is not joined in this server and Community Preview is disabled, Discord restricts external access. Invite **${client.user?.username || 'the bot'}** to this server to unlock full server information!`, 
                    isAlert: true,
                    ephemeral: true
                });
            }
        }

        const isAnimated = typeof activeHash === 'string' && activeHash.startsWith('a_');
        const defaultExt = isAnimated ? 'gif' : 'png';
        const basePath = isSplashOnly ? 'splashes' : 'banners';
        const bannerUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.${defaultExt}?size=4096`;
        const pngUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.png?size=4096`;
        const jpgUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.jpg?size=4096`;
        const webpUrl = `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.webp?size=4096`;
        const gifUrl = isAnimated ? `https://cdn.discordapp.com/${basePath}/${guildId}/${activeHash}.gif?size=4096` : null;

        let formatLinks = `[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`;
        if (gifUrl) formatLinks += ` • [GIF](${gifUrl})`;

        const embed = new EmbedBuilder()
            .setTitle(`${guildName || 'Server'}'s ${isSplashOnly ? 'Splash' : 'Banner'}`)
            .setDescription(formatLinks)
            .setImage(bannerUrl)
            .setColor(client.color.main)
            .setFooter({ text: `Requested by ${ctx.author.tag}` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('Open Original')
                .setStyle(ButtonStyle.Link)
                .setURL(bannerUrl)
        );

        return await ctx.sendMessage({ 
            embeds: [embed],
            components: [row]
        });
    }
}
