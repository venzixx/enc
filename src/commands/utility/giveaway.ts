import { ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from "discord.js";
import ms from "ms";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";
import { V2Helper } from "../../utils/V2Helper";

export default class Giveaway extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'giveaway',
			description: {
				content: 'Manage server giveaways and configurations.',
				usage: 'giveaway <group> <command>',
				examples: ['giveaway manage start 1h 1 Nitro Boost']
			},
			category: 'giveaway',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageMessages],
				client: [PermissionFlagsBits.EmbedLinks]
			},
			options: [
				{
					name: 'manage',
					description: 'Manage active giveaways',
					type: 2, // SUB_COMMAND_GROUP
					options: [
						{
							name: 'start',
							description: 'Start a new giveaway',
							type: 1, // SUB_COMMAND
							options: [
								{ name: 'duration', description: 'Giveaway duration (e.g. 1h, 1d)', type: 3, required: true },
								{ name: 'winners', description: 'Number of winners', type: 4, required: true },
								{ name: 'prize', description: 'The prize for the giveaway', type: 3, required: true },
								{ name: 'channel', description: 'Channel to start giveaway in', type: 7, required: false, channel_types: [ChannelType.GuildText] }
							]
						},
						{
							name: 'end',
							description: 'End a giveaway early',
							type: 1,
							options: [
								{ name: 'message_id', description: 'The ID of the giveaway message', type: 3, required: true }
							]
						},
						{
							name: 'reroll',
							description: 'Reroll a winner for an ended giveaway',
							type: 1,
							options: [
								{ name: 'message_id', description: 'The ID of the giveaway message', type: 3, required: true }
							]
						}
					]
				},
				{
					name: 'blacklist',
					description: 'Manage giveaway blacklist',
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
							description: 'Remove user from blacklist',
							type: 1,
							options: [
								{ name: 'user', description: 'The user to pardon', type: 6, required: true }
							]
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
							options: [{ name: 'role', description: 'The role to require', type: 8, required: true }]
						},
						{
							name: 'default_invites',
							description: 'Set default invite requirement for new giveaways',
							type: 1,
							options: [{ name: 'count', description: 'Number of invites required', type: 4, required: true }]
						}
					]
				},
				{
					name: 'entry',
					description: 'Configure bonus entries for roles or users',
					type: 2,
					options: [
						{
							name: 'set',
							description: 'Set bonus entries multiplier for a role or user',
							type: 1,
							options: [
								{ name: 'target', description: 'The role or user', type: 9, required: true },
								{ name: 'bonus', description: 'Extra entries they receive (default 1)', type: 4, required: false }
							]
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply(true);
		
		const group = ctx.options.getSubcommandGroup() || 'manage';
		const sub = ctx.options.getSubcommand();

		if (group === 'manage') {
			if (sub === 'start') {
				const duration = ctx.options.getString('duration');
				const winners = ctx.options.getInteger('winners');
				const prize = ctx.options.getString('prize');
				const channel = (ctx.options.getChannel('channel') || ctx.channel) as any;

				const time = duration ? ms(duration) : null;
				if (!time || (time as any) < 10000) {
					return await ctx.replyV2({ description: 'Invalid duration.', color: client.color.red, isAlert: true, ephemeral: true });
				}

				const endTime = new Date(Date.now() + (time as any));
				
                // Get defaults
                const guildConf = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
                let desc = `Click the button below to enter!\n\n${client.emoji.clock} **Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n **Winners:** ${winners}\n${client.emoji.user} **Hosted by:** ${ctx.author}`;

                if (guildConf?.giveawayDefaultRoleId) desc += `\n\n **Requirement:** <@&${guildConf.giveawayDefaultRoleId}>`;
                if (guildConf?.giveawayDefaultInvites) desc += `\n **Invites Req:** ${guildConf.giveawayDefaultInvites}+`;

				const giveawayLayout = V2Helper.createLayout({
					title: ` Giveaway: ${prize} `,
					description: desc,
					color: client.color.main,
					buttons: [
						new ButtonBuilder()
							.setCustomId('giveaway_enter')
							.setLabel('Enter')
							.setStyle(ButtonStyle.Secondary)
					]
				});

				const msg = await channel.send(giveawayLayout as any);

				await client.prisma.giveaway.create({
					data: {
						guildId: ctx.guild.id,
						channelId: channel.id,
						messageId: msg.id,
						prize,
						winnersCount: winners,
						endTime,
						hostId: ctx.author.id,
                        reqRoleId: guildConf?.giveawayDefaultRoleId,
                        reqInvites: guildConf?.giveawayDefaultInvites ?? 0
					}
				});

				return await ctx.replyV2({ title: `${client.emoji.success} Started`, description: 'Finished.', color: client.color.main, ephemeral: true });
			}

			if (sub === 'end') {
				const messageId = ctx.options.getString('message_id')!;
				await client.prisma.giveaway.update({ where: { messageId }, data: { endTime: new Date() } }).catch(() => null);
				return await ctx.replyV2({ description: 'Ending.', color: client.color.main, ephemeral: true });
			}
			if (sub === 'reroll') {
                return await ctx.replyV2({ description: 'Reroll requested.', color: client.color.main, ephemeral: true });
			}
		}

        if (group === 'blacklist') {
            const user = ctx.options.getUser('user')!;
            if (sub === 'add') {
                await client.prisma.giveawayBlacklist.upsert({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } },
                    create: { guildId: ctx.guild.id, userId: user.id },
                    update: {}
                });
                return ctx.replyV2({ description: `${user} blacklisted.`, color: client.color.main, ephemeral: true });
            }
            if (sub === 'remove') {
                await client.prisma.giveawayBlacklist.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } }
                }).catch(() => null);
                return ctx.replyV2({ description: `${user} unblacklisted.`, color: client.color.main, ephemeral: true });
            }
        }

        if (group === 'config') {
            if (sub === 'default_role') {
                const role = ctx.options.getRole('role')!;
                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: { giveawayDefaultRoleId: role.id }
                });
                return ctx.replyV2({ description: `Default role set.`, color: client.color.main, ephemeral: true });
            }
            if (sub === 'default_invites') {
                const count = ctx.options.getInteger('count')!;
                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: { giveawayDefaultInvites: count }
                });
                return ctx.replyV2({ description: `Default invites set.`, color: client.color.main, ephemeral: true });
            }
        }


        if (group === 'entry') {
            if (sub === 'set') {
                const target = ctx.options.getMentionable('target')!;
                const bonus = ctx.options.getInteger('bonus') || 1;
                
                const isRole = 'color' in target || 'permissions' in target;
                const type = isRole ? 'ROLE' : 'USER';
                
                await client.prisma.giveawayBonusEntry.upsert({
                    where: { guildId_targetId: { guildId: ctx.guild.id, targetId: target.id } },
                    create: { guildId: ctx.guild.id, targetId: target.id, type, entries: bonus },
                    update: { entries: bonus }
                });
                return ctx.replyV2({ description: `Bonus entries for ${target} set to ${bonus}.`, color: client.color.main, ephemeral: true });
            }
        }
	}
}
