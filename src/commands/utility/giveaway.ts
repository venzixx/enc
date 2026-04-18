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
				content: 'Manage server giveaways.',
				usage: 'giveaway start <duration> <winners> <prize>',
				examples: ['giveaway start 1h 1 Nitro Boost']
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
					name: 'start',
					description: 'Start a new giveaway',
					type: 1,
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
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply(true);
		const sub = ctx.options.getSubcommand();

		if (sub === 'start') {
			const duration = ctx.options.getString('duration');
			const winners = ctx.options.getInteger('winners');
			const prize = ctx.options.getString('prize');
			const channel = (ctx.options.getChannel('channel') || ctx.channel) as any;

			const time = duration ? ms(duration) : null;
			if (!time || (time as any) < 10000) {
				return await ctx.replyV2({
					title: ' Invalid Duration',
					description: 'Please provide a valid duration (minimum 10 seconds). Example: `1h`, `1d`.',
					isAlert: true,
					color: client.color.red,
					ephemeral: true
				});
			}

			const endTime = new Date(Date.now() + (time as any));
			const giveawayLayout = V2Helper.createLayout({
				title: ` Giveaway: ${prize} `,
				description: `Click the button below to enter!\n\n${client.emoji.clock} **Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n **Winners:** ${winners}\n${client.emoji.user} **Hosted by:** ${ctx.author}`,
				color: client.color.main,
				buttons: [
					new ButtonBuilder()
						.setCustomId('giveaway_enter')
						.setLabel('Enter')
						.setEmoji({ id: '1494693113216634880', name: 'success' })
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
					hostId: ctx.author.id
				}
			});

			return await ctx.replyV2({
				title: `${client.emoji.success} Giveaway Started`,
				description: `The giveaway has been successfully started in ${channel}.`,
				isAlert: true,
				color: client.color.main,
				ephemeral: true
			});
		}

		if (sub === 'end') {
			const messageId = ctx.options.getString('message_id');
			const giveaway = await client.prisma.giveaway.findUnique({ where: { messageId } });

			if (!giveaway || !giveaway.isActive) {
				return await ctx.replyV2({
					title: ' Active Giveaway Not Found',
					description: 'Could not find an active giveaway with that message ID.',
					isAlert: true,
					color: client.color.red,
					ephemeral: true
				});
			}

			await client.prisma.giveaway.update({
				where: { messageId },
				data: { endTime: new Date() }
			});

			return await ctx.replyV2({
				title: `${client.emoji.success} Ending Giveaway`,
				description: 'The giveaway has been scheduled to end in the next cycle.',
				isAlert: true,
				color: client.color.main,
				ephemeral: true
			});
		}

		if (sub === 'reroll') {
			const messageId = ctx.options.getString('message_id');
			const giveaway = await client.prisma.giveaway.findUnique({
				where: { messageId },
				include: { entries: true }
			});

			if (!giveaway) {
				return await ctx.replyV2({
					title: ' Giveaway Not Found',
					description: 'Could not find a giveaway with that message ID.',
					isAlert: true,
					color: client.color.red,
					ephemeral: true
				});
			}
			if (giveaway.isActive) {
				return await ctx.replyV2({
					title: ' Still Active',
					description: 'This giveaway is still active. Please end it before rerolling.',
					isAlert: true,
					color: client.color.red,
					ephemeral: true
				});
			}

			const entries = giveaway.entries;
			if (entries.length === 0) {
				return await ctx.replyV2({
					title: ' No Entries',
					description: 'No users entered this giveaway, so a winner cannot be rerolled.',
					isAlert: true,
					color: client.color.red,
					ephemeral: true
				});
			}

			const winner = entries[Math.floor(Math.random() * entries.length)];

			return await ctx.replyV2({
				title: ' New Winner Selected!',
				description: `Congratulations <@${winner.userId}>, you are the new winner of **${giveaway.prize}**!`,
				color: client.color.main
			});
		}
	}
}
