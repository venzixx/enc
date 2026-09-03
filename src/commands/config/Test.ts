import { PermissionFlagsBits, EmbedBuilder, AttachmentBuilder, GuildMember } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";
import { PlaceholderManager } from "../../utils/PlaceholderManager";
import { RankCardGenerator } from "../../utils/RankCardGenerator";

export default class Test extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'test',
            aliases: ['preview', 'testwelcome', 'testwelcomer', 'welcomertest'],
            description: {
                content: 'Test and preview your configurations.',
                usage: 'test <module> [options]',
                examples: ['test welcome', 'test greeter', 'test levelup', 'test streak']
            },
            category: 'config',
            cooldown: 10,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]
            },
            options: [
                {
                    name: 'welcome',
                    description: 'Preview the modern welcome card and greeting',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'user',
                            description: 'Simulated user for the preview',
                            type: 6, // USER
                            required: false
                        }
                    ]
                },
                {
                    name: 'greeter',
                    description: 'Preview your configured greeter/welcome messages',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'type',
                            description: 'Which message type to preview',
                            type: 3, // STRING
                            required: false,
                            choices: [
                                { name: 'Welcome Card & Message', value: 'welcome' },
                                { name: 'Greeter Message', value: 'greeter' },
                                { name: 'Leave Message', value: 'leave' },
                                { name: 'Join DM', value: 'joindm' },
                                { name: 'All', value: 'all' },
                            ]
                        }
                    ]
                },
                {
                    name: 'levelup',
                    description: 'Preview the configured level-up message',
                    type: 1, // SUB_COMMAND
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
                },
                {
                    name: 'streak',
                    description: 'Preview your configured streak notification messages',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'user',
                            description: 'Target user for the preview',
                            type: 6, // USER
                            required: false
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let subCommand = ctx.isInteraction ? ctx.options.getSubcommand() : args[0]?.toLowerCase();
        
        // Handle direct alias execution (e.g. e!testwelcome)
        const interactionCmdName = ctx.interaction && 'commandName' in ctx.interaction ? (ctx.interaction as any).commandName : undefined;
        const msgCmdName = ctx.message?.content?.split(' ')[0]?.slice(client.config.prefix?.length || 2);
        const cmdName = (interactionCmdName || msgCmdName)?.toLowerCase();
        if (cmdName === 'testwelcome' || cmdName === 'testwelcomer' || cmdName === 'welcomertest') {
            subCommand = 'welcome';
        }

        if (subCommand === 'welcomer') subCommand = 'welcome';

        if (!['welcome', 'greeter', 'levelup', 'streak'].includes(subCommand)) {
            return ctx.replyV2({
                title: `${client.emoji.cross} Error`,
                description: 'Please specify a valid module to test: `welcome`, `greeter`, `levelup`, or `streak`.\n\n*Example:* `e!test welcome`',
                isAlert: true,
                color: client.color.red
            });
        }

        await ctx.deferReply();

        const guild = ctx.guild!;
        const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });

        if (!guildData) {
            return ctx.replyV2({
                title: `${client.emoji.cross} No Configuration`,
                description: 'No guild data found.',
                isAlert: true,
                color: client.color.red
            });
        }

        if (subCommand === 'welcome') {
            const targetMember = (ctx.isInteraction ? ctx.options.getMember('user') : null) as GuildMember || ctx.member as GuildMember;
            try {
                const { generateWelcomeImage } = await import('../../services/imageBuilder');
                const avatarUrl = targetMember.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                const imageBuffer = await generateWelcomeImage({
                    avatarUrl,
                    username: targetMember.user.username,
                    memberCount: guild.memberCount,
                    serverName: guild.name,
                    background: guildData.welcomeCardBackground,
                    color: guildData.welcomeCardColor,
                    font: guildData.welcomeCardFont,
                    style: guildData.welcomeCardStyle,
                    title: guildData.welcomeCardTitle
                });
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-card.png' });

                const welcomeRaw = guildData.welcomeMessage || `Welcome to **{guild}**, {user}! We're thrilled to have you here.`;
                const resolved = await PlaceholderManager.resolve(client, welcomeRaw, targetMember, guild);

                const { V2Helper } = await import('../../utils/V2Helper');
                const v2Layout = V2Helper.createLayout({
                    borderless: true,
                    color: null,
                    title: `👋 Welcome Preview`,
                    description: resolved.content || `Welcome to **${guild.name}**, ${targetMember.toString()}! We're thrilled to have you here.`,
                    image: 'attachment://welcome-card.png',
                    footer: `Enc Welcome System • Member #${guild.memberCount}`,
                    timestamp: true
                });

                return await ctx.sendMessage({
                    components: v2Layout.components,
                    files: [attachment]
                });
            } catch (e: any) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Render Error`,
                    description: `Failed to generate welcome preview: ${e.message}`,
                    isAlert: true,
                    color: client.color.red
                });
            }
        }

        if (subCommand === 'greeter') {
            const type = ctx.isInteraction
                ? ctx.options.getString('type') || 'all'
                : args[1]?.toLowerCase() || 'all';

            const member = ctx.member as GuildMember;
            const results: string[] = [];

            // --- Greeter Preview ---
            if (type === 'greeter' || type === 'all') {
                if (guildData.greeterChannelId && guildData.greeterMessage) {
                    const resolved = await PlaceholderManager.resolve(client, guildData.greeterMessage, member, guild);
                    await ctx.channel.send({
                        content: `📋 **Greeter Message Preview:**`,
                    });
                    await ctx.channel.send({
                        content: resolved.content || undefined,
                        embeds: resolved.embeds,
                        components: resolved.components
                    });
                    results.push('✅ Greeter message previewed');
                } else {
                    results.push('⏭️ Greeter not configured (no channel or message set)');
                }
            }

            // --- Welcome Image Preview ---
            if (type === 'welcome' || type === 'all') {
                try {
                    const { generateWelcomeImage } = await import('../../services/imageBuilder');
                    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                    const imageBuffer = await generateWelcomeImage(avatarUrl, member.user.username, guild.memberCount, guild.name);
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-preview.png' });

                    const welcomeRaw = guildData.welcomeMessage || `Welcome to the server, {user}!`;
                    const resolved = await PlaceholderManager.resolve(client, welcomeRaw, member, guild);

                    const embed = new EmbedBuilder()
                        .setTitle('👋 Welcome!')
                        .setDescription(resolved.content || null)
                        .setImage('attachment://welcome-preview.png')
                        .setColor(client.color.main)
                        .setTimestamp();

                    await ctx.channel.send({
                        content: `📋 **Welcome Image Preview:**`,
                    });
                    await ctx.channel.send({
                        embeds: [embed, ...resolved.embeds],
                        components: resolved.components,
                        files: [attachment]
                    });
                    results.push('✅ Welcome image previewed');
                } catch (e: any) {
                    results.push(`❌ Welcome image error: ${e.message}`);
                }
            }

            // --- Leave Message Preview ---
            if (type === 'leave' || type === 'all') {
                if (guildData.leaveChannelId && guildData.leaveMessage) {
                    const resolved = await PlaceholderManager.resolve(client, guildData.leaveMessage, member, guild);
                    await ctx.channel.send({
                        content: `📋 **Leave Message Preview:**`,
                    });
                    await ctx.channel.send({
                        content: resolved.content || undefined,
                        embeds: resolved.embeds,
                        components: resolved.components
                    });
                    results.push('✅ Leave message previewed');
                } else {
                    results.push('⏭️ Leave message not configured');
                }
            }

            // --- Join DM Preview ---
            if (type === 'joindm' || type === 'all') {
                if (guildData.joinDmMessage) {
                    const resolved = await PlaceholderManager.resolve(client, guildData.joinDmMessage, member, guild);
                    await ctx.channel.send({
                        content: `📋 **Join DM Preview** (would be sent via DM):`,
                    });
                    await ctx.channel.send({
                        content: resolved.content || undefined,
                        embeds: resolved.embeds,
                        components: resolved.components
                    });
                    results.push('✅ Join DM previewed');
                } else {
                    results.push('⏭️ Join DM not configured');
                }
            }

            const summaryEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.info} Greeter Test Summary`)
                .setDescription(results.join('\n'))
                .setColor(client.color.main)
                .setFooter({ text: 'This is a preview using you as the test member.' })
                .setTimestamp();

            return ctx.editReply({ embeds: [summaryEmbed] });
        }

        if (subCommand === 'levelup') {
            const member = (ctx.isInteraction ? ctx.options.getMember('user') : ctx.member) as GuildMember || ctx.member as GuildMember;
            const level = ctx.isInteraction ? (ctx.options.getInteger('level') || 5) : (parseInt(args[2]) || 5);

            const results: string[] = [];
            let attachment: AttachmentBuilder | undefined;

            if (guildData.levelUpImageEnabled) {
                try {
                    const nextLevelXP = (level + 1) * (level + 1) * 100;
                    const cardBuffer = await RankCardGenerator.generate({
                        username: member.user.username,
                        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        level: level,
                        rank: 1, // Mock rank
                        currentXp: level * level * 100,
                        requiredXp: nextLevelXP,
                        color: guildData.rankCardProgressColor || undefined,
                    });
                    attachment = new AttachmentBuilder(cardBuffer, { name: `levelup-test-${member.id}.png` });
                    results.push('✅ Rank card generated for preview');
                } catch (err) {
                    results.push(`❌ Rank card generation failed: ${err}`);
                }
            }

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
                content: `📋 **Level-Up Message Preview** (Level ${level}):\n\n${resolvedMsg}`,
                files: attachment ? [attachment] : []
            });
            results.push('✅ Text level-up message previewed');

            if (guildData.levelUpEmbedData) {
                try {
                    const embedData = JSON.parse(guildData.levelUpEmbedData);
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
                        .setColor(embedData.color ? (embedData.color.startsWith('#') ? parseInt(embedData.color.replace('#', ''), 16) : embedData.color) : client.color.main)
                        .setTimestamp();

                    if (embedData.title) embed.setTitle(resolveField(embedData.title)!);
                    if (embedData.description) embed.setDescription(resolveField(embedData.description)!);
                    if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
                    if (embedData.image?.url) embed.setImage(embedData.image.url);
                    if (embedData.footer?.text) embed.setFooter({ text: resolveField(embedData.footer.text)!, iconURL: embedData.footer.icon_url });

                    if (attachment && !embedData.image?.url) {
                        embed.setImage(`attachment://${attachment.name}`);
                    }

                    await ctx.channel.send({
                        content: '📋 **Embed Level-Up Preview:**',
                        embeds: [embed],
                        files: attachment ? [attachment] : []
                    });
                    results.push('✅ Embed level-up message previewed');
                } catch (e: any) {
                    results.push(`❌ Embed parse error: ${e.message}`);
                }
            } else {
                results.push('⏭️ No custom embed configured (using text mode)');
            }

            const channelInfo = guildData.levelUpChannelId 
                ? `Level-up messages → <#${guildData.levelUpChannelId}>` 
                : 'Level-up messages → Current channel (no override set)';
            
            const rankChannelInfo = guildData.rankCardChannelId
                ? `Rank card output → <#${guildData.rankCardChannelId}>`
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

        if (subCommand === 'streak') {
            const member = (ctx.isInteraction ? ctx.options.getMember('user') : ctx.member) as GuildMember || ctx.member as GuildMember;

            if (!guildData.streaksEnabled) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Streaks Disabled`,
                    description: 'The streak system is not enabled for this server.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            const tiers = await client.prisma.streakTier.findMany({
                where: { guildId: guild.id },
                orderBy: { threshold: 'asc' }
            });

            if (tiers.length === 0) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} No Tiers`,
                    description: 'No streak tiers are configured. Create tiers first with `/streak tier add`.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            const results: string[] = [];

            for (const tier of tiers) {
                const tierAny = tier as any;
                const customMessage = tierAny.message || null;
                const customEmbed = tierAny.embedData || null;

                let newMsg = customMessage
                    ? customMessage
                        .replace(/{user}/g, member.toString())
                        .replace(/{user\.name}/g, member.user.username)
                        .replace(/{tier\.name}/g, tier.name)
                        .replace(/{streak\.count}/g, '1')
                        .replace(/{streak\.longest}/g, '5')
                        .replace(/{tier\.threshold}/g, tier.threshold.toString())
                    : `🔥 **${member.user.username}** started a **${tier.name}** streak! (Threshold: ${tier.threshold} msgs/day)`;

                let maintainMsg = customMessage
                    ? customMessage
                        .replace(/{user}/g, member.toString())
                        .replace(/{user\.name}/g, member.user.username)
                        .replace(/{tier\.name}/g, tier.name)
                        .replace(/{streak\.count}/g, '7')
                        .replace(/{streak\.longest}/g, '14')
                        .replace(/{tier\.threshold}/g, tier.threshold.toString())
                    : `🔥 **${member.user.username}** maintained their **${tier.name}** streak for **7 days**!`;

                await ctx.channel.send({
                    content: `📋 **${tier.name} Tier** (Threshold: ${tier.threshold} msgs/day)\n\n**New Streak:**\n${newMsg}\n\n**Maintained (Day 7):**\n${maintainMsg}`
                });

                if (customEmbed) {
                    try {
                        const embedData = JSON.parse(customEmbed);
                        const embed = new EmbedBuilder()
                            .setTitle(embedData.title?.replace(/{user\.name}/g, member.user.username)?.replace(/{tier\.name}/g, tier.name) || 'Streak!')
                            .setDescription(embedData.description?.replace(/{user}/g, member.toString())?.replace(/{streak\.count}/g, '7')?.replace(/{tier\.name}/g, tier.name) || null)
                            .setColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : client.color.main)
                            .setTimestamp();
                        
                        await ctx.channel.send({ embeds: [embed] });
                    } catch (e) {
                        // Ignore parse errors in preview
                    }
                }

                results.push(`✅ **${tier.name}** — Threshold: ${tier.threshold}, Custom: ${customMessage ? 'Yes' : 'No'}, Embed: ${customEmbed ? 'Yes' : 'No'}`);
            }

            const summaryEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.info} Streak Test Summary`)
                .setDescription(results.join('\n'))
                .setColor(client.color.main)
                .setFooter({ text: `Preview using ${member.user.username} as the test user.` })
                .setTimestamp();

            return ctx.editReply({ embeds: [summaryEmbed] });
        }
    }
}
