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

export default class ServerIcon extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'servericon',
            aliases: ['sicon', 'guildicon', 'gicon', 'serveravatar', 'savatar'],
            description: {
                content: 'Get the high-resolution server icon of any server you run this in (User-Installable).',
                usage: 'servericon',
                examples: ['servericon', 'sicon']
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
        const iconHash = ctx.guild?.icon || rawGuild?.icon;

        if (!guildId) {
            return await ctx.replyV2({ 
                description: 'Please run this command inside a Discord server.', 
                isAlert: true 
            });
        }

        if (!iconHash) {
            return await ctx.replyV2({ 
                description: `**${guildName}** does not have a server icon set.`, 
                isAlert: true 
            });
        }

        const isAnimated = typeof iconHash === 'string' && iconHash.startsWith('a_');
        const defaultExt = isAnimated ? 'gif' : 'png';
        const iconUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${defaultExt}?size=4096`;
        const pngUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=4096`;
        const jpgUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.jpg?size=4096`;
        const webpUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.webp?size=4096`;
        const gifUrl = isAnimated ? `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.gif?size=4096` : null;

        let formatLinks = `[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`;
        if (gifUrl) formatLinks += ` • [GIF](${gifUrl})`;

        const embed = new EmbedBuilder()
            .setTitle(`${guildName}'s Icon`)
            .setDescription(formatLinks)
            .setImage(iconUrl)
            .setColor(client.color.main)
            .setFooter({ text: `Requested by ${ctx.author.tag}` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('Open Original')
                .setStyle(ButtonStyle.Link)
                .setURL(iconUrl)
        );

        return await ctx.sendMessage({ 
            embeds: [embed],
            components: [row]
        });
    }
}
