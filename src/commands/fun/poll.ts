import { 
	ApplicationCommandOptionType, 
	PermissionFlagsBits, 
	Role 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

function parsePrefixPoll(rawText: string): { question: string, options: string[] } | null {
	if (rawText.includes('|')) {
		const parts = rawText.split('|').map(p => p.trim()).filter(Boolean);
		if (parts.length >= 2) {
			return {
				question: parts[0],
				options: parts.slice(1)
			};
		}
	}

	const regex = /"([^"]+)"|'([^']+)'|“([^”]+)”|”([^”]+)”/g;
	const matches: string[] = [];
	let m;
	while ((m = regex.exec(rawText)) !== null) {
		const val = m[1] || m[2] || m[3] || m[4];
		if (val?.trim()) matches.push(val.trim());
	}

	if (matches.length >= 2) {
		return {
			question: matches[0],
			options: matches.slice(1)
		};
	}

	return null;
}

export default class Poll extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'poll',
			aliases: ['createpoll', 'newpoll'],
			description: {
				content: 'Create a native Discord poll with an automated discussion thread.',
				usage: 'poll <question> <options...> | poll "question" "opt1" "opt2" | poll ping [role | clear]',
				examples: [
					'poll "What is your favorite color?" "Red" "Blue" "Green"',
					'poll Best gaming console? | PC | PlayStation | Xbox | Nintendo',
					'poll ping @Polls'
				]
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'question',
					description: 'The question for the poll (max 300 characters)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'option1',
					description: 'First option (max 55 characters)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'option2',
					description: 'Second option (max 55 characters)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'option3',
					description: 'Third option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option4',
					description: 'Fourth option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option5',
					description: 'Fifth option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option6',
					description: 'Sixth option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option7',
					description: 'Seventh option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option8',
					description: 'Eighth option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option9',
					description: 'Ninth option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'option10',
					description: 'Tenth option',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'duration',
					description: 'Duration of the poll (default: 24 hours)',
					type: ApplicationCommandOptionType.Integer,
					required: false,
					choices: [
						{ name: '1 Hour', value: 1 },
						{ name: '4 Hours', value: 4 },
						{ name: '8 Hours', value: 8 },
						{ name: '24 Hours (1 Day)', value: 24 },
						{ name: '3 Days (72 Hours)', value: 72 },
						{ name: '7 Days (168 Hours)', value: 168 }
					]
				},
				{
					name: 'multiselect',
					description: 'Allow users to select multiple options? (default: false)',
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		// 1. Handle "poll ping" subcommand/action
		if (args[0]?.toLowerCase() === 'ping') {
			if (!ctx.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
				return ctx.replyV2({
					title: `${client.emoji.cross} Missing Permissions`,
					description: 'You need the **Manage Server** permission to configure the poll notification ping role.',
					isAlert: true,
					borderless: true,
					color: null,
					ephemeral: true
				});
			}

			const clear = args[1]?.toLowerCase() === 'clear' || 
						  args[1]?.toLowerCase() === 'none' || 
						  args[1]?.toLowerCase() === 'remove';

			let targetRole: Role | null = null;
			if (!clear && args[1]) {
				const roleId = args[1].replace(/[<@&>]/g, '');
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
					description: 'The poll ping role has been removed. New polls will not ping any role.',
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
					? `Current poll notification role: <@&${currentRole}>.\n\nTo change: \`${ctx.prefix}poll ping @Role\` or \`/poll-ping role:@Role\`\nTo remove: \`${ctx.prefix}poll ping clear\``
					: `No poll ping role is currently configured.\n\nTo set one: \`${ctx.prefix}poll ping @Role\` or \`/poll-ping role:@Role\``,
				borderless: true,
				color: null
			});
		}

		// 2. Parse Question, Options, Duration, Multiselect
		let question = '';
		let options: string[] = [];
		let duration = 24;
		let multiselect = false;

		if (ctx.isInteraction) {
			question = ctx.options.getString('question', true);
			duration = ctx.options.getInteger('duration') || 24;
			multiselect = ctx.options.getBoolean('multiselect') ?? false;

			for (let i = 1; i <= 10; i++) {
				const opt = ctx.options.getString(`option${i}`);
				if (opt && opt.trim()) options.push(opt.trim());
			}
		} else {
			// Prefix command: parse from message content
			const prefix = (ctx as any).prefix || client.config.prefix || 'e!';
			const rawText = ctx.message!.content.slice(prefix.length).trim().replace(/^poll\s+/i, '');

			if (!rawText) {
				return ctx.replyV2({
					title: '❌ Poll Usage',
					description: '**How to create a poll with prefix:**\n\n' +
								 '• **Using Quotes:**\n' +
								 `\`${ctx.prefix}poll "Question here" "Option 1" "Option 2" "Option 3"\`\n\n` +
								 '• **Using Pipes (`|`):**\n' +
								 `\`${ctx.prefix}poll Question here | Option 1 | Option 2 | Option 3\`\n\n` +
								 '• **Configure Ping Role:**\n' +
								 `\`${ctx.prefix}poll ping @Role\` or \`${ctx.prefix}poll ping clear\``,
					isAlert: true,
					borderless: true,
					color: null
				});
			}

			const parsed = parsePrefixPoll(rawText);
			if (!parsed) {
				return ctx.replyV2({
					title: '❌ Invalid Poll Format',
					description: 'Could not parse poll options. Please enclose the question and options in **quotes** or separate them with **pipes (`|`)**.\n\n' +
								 '**Examples:**\n' +
								 `• \`${ctx.prefix}poll "What is your favorite pet?" "Cats" "Dogs" "Birds"\`\n` +
								 `• \`${ctx.prefix}poll Best movie genre? | Action | Sci-Fi | Comedy\``,
					isAlert: true,
					borderless: true,
					color: null
				});
			}

			question = parsed.question;
			options = parsed.options;
		}

		// 3. Validation & Better Error Handling
		if (options.length < 2) {
			return ctx.replyV2({
				title: '❌ Insufficient Options',
				description: 'A poll must have at least **2 options** to be valid.\n\n**Example:**\n`/poll question:"Favorite season?" option1:"Summer" option2:"Winter"`',
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		if (options.length > 10) {
			return ctx.replyV2({
				title: '❌ Too Many Options',
				description: `Discord polls support a maximum of **10 options**. You provided **${options.length}** options.`,
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		if (question.length > 300) {
			return ctx.replyV2({
				title: '❌ Question Too Long',
				description: `The question exceeds Discord's maximum limit of **300 characters** (current length: **${question.length}**).`,
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		const tooLongOption = options.find(opt => opt.length > 55);
		if (tooLongOption) {
			return ctx.replyV2({
				title: '❌ Option Too Long',
				description: `Each poll option cannot exceed **55 characters** (Discord limit).\n\n**Offending option:**\n> "${tooLongOption.substring(0, 50)}..." (${tooLongOption.length} characters)`,
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		// 4. Send the Poll with optional ping
		try {
			const guildData = await client.prisma.guild.findUnique({
				where: { id: ctx.guild.id }
			});

			const pingRoleId = guildData?.pollPingRoleId;

			const pollPayload: any = {
				poll: {
					question: { text: question },
					answers: options.map(opt => ({ text: opt })),
					allowMultiselect: multiselect,
					duration: duration
				}
			};

			if (pingRoleId) {
				pollPayload.content = `<@&${pingRoleId}>`;
				pollPayload.allowedMentions = { roles: [pingRoleId], parse: [], users: [] };
			} else {
				pollPayload.allowedMentions = { parse: [], roles: [], users: [] };
			}

			const pollMessage = await ctx.channel.send(pollPayload);

			// 5. Safely handle thread creation with fallback
			let thread: any = null;
			try {
				if (ctx.channel.isTextBased() && !ctx.channel.isThread() && 'threads' in ctx.channel) {
					thread = await pollMessage.startThread({
						name: `Poll: ${question.substring(0, 45)}`,
						autoArchiveDuration: 1440,
						reason: 'Poll discussion thread'
					});
				}
			} catch {
				// Thread creation failed silently (e.g. missing CreatePublicThreads permission or unsupported channel type)
			}

			const threadInfo = thread
				? `\n🧵 **Discussion Thread:** [Click to open thread](${thread.url})`
				: `\nℹ️ *Discussion thread could not be created (missing permissions or channel does not support threads).*`;

			const pingInfo = pingRoleId 
				? `\n🔔 **Pinged:** <@&${pingRoleId}>`
				: '';

			return ctx.replyV2({
				title: '📊 Poll Created Successfully',
				description: `Your poll **"${question}"** is now live!\n\n🔗 [Jump to Poll](${pollMessage.url})${threadInfo}${pingInfo}`,
				borderless: true,
				color: null,
				ephemeral: true
			});
		} catch (error: any) {
			console.error('Poll creation error:', error);
			return ctx.replyV2({
				title: '❌ Poll Creation Failed',
				description: `Failed to create poll: **${error.message || 'Unknown error'}**.\nPlease verify that the bot has permission to send messages in this channel.`,
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}
	}
}
