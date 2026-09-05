import { ApplicationCommandOptionType, PermissionFlagsBits, Role } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class PollPing extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'poll-ping',
			aliases: ['pollping'],
			description: {
				content: 'Configure or view the role to ping when a poll is created.',
				usage: 'poll-ping [role | clear]',
				examples: ['poll-ping @Polls', 'poll-ping clear']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageGuild]
			},
			options: [
				{
					name: 'role',
					description: 'The role to ping when a poll is created',
					type: ApplicationCommandOptionType.Role,
					required: false
				},
				{
					name: 'clear',
					description: 'Clear the poll notification ping role',
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		if (!ctx.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
			return ctx.replyV2({
				title: `${client.emoji.cross} Missing Permissions`,
				description: 'You need the **Manage Server** permission to configure the poll ping role.',
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		const clear = ctx.options.getBoolean('clear') ||
					  args[0]?.toLowerCase() === 'clear' ||
					  args[0]?.toLowerCase() === 'none' ||
					  args[0]?.toLowerCase() === 'remove';

		let targetRole: Role | null = ctx.options.getRole('role');
		if (!targetRole && !clear && args[0]) {
			const roleId = args[0].replace(/[<@&>]/g, '');
			targetRole = ctx.guild?.roles.cache.get(roleId) || null;
		}

		if (clear) {
			await client.prisma.guild.upsert({
				where: { id: ctx.guild.id },
				update: { pollPingRoleId: null },
				create: { id: ctx.guild.id, pollPingRoleId: null }
			});

			return ctx.replyV2({
				title: `${client.emoji.success} Poll Ping Cleared`,
				description: 'The poll ping role has been removed. New polls will not ping any role by default.',
				borderless: true,
				color: null
			});
		}

		if (targetRole) {
			await client.prisma.guild.upsert({
				where: { id: ctx.guild.id },
				update: { pollPingRoleId: targetRole.id },
				create: { id: ctx.guild.id, pollPingRoleId: targetRole.id }
			});

			return ctx.replyV2({
				title: `${client.emoji.success} Poll Ping Configured`,
				description: `New polls will now ping <@&${targetRole.id}> by default.`,
				borderless: true,
				color: null
			});
		}

		// View status
		const guildData = await client.prisma.guild.findUnique({
			where: { id: ctx.guild.id }
		});

		const currentRole = guildData?.pollPingRoleId;
		return ctx.replyV2({
			title: '📊 Poll Ping Status',
			description: currentRole
				? `Current poll notification role: <@&${currentRole}>.\n\nTo change: \`/poll-ping role:@Role\`\nTo remove: \`/poll-ping clear:True\` or \`${ctx.prefix}poll ping clear\``
				: `No poll ping role is currently configured.\n\nTo set one: \`/poll-ping role:@Role\` or \`${ctx.prefix}poll ping @Role\``,
			borderless: true,
			color: null
		});
	}
}
