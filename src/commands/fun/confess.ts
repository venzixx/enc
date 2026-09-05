import {
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ChatInputCommandInteraction,
	ApplicationCommandOptionType,
	PermissionFlagsBits,
	Role
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Confess extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'confess',
			aliases: ['confession', 'confess-ping', 'confessping'],
			description: {
				content: 'Send an anonymous confession or configure the confession notification ping role.',
				usage: 'confess [send | ping [role | clear]]',
				examples: ['confess', 'confess ping @Confessions', 'confess ping clear']
			},
			category: 'fun',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'send',
					description: 'Send an anonymous confession to the designated channel.',
					type: ApplicationCommandOptionType.Subcommand
				},
				{
					name: 'ping',
					description: 'Configure or view the confession notification ping role (Admin only).',
					type: ApplicationCommandOptionType.Subcommand,
					options: [
						{
							name: 'role',
							description: 'The role to ping when a confession is posted.',
							type: ApplicationCommandOptionType.Role,
							required: false
						},
						{
							name: 'clear',
							description: 'Clear the confession ping role.',
							type: ApplicationCommandOptionType.Boolean,
							required: false
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		let subcommand = ctx.options.getSubcommand?.();

		// Determine if this is a ping configuration command
		const invokedName = (ctx.interaction as any)?.commandName || (ctx.message?.content?.split(/\s+/)[0]?.replace(ctx.prefix, '').toLowerCase());
		const isPingAlias = invokedName === 'confess-ping' || invokedName === 'confessping';

		if (isPingAlias) {
			subcommand = 'ping';
		} else if (!subcommand && args[0]?.toLowerCase() === 'ping') {
			subcommand = 'ping';
		}

		// Subcommand: ping
		if (subcommand === 'ping') {
			if (!ctx.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
				return ctx.replyV2({
					title: `${client.emoji.cross} Missing Permissions`,
					description: 'You need the **Manage Server** permission to configure the confession ping role.',
					borderless: true,
					color: null,
					ephemeral: true
				});
			}

			const clear = ctx.options.getBoolean?.('clear') || 
						  args[1]?.toLowerCase() === 'clear' || 
						  args[1]?.toLowerCase() === 'none' || 
						  args[1]?.toLowerCase() === 'remove' ||
						  (isPingAlias && (args[0]?.toLowerCase() === 'clear' || args[0]?.toLowerCase() === 'none' || args[0]?.toLowerCase() === 'remove'));

			let targetRole: Role | null = ctx.options.getRole?.('role');
			if (!targetRole && !clear) {
				const roleArg = isPingAlias ? args[0] : args[1];
				if (roleArg) {
					const roleId = roleArg.replace(/[<@&>]/g, '');
					targetRole = ctx.guild?.roles.cache.get(roleId) || null;
				}
			}

			if (clear) {
				await client.prisma.guild.upsert({
					where: { id: ctx.guild.id },
					update: { confessPingRoleId: null },
					create: { id: ctx.guild.id, confessPingRoleId: null }
				});

				return ctx.replyV2({
					title: `${client.emoji.success} Confession Ping Cleared`,
					description: 'Confession notification ping role has been removed. New confessions will not ping any role.',
					borderless: true,
					color: null
				});
			}

			if (targetRole) {
				await client.prisma.guild.upsert({
					where: { id: ctx.guild.id },
					update: { confessPingRoleId: targetRole.id },
					create: { id: ctx.guild.id, confessPingRoleId: targetRole.id }
				});

				return ctx.replyV2({
					title: `${client.emoji.success} Confession Ping Configured`,
					description: `New confessions will now ping <@&${targetRole.id}>.`,
					borderless: true,
					color: null
				});
			}

			// If neither role nor clear was specified, display current status
			const guildData = await client.prisma.guild.findUnique({
				where: { id: ctx.guild.id }
			});

			const currentPingRole = guildData?.confessPingRoleId;
			return ctx.replyV2({
				title: ' Confession Ping Status',
				description: currentPingRole 
					? `Current confession ping role: <@&${currentPingRole}>.\n\nTo change: \`/confess ping role:@Role\`\nTo remove: \`/confess ping clear:True\` or \`${ctx.prefix}confess ping clear\``
					: `No confession ping role is currently configured.\n\nTo set one: \`/confess ping role:@Role\` or \`${ctx.prefix}confess ping @Role\``,
				borderless: true,
				color: null
			});
		}

		// Subcommand: send (or default /confess invocation)
		if (!ctx.interaction) {
			const guildData = await client.prisma.guild.findUnique({
				where: { id: ctx.guild.id }
			});
			const channelText = guildData?.confessionChannel ? ` in <#${guildData.confessionChannel}>` : '';

			return ctx.replyV2({
				title: ' Anonymous Confession',
				description: `To send a confession anonymously, please use the \`/confess send\` slash command or click the **Write a Confession** button${channelText}!`,
				borderless: true,
				color: null
			});
		}

		// Show the modal IMMEDIATELY  Discord requires this within 3 seconds
		const modal = new ModalBuilder()
			.setCustomId('confession_modal')
			.setTitle(' Anonymous Confession');

		const confessionInput = new TextInputBuilder()
			.setCustomId('confession_text')
			.setLabel('Your Secret')
			.setPlaceholder('Enter your anonymous confession here...')
			.setStyle(TextInputStyle.Paragraph)
			.setMinLength(10)
			.setMaxLength(2000)
			.setRequired(true);

		const row = new ActionRowBuilder<TextInputBuilder>().addComponents(confessionInput);
		modal.addComponents(row);

		await (ctx.interaction as ChatInputCommandInteraction).showModal(modal);
	}
}
