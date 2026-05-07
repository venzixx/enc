import { PermissionFlagsBits, EmbedBuilder, AttachmentBuilder, GuildMember } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";
import { PlaceholderManager } from "../../utils/PlaceholderManager";

export default class GreeterTest extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'greeter-test',
            aliases: ['testgreeter', 'test-greeter'],
            description: {
                content: 'Preview your configured greeter/welcome messages without anyone needing to join or leave.',
                usage: 'greeter-test [type]',
                examples: ['greeter-test', 'greeter-test welcome', 'greeter-test leave']
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
                    name: 'type',
                    description: 'Which message type to preview',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'Greeter Message', value: 'greeter' },
                        { name: 'Welcome Image', value: 'welcome' },
                        { name: 'Leave Message', value: 'leave' },
                        { name: 'Join DM', value: 'joindm' },
                        { name: 'All', value: 'all' },
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const type = ctx.isInteraction
            ? ctx.options.getString('type') || 'all'
            : args[0]?.toLowerCase() || 'all';

        const member = ctx.member as GuildMember;
        const guild = ctx.guild!;

        const guildData = await client.prisma.guild.findUnique({
            where: { id: guild.id }
        });

        if (!guildData) {
            return ctx.sendV2({
                title: `${client.emoji.cross} No Configuration`,
                description: 'No guild data found. Please set up your greeter/welcome messages first.',
                isAlert: true,
                color: client.color.red
            });
        }

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
            if (guildData.welcomeChannelId) {
                try {
                    const { generateWelcomeImage } = await import('../../services/imageBuilder');
                    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                    const imageBuffer = await generateWelcomeImage(avatarUrl, member.user.username, guild.memberCount);
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
            } else {
                results.push('⏭️ Welcome image not configured (no channel set)');
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

        // Summary
        const summaryEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.info} Greeter Test Summary`)
            .setDescription(results.join('\n'))
            .setColor(client.color.main)
            .setFooter({ text: 'This is a preview using you as the test member.' })
            .setTimestamp();

        return ctx.editReply({ embeds: [summaryEmbed] });
    }
}
