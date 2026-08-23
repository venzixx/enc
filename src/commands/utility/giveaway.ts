import { 
    ChannelType, 
    EmbedBuilder, 
    GuildTextBasedChannel, 
    PermissionFlagsBits, 
    Role, 
    TextChannel, 
    User 
} from "discord.js";
import ms from "ms";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";
import { GiveawayManager } from "../../utils/GiveawayManager";
import { Resolver } from "../../utils/Resolver";

export default class Giveaway extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'giveaway',
            aliases: ['gstart', 'gend', 'greroll', 'glist', 'gway', 'gw', 'giveaways'],
			description: {
				content: 'Start and manage server giveaways, requirements, and configurations.',
				usage: 'giveaway <start|end|reroll|list|blacklist|config|entry>',
				examples: [
                    'gstart 1h 1 Nitro Boost',
                    'gstart 30m 2 Discord Nitro --role @Member --invites 2',
                    'gend 123456789012345678',
                    'greroll 123456789012345678',
                    'glist'
                ]
			},
			category: 'utility',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageGuild],
				client: [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages]
			},
			options: [
				{
					name: 'start',
					description: 'Start a new giveaway',
					type: 1, // SUB_COMMAND
					options: [
						{ name: 'duration', description: 'Giveaway duration (e.g. 10m, 1h, 1d)', type: 3, required: true },
						{ name: 'winners', description: 'Number of winners', type: 4, required: true },
						{ name: 'prize', description: 'The prize for the giveaway', type: 3, required: true },
						{ name: 'channel', description: 'Channel to start giveaway in', type: 7, required: false, channel_types: [ChannelType.GuildText] },
						{ name: 'role', description: 'Required role to enter', type: 8, required: false },
						{ name: 'invites', description: 'Required invites count to enter', type: 4, required: false }
					]
				},
				{
					name: 'end',
					description: 'End an active giveaway early',
					type: 1,
					options: [
						{ name: 'message_id', description: 'The message ID of the giveaway (optional)', type: 3, required: false }
					]
				},
				{
					name: 'reroll',
					description: 'Reroll a new winner for an ended giveaway',
					type: 1,
					options: [
						{ name: 'message_id', description: 'The message ID of the giveaway (optional)', type: 3, required: false },
						{ name: 'winners', description: 'Number of winners to reroll (default: 1)', type: 4, required: false }
					]
				},
				{
					name: 'list',
					description: 'List all active giveaways in the server',
					type: 1
				},
				{
					name: 'blacklist',
					description: 'Manage giveaway blacklisted users',
					type: 2,
					options: [
						{
							name: 'add',
							description: 'Prevent user from joining giveaways',
							type: 1,
							options: [
								{ name: 'user', description: 'The user to blacklist', type: 6, required: true }
							]
						},
						{
							name: 'remove',
							description: 'Remove user from giveaway blacklist',
							type: 1,
							options: [
								{ name: 'user', description: 'The user to pardon', type: 6, required: true }
							]
						},
						{
							name: 'list',
							description: 'List all blacklisted users',
							type: 1
						}
					]
				},
				{
					name: 'config',
					description: 'Configure server-wide default giveaway settings',
					type: 2,
					options: [
						{
							name: 'default_role',
							description: 'Set default role requirement for new giveaways',
							type: 1,
							options: [{ name: 'role', description: 'The role to require (or omit to reset)', type: 8, required: false }]
						},
						{
							name: 'default_invites',
							description: 'Set default invite requirement for new giveaways',
							type: 1,
							options: [{ name: 'count', description: 'Number of invites required (0 to disable)', type: 4, required: true }]
						},
						{
							name: 'bypass_role',
							description: 'Set bypass role that skips all giveaway requirements',
							type: 1,
							options: [{ name: 'role', description: 'The bypass role (or omit to reset)', type: 8, required: false }]
						},
						{
							name: 'show',
							description: 'Show current giveaway server configuration',
							type: 1
						}
					]
				},
				{
					name: 'entry',
					description: 'Configure bonus entry multipliers for roles or users',
					type: 2,
					options: [
						{
							name: 'set',
							description: 'Set bonus entries for a role or user',
							type: 1,
							options: [
								{ name: 'target', description: 'The role or user', type: 9, required: true },
								{ name: 'bonus', description: 'Extra entries count (e.g. 2, 5)', type: 4, required: true }
							]
						},
						{
							name: 'remove',
							description: 'Remove bonus entries for a role or user',
							type: 1,
							options: [
								{ name: 'target', description: 'The role or user', type: 9, required: true }
							]
						},
						{
							name: 'list',
							description: 'List all bonus entries configured in this server',
							type: 1
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) {
            return ctx.sendMessage({ content: '❌ Giveaway commands can only be used in servers.' });
        }

        // Determine subcommand & group
        let group = '';
        let sub = '';

        if (ctx.isInteraction) {
            group = ctx.options.getSubcommandGroup() || '';
            sub = ctx.options.getSubcommand() || '';
        } else {
            const invoked = ctx.message?.content.slice(1).trim().split(/\s+/)[0]?.toLowerCase() || '';

            if (invoked === 'gstart') {
                sub = 'start';
            } else if (invoked === 'gend') {
                sub = 'end';
            } else if (invoked === 'greroll') {
                sub = 'reroll';
            } else if (invoked === 'glist') {
                sub = 'list';
            } else {
                const firstArg = args[0]?.toLowerCase();
                if (firstArg === 'start' || firstArg === 'end' || firstArg === 'reroll' || firstArg === 'list') {
                    sub = firstArg;
                    args = args.slice(1);
                } else if (firstArg === 'blacklist' || firstArg === 'config' || firstArg === 'entry') {
                    group = firstArg;
                    sub = args[1]?.toLowerCase() || 'list';
                    args = args.slice(2);
                } else if (firstArg === 'manage') {
                    sub = args[1]?.toLowerCase() || 'start';
                    args = args.slice(2);
                } else {
                    sub = 'start';
                }
            }
        }

        // ══════════════════════════════════════════════════════
        // 1. START GIVEAWAY (gstart / giveaway start)
        // ══════════════════════════════════════════════════════
        if (sub === 'start') {
            let durationStr = '';
            let winners = 1;
            let prize = '';
            let targetChannel = (ctx.channel as TextChannel);
            let reqRoleId: string | null = null;
            let reqInvites = 0;

            if (ctx.isInteraction) {
                durationStr = ctx.options.getString('duration', true);
                winners = ctx.options.getInteger('winners', true);
                prize = ctx.options.getString('prize', true);
                const ch = ctx.options.getChannel('channel');
                if (ch) targetChannel = ch as TextChannel;
                const r = ctx.options.getRole('role');
                if (r) reqRoleId = r.id;
                reqInvites = ctx.options.getInteger('invites') || 0;
            } else {
                if (!args[0]) {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('🎉 Giveaway Start Help')
                        .setDescription(
                            '**Usage:** `,gstart <duration> <winners> <prize> [--role @role] [--invites <count>] [--channel #channel]`\n\n' +
                            '**Examples:**\n' +
                            '• `,gstart 10m 1 Nitro Classic`\n' +
                            '• `,gstart 1h 2 Discord Nitro --role @Member --invites 3`\n' +
                            '• `,gstart 2d 5 Steam Gift Card --channel #giveaways`'
                        )
                        .setColor(client.color.main || 0x5865F2);
                    return ctx.sendMessage({ embeds: [helpEmbed] });
                }

                durationStr = args[0];
                const rawWinners = args[1] ? args[1].replace(/w$/i, '') : '1';
                winners = parseInt(rawWinners, 10);
                if (isNaN(winners) || winners < 1) winners = 1;

                // Parse remaining args and flags
                let prizeArgs = args.slice(2);
                
                // Extract flags
                for (let i = 0; i < prizeArgs.length; i++) {
                    const flag = prizeArgs[i]?.toLowerCase();
                    if ((flag === '--role' || flag === '-r') && prizeArgs[i + 1]) {
                        const roleObj = await Resolver.resolveRole(ctx, prizeArgs[i + 1]);
                        if (roleObj) reqRoleId = roleObj.id;
                        prizeArgs.splice(i, 2);
                        i--;
                    } else if ((flag === '--invites' || flag === '-i') && prizeArgs[i + 1]) {
                        reqInvites = parseInt(prizeArgs[i + 1], 10) || 0;
                        prizeArgs.splice(i, 2);
                        i--;
                    } else if ((flag === '--channel' || flag === '-c') && prizeArgs[i + 1]) {
                        const chObj = await Resolver.resolveChannel(ctx, prizeArgs[i + 1]);
                        if (chObj && chObj.isTextBased()) targetChannel = chObj as TextChannel;
                        prizeArgs.splice(i, 2);
                        i--;
                    }
                }

                prize = prizeArgs.join(' ').trim();
                if (!prize) {
                    prize = 'Special Gift';
                }
            }

            const parsedMs: number | null = durationStr ? (ms(durationStr as any) as unknown as number) : null;
            if (typeof parsedMs !== 'number' || isNaN(parsedMs) || parsedMs < 5000 || parsedMs > 30 * 24 * 60 * 60 * 1000) {
                const errEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Duration')
                    .setDescription('Please provide a valid duration between **10 seconds** and **30 days** (e.g. `10m`, `1h`, `1d`).')
                    .setColor(client.color.red || 0xef4444);
                return ctx.sendMessage({ embeds: [errEmbed] });
            }

            const endTime = new Date(Date.now() + parsedMs);

            // Fetch guild default requirements if not explicitly passed
            const guildConf = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
            if (!reqRoleId && guildConf?.giveawayDefaultRoleId) {
                reqRoleId = guildConf.giveawayDefaultRoleId;
            }
            if (reqInvites === 0 && guildConf?.giveawayDefaultInvites) {
                reqInvites = guildConf.giveawayDefaultInvites;
            }

            // Create placeholder giveaway object for embed
            const placeholderGw = {
                prize,
                winnersCount: winners,
                endTime,
                hostId: ctx.author.id,
                reqRoleId,
                reqInvites,
                messageId: 'pending'
            };

            const embed = GiveawayManager.buildEmbed(client, placeholderGw, 0, false);
            const buttons = GiveawayManager.buildButtons(0, false);

            const giveawayMsg = await targetChannel.send({
                embeds: [embed],
                components: [buttons]
            });

            // Save to database
            const createdGiveaway = await client.prisma.giveaway.create({
                data: {
                    guildId: ctx.guild.id,
                    channelId: targetChannel.id,
                    messageId: giveawayMsg.id,
                    prize,
                    winnersCount: winners,
                    endTime,
                    hostId: ctx.author.id,
                    reqRoleId,
                    reqInvites
                }
            });

            // Update footer with real message ID
            const finalEmbed = GiveawayManager.buildEmbed(client, createdGiveaway, 0, false);
            await giveawayMsg.edit({ embeds: [finalEmbed] }).catch(() => null);

            const confirmEmbed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Started!')
                .setDescription(`Successfully created giveaway for **${prize}** in ${targetChannel}!\n\n🔗 [Jump to Giveaway](${giveawayMsg.url})`)
                .setColor(client.color.main || 0x22c55e);

            return ctx.sendMessage({ embeds: [confirmEmbed] });
        }

        // ══════════════════════════════════════════════════════
        // 2. END GIVEAWAY (gend / giveaway end)
        // ══════════════════════════════════════════════════════
        if (sub === 'end') {
            let messageId = ctx.isInteraction ? ctx.options.getString('message_id') : args[0];

            if (!messageId) {
                // Find latest active giveaway in current channel
                const latestGw = await client.prisma.giveaway.findFirst({
                    where: { guildId: ctx.guild.id, channelId: ctx.channel.id, isActive: true },
                    orderBy: { id: 'desc' }
                });
                if (latestGw) {
                    messageId = latestGw.messageId;
                } else {
                    const errEmbed = new EmbedBuilder()
                        .setTitle('❌ No Active Giveaway')
                        .setDescription('No active giveaway found in this channel. Please specify the **Message ID** (e.g. `,gend <messageId>`).')
                        .setColor(client.color.red || 0xef4444);
                    return ctx.sendMessage({ embeds: [errEmbed] });
                }
            }

            const result = await GiveawayManager.endGiveaway(client, messageId);
            if (!result.success) {
                const errEmbed = new EmbedBuilder()
                    .setTitle('❌ Error Ending Giveaway')
                    .setDescription(result.error || 'Failed to end giveaway.')
                    .setColor(client.color.red || 0xef4444);
                return ctx.sendMessage({ embeds: [errEmbed] });
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('🏁 Giveaway Ended')
                .setDescription(
                    `Successfully ended giveaway for **${result.giveaway.prize}**!\n\n` +
                    (result.winners && result.winners.length > 0
                        ? `🏆 **Winner(s):** ${result.winners.map(id => `<@${id}>`).join(', ')}`
                        : '❌ No eligible entries found.')
                )
                .setColor(client.color.main || 0x22c55e);

            return ctx.sendMessage({ embeds: [successEmbed] });
        }

        // ══════════════════════════════════════════════════════
        // 3. REROLL GIVEAWAY (greroll / giveaway reroll)
        // ══════════════════════════════════════════════════════
        if (sub === 'reroll') {
            let messageId = ctx.isInteraction ? ctx.options.getString('message_id') : args[0];
            const winnersCount = ctx.isInteraction 
                ? (ctx.options.getInteger('winners') || 1) 
                : (parseInt(args[1], 10) || 1);

            if (!messageId) {
                // Find latest ended giveaway in current channel
                const latestEnded = await client.prisma.giveaway.findFirst({
                    where: { guildId: ctx.guild.id, channelId: ctx.channel.id, isActive: false },
                    orderBy: { id: 'desc' }
                });
                if (latestEnded) {
                    messageId = latestEnded.messageId;
                } else {
                    const errEmbed = new EmbedBuilder()
                        .setTitle('❌ No Ended Giveaway')
                        .setDescription('No ended giveaway found in this channel. Please provide the **Message ID** (e.g. `,greroll <messageId>`).')
                        .setColor(client.color.red || 0xef4444);
                    return ctx.sendMessage({ embeds: [errEmbed] });
                }
            }

            const result = await GiveawayManager.rerollGiveaway(client, messageId, winnersCount);
            if (!result.success) {
                const errEmbed = new EmbedBuilder()
                    .setTitle('❌ Reroll Failed')
                    .setDescription(result.error || 'Unable to reroll giveaway.')
                    .setColor(client.color.red || 0xef4444);
                return ctx.sendMessage({ embeds: [errEmbed] });
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Rerolled')
                .setDescription(`New Winner(s): ${result.winners!.map(id => `<@${id}>`).join(', ')}!`)
                .setColor(client.color.main || 0x22c55e);

            return ctx.sendMessage({ embeds: [successEmbed] });
        }

        // ══════════════════════════════════════════════════════
        // 4. LIST GIVEAWAYS (glist / giveaway list)
        // ══════════════════════════════════════════════════════
        if (sub === 'list') {
            const activeGiveaways = await client.prisma.giveaway.findMany({
                where: { guildId: ctx.guild.id, isActive: true },
                include: { entries: true },
                orderBy: { endTime: 'asc' }
            });

            if (activeGiveaways.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle('🎉 Active Giveaways')
                    .setDescription('There are currently no active giveaways running in this server.\n\nUse `,gstart` to launch one!')
                    .setColor(client.color.main || 0x5865F2);
                return ctx.sendMessage({ embeds: [emptyEmbed] });
            }

            const fields = activeGiveaways.map((gw, idx) => {
                const endTs = Math.floor(new Date(gw.endTime).getTime() / 1000);
                return {
                    name: `${idx + 1}. ${gw.prize}`,
                    value: `📍 **Channel:** <#${gw.channelId}>\n` +
                           `⏰ **Ends:** <t:${endTs}:R>\n` +
                           `🏆 **Winners:** ${gw.winnersCount} | 🎟️ **Entries:** ${gw.entries.length}\n` +
                           `🔗 [Jump to Message](https://discord.com/channels/${gw.guildId}/${gw.channelId}/${gw.messageId})`,
                    inline: false
                };
            });

            const listEmbed = new EmbedBuilder()
                .setTitle(`🎉 Active Giveaways (${activeGiveaways.length})`)
                .addFields(fields)
                .setColor(client.color.main || 0x5865F2)
                .setFooter({ text: ctx.guild.name, iconURL: ctx.guild.iconURL() || undefined });

            return ctx.sendMessage({ embeds: [listEmbed] });
        }

        // ══════════════════════════════════════════════════════
        // 5. BLACKLIST (giveaway blacklist add/remove/list)
        // ══════════════════════════════════════════════════════
        if (group === 'blacklist') {
            if (sub === 'add') {
                let targetUser: User | null = null;
                if (ctx.isInteraction) {
                    targetUser = ctx.options.getUser('user', true);
                } else if (args[0]) {
                    targetUser = await Resolver.resolveUser(ctx, args[0]);
                }

                if (!targetUser) {
                    return ctx.sendMessage({ content: '❌ Please mention a valid user to blacklist.' });
                }

                await client.prisma.giveawayBlacklist.upsert({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } },
                    create: { guildId: ctx.guild.id, userId: targetUser.id },
                    update: {}
                });

                const embed = new EmbedBuilder()
                    .setTitle('🚫 User Blacklisted')
                    .setDescription(`Successfully blacklisted <@${targetUser.id}> from participating in giveaways.`)
                    .setColor(client.color.red || 0xef4444);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'remove') {
                let targetUser: User | null = null;
                if (ctx.isInteraction) {
                    targetUser = ctx.options.getUser('user', true);
                } else if (args[0]) {
                    targetUser = await Resolver.resolveUser(ctx, args[0]);
                }

                if (!targetUser) {
                    return ctx.sendMessage({ content: '❌ Please mention a valid user to pardon.' });
                }

                await client.prisma.giveawayBlacklist.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                }).catch(() => null);

                const embed = new EmbedBuilder()
                    .setTitle('✅ User Unblacklisted')
                    .setDescription(`Successfully removed <@${targetUser.id}> from the giveaway blacklist.`)
                    .setColor(client.color.main || 0x22c55e);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'list') {
                const blacklisted = await client.prisma.giveawayBlacklist.findMany({
                    where: { guildId: ctx.guild.id }
                });

                if (blacklisted.length === 0) {
                    return ctx.sendMessage({ content: 'ℹ️ No users are currently blacklisted from giveaways.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🚫 Blacklisted Users (${blacklisted.length})`)
                    .setDescription(blacklisted.map((b, i) => `${i + 1}. <@${b.userId}> (\`${b.userId}\`)`).join('\n'))
                    .setColor(client.color.red || 0xef4444);

                return ctx.sendMessage({ embeds: [embed] });
            }
        }

        // ══════════════════════════════════════════════════════
        // 6. CONFIG (giveaway config default_role/invites/bypass)
        // ══════════════════════════════════════════════════════
        if (group === 'config') {
            if (sub === 'default_role') {
                let role: Role | null = null;
                if (ctx.isInteraction) {
                    role = ctx.options.getRole('role') as Role | null;
                } else if (args[0]) {
                    role = await Resolver.resolveRole(ctx, args[0]);
                }

                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: { giveawayDefaultRoleId: role ? role.id : null }
                });

                const embed = new EmbedBuilder()
                    .setTitle('⚙️ Default Role Requirement Updated')
                    .setDescription(role ? `New giveaways will now require <@&${role.id}> by default.` : 'Default role requirement has been cleared.')
                    .setColor(client.color.main || 0x22c55e);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'default_invites') {
                const count = ctx.isInteraction ? ctx.options.getInteger('count', true) : parseInt(args[0], 10);
                if (isNaN(count) || count < 0) {
                    return ctx.sendMessage({ content: '❌ Please specify a valid invite count (0 to disable).' });
                }

                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: { giveawayDefaultInvites: count }
                });

                const embed = new EmbedBuilder()
                    .setTitle('⚙️ Default Invites Requirement Updated')
                    .setDescription(count > 0 ? `New giveaways will now require at least **${count} invites** by default.` : 'Default invite requirement has been disabled.')
                    .setColor(client.color.main || 0x22c55e);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'bypass_role') {
                let role: Role | null = null;
                if (ctx.isInteraction) {
                    role = ctx.options.getRole('role') as Role | null;
                } else if (args[0]) {
                    role = await Resolver.resolveRole(ctx, args[0]);
                }

                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: { giveawayBypassRoleId: role ? role.id : null }
                });

                const embed = new EmbedBuilder()
                    .setTitle('⚙️ Bypass Role Updated')
                    .setDescription(role ? `Members with <@&${role.id}> will now bypass all giveaway requirements.` : 'Bypass role has been cleared.')
                    .setColor(client.color.main || 0x22c55e);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'show' || sub === 'list') {
                const guildConf = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
                const embed = new EmbedBuilder()
                    .setTitle(`⚙️ Giveaway Configuration - ${ctx.guild.name}`)
                    .setDescription(
                        `**Default Required Role:** ${guildConf?.giveawayDefaultRoleId ? `<@&${guildConf.giveawayDefaultRoleId}>` : '`None`'}\n` +
                        `**Default Required Invites:** ${guildConf?.giveawayDefaultInvites ? `**${guildConf.giveawayDefaultInvites}**` : '`None`'}\n` +
                        `**Bypass Role:** ${guildConf?.giveawayBypassRoleId ? `<@&${guildConf.giveawayBypassRoleId}>` : '`None`'}`
                    )
                    .setColor(client.color.main || 0x5865F2);

                return ctx.sendMessage({ embeds: [embed] });
            }
        }

        // ══════════════════════════════════════════════════════
        // 7. BONUS ENTRIES (giveaway entry set/remove/list)
        // ══════════════════════════════════════════════════════
        if (group === 'entry') {
            if (sub === 'set') {
                let targetId = '';
                let type: 'ROLE' | 'USER' = 'ROLE';
                let bonus = 1;

                if (ctx.isInteraction) {
                    const mentionable = ctx.options.getMentionable('target', true);
                    bonus = ctx.options.getInteger('bonus', true);
                    targetId = mentionable.id;
                    type = 'color' in mentionable ? 'ROLE' : 'USER';
                } else {
                    const search = args[0];
                    bonus = parseInt(args[1], 10) || 1;
                    const roleObj = await Resolver.resolveRole(ctx, search);
                    if (roleObj) {
                        targetId = roleObj.id;
                        type = 'ROLE';
                    } else {
                        const userObj = await Resolver.resolveUser(ctx, search);
                        if (userObj) {
                            targetId = userObj.id;
                            type = 'USER';
                        }
                    }
                }

                if (!targetId) {
                    return ctx.sendMessage({ content: '❌ Please specify a valid role or user to assign bonus entries to.' });
                }

                await client.prisma.giveawayBonusEntry.upsert({
                    where: { guildId_targetId: { guildId: ctx.guild.id, targetId } },
                    create: { guildId: ctx.guild.id, targetId, type, entries: bonus },
                    update: { entries: bonus }
                });

                const embed = new EmbedBuilder()
                    .setTitle('✨ Bonus Entries Updated')
                    .setDescription(`Successfully assigned **+${bonus} extra entries** to ${type === 'ROLE' ? `<@&${targetId}>` : `<@${targetId}>`}.`)
                    .setColor(client.color.main || 0x22c55e);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'remove') {
                let targetId = '';
                if (ctx.isInteraction) {
                    const mentionable = ctx.options.getMentionable('target', true);
                    targetId = mentionable.id;
                } else {
                    const search = args[0];
                    const roleObj = await Resolver.resolveRole(ctx, search);
                    if (roleObj) targetId = roleObj.id;
                    else {
                        const userObj = await Resolver.resolveUser(ctx, search);
                        if (userObj) targetId = userObj.id;
                    }
                }

                if (!targetId) {
                    return ctx.sendMessage({ content: '❌ Please specify a valid role or user to remove bonus entries from.' });
                }

                await client.prisma.giveawayBonusEntry.delete({
                    where: { guildId_targetId: { guildId: ctx.guild.id, targetId } }
                }).catch(() => null);

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Bonus Entries Removed')
                    .setDescription(`Successfully removed bonus entries for <@${targetId}>.`)
                    .setColor(client.color.main || 0x22c55e);

                return ctx.sendMessage({ embeds: [embed] });
            }

            if (sub === 'list') {
                const bonusEntries = await client.prisma.giveawayBonusEntry.findMany({
                    where: { guildId: ctx.guild.id }
                });

                if (bonusEntries.length === 0) {
                    return ctx.sendMessage({ content: 'ℹ️ No bonus entries configured in this server.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`✨ Configured Bonus Entries (${bonusEntries.length})`)
                    .setDescription(
                        bonusEntries.map((b, i) => 
                            `${i + 1}. ${b.type === 'ROLE' ? `<@&${b.targetId}>` : `<@${b.targetId}>`} ➔ **+${b.entries} entries**`
                        ).join('\n')
                    )
                    .setColor(client.color.main || 0x5865F2);

                return ctx.sendMessage({ embeds: [embed] });
            }
        }
	}
}
