import { EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class NicknameCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'nickname',
            aliases: ['nick'],
            description: {
                content: 'Check or force a member\'s nickname.',
                usage: 'nickname <user> [force <on/off>]',
                examples: ['nickname @Member', 'nickname @Member force on']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageNicknames],
                client: [PermissionFlagsBits.ManageNicknames]
            },
            options: [
                {
                    name: 'user',
                    description: 'The member to check/manage',
                    type: 6,
                    required: true
                },
                {
                    name: 'nickname',
                    description: 'The new nickname to set',
                    type: 3,
                    required: false
                },
                {
                    name: 'force',
                    description: 'Force the nickname (on/off)',
                    type: 3,
                    required: false,
                    choices: [
                        { name: 'On', value: 'on' },
                        { name: 'Off', value: 'off' }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (ctx.interaction) await ctx.deferReply();

        const target = await Resolver.resolveMember(ctx, args[0]);
        if (!target) {
            return await ctx.reply({ content: 'Please provide a valid member.' });
        }

        let forceArg: string | null = null;
        let newNickname: string | null = null;

        if (ctx.interaction) {
            forceArg = ctx.options.getString('force');
            newNickname = ctx.options.getString('nickname');
        } else {
            // Prefix logic: ,nick @user <optional nickname> force <on/off>
            const fullArgs = args.slice(1).join(' ');
            if (fullArgs.toLowerCase().includes('force on')) {
                forceArg = 'on';
                newNickname = fullArgs.replace(/force on/i, '').trim();
            } else if (fullArgs.toLowerCase().includes('force off')) {
                forceArg = 'off';
                newNickname = fullArgs.replace(/force off/i, '').trim();
            } else {
                newNickname = fullArgs.trim();
            }
        }

        // 1. Handle Nickname Change if provided
        if (newNickname) {
            try {
                if (target.roles.highest.position >= (ctx.guild.members.me as GuildMember).roles.highest.position && ctx.guild.ownerId !== ctx.author.id) {
                    return await ctx.reply({ content: 'I cannot change the nickname of someone with a higher or equal role than me.' });
                }
                await target.setNickname(newNickname, `Requested by ${ctx.author.tag}`);
            } catch (err: any) {
                return await ctx.reply({ content: `Failed to change nickname: ${err.message}` });
            }
        }

        // 2. Handle Force Status
        if (forceArg === 'on') {
            // Use the NEW nickname if we just set it, otherwise use current
            const finalNick = newNickname || target.nickname || target.user.username;
            
            await client.prisma.forcedNickname.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } },
                update: { nickname: finalNick },
                create: { guildId: ctx.guild.id, userId: target.id, nickname: finalNick }
            });

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Nickname Forced`)
                .setDescription(`Successfully ${newNickname ? 'updated and ' : ''}forced **${target.user.tag}**'s nickname to \`${finalNick}\`.`)
                .setColor(client.color.main);
            
            return await ctx.reply({ embeds: [embed] });
        } else if (forceArg === 'off') {
            await client.prisma.forcedNickname.deleteMany({
                where: { guildId: ctx.guild.id, userId: target.id }
            });

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Force Removed`)
                .setDescription(`Successfully ${newNickname ? 'updated nickname and ' : ''}removed force for **${target.user.tag}**.`)
                .setColor(client.color.main);
            
            return await ctx.reply({ embeds: [embed] });
        }

        // 3. If no force arg and no nickname change, just show info
        if (!newNickname && !forceArg) {
            const isForced = await client.prisma.forcedNickname.findUnique({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
            });

            const embed = new EmbedBuilder()
                .setTitle(`Nickname Info: ${target.user.tag}`)
                .addFields(
                    { name: 'Current Nickname', value: target.nickname || 'None', inline: true },
                    { name: 'Force Status', value: isForced ? `${client.emoji.success} Forced (\`${isForced.nickname}\`)` : `${client.emoji.cross} Not Forced`, inline: true }
                )
                .setColor(client.color.main)
                .setThumbnail(target.user.displayAvatarURL());

            return await ctx.reply({ embeds: [embed] });
        } else if (newNickname && !forceArg) {
            return await ctx.reply({ content: `${client.emoji.success} Successfully changed nickname for **${target.user.tag}** to \`${newNickname}\`.` });
        }
    }
}
