import { PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";
import { PlaceholderManager } from "../../utils/PlaceholderManager";

export default class LevelupTest extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'levelup-test',
            aliases: ['testlevelup', 'test-levelup', 'lvltest'],
            description: {
                content: 'Preview the configured level-up message.',
                usage: 'levelup-test [user] [level]',
                examples: ['levelup-test', 'levelup-test @user 10']
            },
            category: 'config',
            cooldown: 10,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'user',
                    description: 'Target user for the preview',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'level',
                    description: 'Simulated level number',
                    type: 4, // INTEGER
                    required: false,
                    min_value: 1,
                    max_value: 1000
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const guild = ctx.guild!;
        const member = (ctx.isInteraction ? ctx.options.getMember('user') : ctx.member) as GuildMember || ctx.member as GuildMember;
        const level = ctx.isInteraction ? (ctx.options.getInteger('level') || 5) : (parseInt(args[1]) || 5);

        const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });
        if (!guildData) {
            return ctx.sendV2({
                title: `${client.emoji.cross} Error`,
                description: 'Guild configuration not found.',
                isAlert: true,
                color: client.color.red
            });
        }

        const results: string[] = [];

        // --- Text-based level-up message ---
        const levelUpMsg = guildData.levelUpMessage || 'GG {user.mention}, you just reached level **{user.level}**!';
        const resolvedMsg = levelUpMsg
            .replace(/{user\.mention}/g, member.toString())
            .replace(/{user}/g, member.toString())
            .replace(/{user\.name}/g, member.user.username)
            .replace(/{user\.id}/g, member.id)
            .replace(/{user\.level}/g, level.toString())
            .replace(/{server}/g, guild.name)
            .replace(/{server\.member_count}/g, guild.memberCount.toString());

        await ctx.channel.send({
            content: `📋 **Level-Up Message Preview** (Level ${level}):\n\n${resolvedMsg}`
        });
        results.push('✅ Text level-up message previewed');

        // --- Embed-based level-up (if configured) ---
        const guildAny = guildData as any;
        if (guildAny.levelUpEmbedData) {
            try {
                const embedData = JSON.parse(guildAny.levelUpEmbedData);
                const resolveField = (text: string | undefined) => {
                    if (!text) return undefined;
                    return text
                        .replace(/{user\.mention}/g, member.toString())
                        .replace(/{user}/g, member.toString())
                        .replace(/{user\.name}/g, member.user.username)
                        .replace(/{user\.level}/g, level.toString())
                        .replace(/{server}/g, guild.name);
                };

                const embed = new EmbedBuilder()
                    .setColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : client.color.main)
                    .setTimestamp();

                if (embedData.title) embed.setTitle(resolveField(embedData.title)!);
                if (embedData.description) embed.setDescription(resolveField(embedData.description)!);
                if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
                if (embedData.image?.url) embed.setImage(embedData.image.url);
                if (embedData.footer?.text) embed.setFooter({ text: resolveField(embedData.footer.text)!, iconURL: embedData.footer.icon_url });

                await ctx.channel.send({
                    content: '📋 **Embed Level-Up Preview:**',
                    embeds: [embed]
                });
                results.push('✅ Embed level-up message previewed');
            } catch (e: any) {
                results.push(`❌ Embed parse error: ${e.message}`);
            }
        } else {
            results.push('⏭️ No custom embed configured (using text mode)');
        }

        // --- Level-up channel info ---
        const channelInfo = guildAny.levelUpChannelId 
            ? `Level-up messages → <#${guildAny.levelUpChannelId}>` 
            : 'Level-up messages → Current channel (no override set)';
        
        const rankChannelInfo = guildAny.rankCardChannelId
            ? `Rank card output → <#${guildAny.rankCardChannelId}>`
            : 'Rank card output → Current channel (no override set)';

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.info} Level-Up Test Summary`)
            .setDescription([
                ...results,
                '',
                `📍 ${channelInfo}`,
                `📍 ${rankChannelInfo}`,
                `📊 Level-up messages: **${guildData.levelUpMessageEnabled ? 'Enabled' : 'Disabled'}**`,
                `🖼️ Level-up images: **${guildData.levelUpImageEnabled ? 'Enabled' : 'Disabled'}**`,
            ].join('\n'))
            .setColor(client.color.main)
            .setFooter({ text: `Preview using ${member.user.username} at level ${level}` })
            .setTimestamp();

        return ctx.editReply({ embeds: [summaryEmbed] });
    }
}
