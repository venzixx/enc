import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
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
        const rawGuild = (ctx.interaction as any)?.guild || (ctx.interaction as any)?.data?.guild || ctx.guild;
        const guildId = ctx.guild?.id || ctx.interaction?.guildId || rawGuild?.id;
        const guildName = ctx.guild?.name || rawGuild?.name || 'Server';
        const bannerHash = ctx.guild?.banner || rawGuild?.banner;
        const splashHash = ctx.guild?.splash || rawGuild?.splash;

        if (!guildId) {
            return await ctx.replyV2({ 
                description: 'Please run this command inside a Discord server.', 
                isAlert: true 
            });
        }

        const activeHash = bannerHash || splashHash;
        const isSplashOnly = !bannerHash && Boolean(splashHash);

        if (!activeHash) {
            return await ctx.replyV2({ 
                description: `**${guildName}** does not have a server banner or splash set.`, 
                isAlert: true 
            });
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
            .setTitle(`${guildName}'s ${isSplashOnly ? 'Splash' : 'Banner'}`)
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
