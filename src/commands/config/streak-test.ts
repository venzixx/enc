import { PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";

export default class StreakTest extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'streak-test',
            aliases: ['teststreak', 'test-streak'],
            description: {
                content: 'Preview your configured streak notification messages.',
                usage: 'streak-test [user]',
                examples: ['streak-test', 'streak-test @user']
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
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const guild = ctx.guild!;
        const member = (ctx.isInteraction ? ctx.options.getMember('user') : ctx.member) as GuildMember || ctx.member as GuildMember;

        const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });
        if (!guildData || !guildData.streaksEnabled) {
            return ctx.sendV2({
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
            return ctx.sendV2({
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

            // Simulate "new streak" message
            let newMsg = customMessage
                ? customMessage
                    .replace(/{user}/g, member.toString())
                    .replace(/{user\.name}/g, member.user.username)
                    .replace(/{tier\.name}/g, tier.name)
                    .replace(/{streak\.count}/g, '1')
                    .replace(/{streak\.longest}/g, '5')
                    .replace(/{tier\.threshold}/g, tier.threshold.toString())
                : `🔥 **${member.user.username}** started a **${tier.name}** streak! (Threshold: ${tier.threshold} msgs/day)`;

            // Simulate "maintained streak" message
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

            // If custom embed data exists, also preview it
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
