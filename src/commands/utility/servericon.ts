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
        const guildId = ctx.guild?.id || ctx.interaction?.guildId;

        if (!guildId) {
            return await ctx.replyV2({ 
                description: 'Please run this command inside a Discord server.', 
                isAlert: true,
                ephemeral: true
            });
        }

        let guildName = ctx.guild?.name;
        let iconHash = ctx.guild?.icon;

        // 1. Check client cache or fetch if bot is in the server
        let targetGuild = ctx.guild || client.guilds.cache.get(guildId);
        if (!targetGuild) {
            targetGuild = await client.guilds.fetch(guildId).catch(() => null);
        }

        if (targetGuild) {
            guildName = targetGuild.name;
            iconHash = targetGuild.icon;
        } else {
            // 2. Bot is not in the guild (User-Installed execution) -> Fetch via Guild Preview (Community servers)
            const preview = await client.rest.get(Routes.guildPreview(guildId)).catch(() => null) as any;
            if (preview) {
                guildName = preview.name;
                iconHash = preview.icon;
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

        if (!iconHash) {
            if (targetGuild) {
                return await ctx.replyV2({ 
                    description: `**${guildName || 'This server'}** does not have a server icon set.`, 
                    isAlert: true 
                });
            } else {
                return await ctx.replyV2({ 
                    description: `Unable to access this server's icon. Because the bot is not joined in this server and Community Preview is disabled, Discord restricts external access. Invite **${client.user?.username || 'the bot'}** to this server to unlock full server information!`, 
                    isAlert: true,
                    ephemeral: true
                });
            }
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
            .setTitle(`${guildName || 'Server'}'s Icon`)
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
