import { EmbedBuilder, TextChannel, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { RankCardGenerator } from '../../utils/RankCardGenerator';
import { PlaceholderManager } from '../../utils/PlaceholderManager';

export default class TestConfigCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'test',
            description: {
                content: 'Test various bot configurations (Leveling, Streaks, Greeter).',
                usage: 'test <level/streak/greeter>',
                examples: ['test level', 'test streak', 'test greeter']
            },
            category: 'tools',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild]
            },
            options: [
                {
                    name: 'level',
                    description: 'Test the level-up message and rank card.',
                    type: 1
                },
                {
                    name: 'streak',
                    description: 'Test the streak notification.',
                    type: 1
                },
                {
                    name: 'greeter',
                    description: 'Test the welcome/greeter message.',
                    type: 1
                },
                {
                    name: 'welcome',
                    description: 'Test the welcome image and message.',
                    type: 1
                }
            ]
        });
     }
 
     public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
         const sub = ctx.interaction ? ctx.options.getSubcommand() : args[0]?.toLowerCase();
 
         if (!sub || !['level', 'streak', 'greeter', 'welcome'].includes(sub)) {
             return await ctx.reply({ content: `Usage: \`${ctx.prefix}test <level/streak/greeter/welcome>\`` });
         }
 
         const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
         if (!guildData) return await ctx.reply({ content: "Guild data not found." });
 
         switch (sub) {
             case 'level':
                 return this.testLevel(client, ctx, guildData);
             case 'streak':
                 return this.testStreak(client, ctx, guildData);
             case 'greeter':
                 return this.testGreeter(client, ctx, guildData);
             case 'welcome':
                 return this.testWelcome(client, ctx, guildData);
         }
     }

    private async testLevel(client: ExtendedClient, ctx: Context, guild: any) {
        if (ctx.interaction) await ctx.deferReply();
        else await ctx.reply({ content: "⏳ Generating test level-up output..." });

        const testLevel = 5;
        const testXP = 1500;
        const testRank = 1;

        const content = (guild.levelUpMessage ?? "GG {user.mention}, you just reached level **{user.level}**!")
            .replace(/{user\.mention}/g, `<@${ctx.author.id}>`)
            .replace(/{user\.tag}/g, ctx.author.tag)
            .replace(/{user\.name}/g, ctx.author.username)
            .replace(/{user\.level}/g, testLevel.toString());

        let attachment: AttachmentBuilder | undefined;
        if (guild.levelUpImageEnabled) {
            try {
                const cardBuffer = await RankCardGenerator.generate({
                    username: ctx.author.username,
                    avatarUrl: ctx.author.displayAvatarURL({ extension: 'png', size: 256 }),
                    level: testLevel,
                    rank: testRank,
                    currentXp: testXP,
                    requiredXp: 2500,
                    color: guild.rankCardProgressColor || undefined,
                });
                attachment = new AttachmentBuilder(cardBuffer, { name: `test-levelup.png` });
            } catch (err) {
                console.error("Test Level Card Error:", err);
            }
        }

        const targetChannelId = guild.levelUpChannelId || guild.levelChannelId;
        const targetChannel = targetChannelId ? 
            (ctx.guild.channels.cache.get(targetChannelId) as TextChannel) : 
            (ctx.channel as TextChannel);

        const sendOutput = async (data: any) => {
            if (targetChannelId && targetChannelId !== ctx.channel.id) {
                await targetChannel.send(data);
                await ctx.reply({ content: `✅ Test level-up sent to <#${targetChannelId}>` });
            } else {
                await ctx.reply(data);
            }
        };

        if (guild.levelUpEmbedData) {
            try {
                const embedData = JSON.parse(guild.levelUpEmbedData);
                const resolveField = (text: string | undefined) => {
                    if (!text) return undefined;
                    return text
                        .replace(/{user\.mention}/g, `<@${ctx.author.id}>`)
                        .replace(/{user}/g, `<@${ctx.author.id}>`)
                        .replace(/{user\.name}/g, ctx.author.username)
                        .replace(/{user\.level}/g, testLevel.toString())
                        .replace(/{server}/g, ctx.guild.name);
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

                if (!embedData.title && !embedData.description) embed.setDescription(content);

                await sendOutput({ embeds: [embed], files: attachment ? [attachment] : [] });
            } catch (e) {
                await sendOutput({ content: "Error parsing custom embed data. Falling back to default.", embeds: [new EmbedBuilder().setDescription(content)] });
            }
        } else {
            const embed = new EmbedBuilder()
                .setColor(client.color.main)
                .setDescription(content)
                .setAuthor({ name: ctx.author.username, iconURL: ctx.author.displayAvatarURL() });

            if (attachment) embed.setImage(`attachment://${attachment.name}`);

            await sendOutput({ embeds: [embed], files: attachment ? [attachment] : [] });
        }
    }

    private async testStreak(client: ExtendedClient, ctx: Context, guild: any) {
        const tiers = await client.prisma.streakTier.findMany({ where: { guildId: ctx.guild.id } });
        if (tiers.length === 0) return await ctx.reply({ content: "No streak tiers configured." });

        const tier = tiers[0];
        const newStreakCount = 5;

        const resolveTemplate = (template: string) => {
            return template
                .replace(/{user}/g, `<@${ctx.author.id}>`)
                .replace(/{user\.name}/g, ctx.author.username)
                .replace(/{user\.mention}/g, `<@${ctx.author.id}>`)
                .replace(/{user\.id}/g, ctx.author.id)
                .replace(/{tier\.name}/g, tier.name)
                .replace(/{streak\.count}/g, newStreakCount.toString())
                .replace(/{streak\.longest}/g, "10")
                .replace(/{tier\.threshold}/g, tier.threshold.toString())
                .replace(/{member\.count}/g, ctx.guild.memberCount.toString());
        };

        const streakChannelId = guild.streakChannelId;
        const streakChannel = streakChannelId ? (ctx.guild.channels.cache.get(streakChannelId) as TextChannel) : (ctx.channel as TextChannel);

        const tierAny = tier as any;
        let payload: any = {};

        if (tierAny.embedData) {
            try {
                const embedData = JSON.parse(tierAny.embedData);
                const embed = new EmbedBuilder()
                    .setColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : 0xFF6600)
                    .setTimestamp();

                if (embedData.title) embed.setTitle(resolveTemplate(embedData.title));
                if (embedData.description) embed.setDescription(resolveTemplate(embedData.description));
                if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
                if (embedData.image?.url) embed.setImage(embedData.image.url);
                if (tierAny.imageUrl && !embedData.image?.url) embed.setImage(tierAny.imageUrl);

                payload = { embeds: [embed] };
            } catch (e) {
                payload = { content: "Error parsing streak embed data." };
            }
        } else {
            const content = tierAny.message ? resolveTemplate(tierAny.message) : `🔥 **${ctx.author.username}** maintained their **${tier.name}** streak for **${newStreakCount} days**!`;
            payload = { content };
        }

        if (streakChannelId && streakChannelId !== ctx.channel.id) {
            await streakChannel.send(payload);
            await ctx.reply({ content: `✅ Test streak notification sent to <#${streakChannelId}>` });
        } else {
            await ctx.reply(payload);
        }
    }

    private async testGreeter(client: ExtendedClient, ctx: Context, guild: any) {
        const greeterChannelId = guild.greeterChannelId || guild.welcomeChannelId;
        const greeterChannel = greeterChannelId ? (ctx.guild.channels.cache.get(greeterChannelId) as TextChannel) : (ctx.channel as TextChannel);

        if (!greeterChannel) return await ctx.reply({ content: "No greeter/welcome channel configured." });

        const welcomeRaw = guild.welcomeMessage || guild.greeterMessage || "Welcome to the server, {user}!";
        const welcomeProcessed = welcomeRaw.replace(/{inviter}/g, "Test Inviter#0000");

        const resolved = await PlaceholderManager.resolve(client, welcomeProcessed, ctx.member as any, ctx.guild as any);

        const payload: any = {
            content: resolved.content || undefined,
            embeds: resolved.embeds,
            components: resolved.components
        };

        if (greeterChannelId && greeterChannelId !== ctx.channel.id) {
            await greeterChannel.send(payload);
            await ctx.reply({ content: `✅ Test greeter message sent to <#${greeterChannelId}>` });
        } else {
            await ctx.reply(payload);
        }
    }

    private async testWelcome(client: ExtendedClient, ctx: Context, guild: any) {
        const welcomeChannelId = guild.welcomeChannelId;
        const welcomeChannel = welcomeChannelId ? (ctx.guild.channels.cache.get(welcomeChannelId) as TextChannel) : (ctx.channel as TextChannel);

        if (!welcomeChannel) return await ctx.reply({ content: "No welcome channel configured." });

        if (ctx.interaction) await ctx.deferReply();
        else await ctx.reply({ content: "⏳ Generating test welcome image..." });

        try {
            const { generateWelcomeImage } = await import('../../services/imageBuilder');
            const avatarUrl = ctx.author.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
            const imageBuffer = await generateWelcomeImage(avatarUrl, ctx.author.username, ctx.guild.memberCount, ctx.guild.name);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-preview.png' });

            const welcomeRaw = guild.welcomeMessage || "Welcome to the server, {user}!";
            const resolved = await PlaceholderManager.resolve(client, welcomeRaw, ctx.member as any, ctx.guild as any);

            const embed = new EmbedBuilder()
                .setTitle('👋 Welcome!')
                .setDescription(resolved.content || null)
                .setImage('attachment://welcome-preview.png')
                .setColor(client.color.main)
                .setTimestamp();

            const payload = {
                embeds: [embed, ...resolved.embeds],
                components: resolved.components,
                files: [attachment]
            };

            if (welcomeChannelId && welcomeChannelId !== ctx.channel.id) {
                await welcomeChannel.send(payload);
                await ctx.reply({ content: `✅ Test welcome image and message sent to <#${welcomeChannelId}>` });
            } else {
                await ctx.reply(payload);
            }
        } catch (e: any) {
            await ctx.reply({ content: `❌ Failed to generate welcome preview: ${e.message}` });
        }
    }
}
