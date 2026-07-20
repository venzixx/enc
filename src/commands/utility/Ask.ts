import { Command, Context } from "../../structures";
import {
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";
import { getAIResponse } from "../../handlers/aiHandler";

export default class AskCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ask",
			description: {
				content: "Ask the bot's AI a question directly.",
				examples: ["ask what is the capital of France?", "ask compile a quick python function"],
				usage: "ask <question>",
			},
			category: "utility",
			aliases: ["chat", "q"],
			cooldown: 5,
			args: true,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: [
					SendMessages,
					ReadMessageHistory,
					ViewChannel,
					EmbedLinks,
				],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: "question",
					description: "The question to ask the AI",
					type: 3, // STRING
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		let prompt = "";
		if (ctx.interaction) {
			prompt = ctx.options.getString("question", true);
		} else {
			prompt = args.join(" ");
		}

		if (!prompt.trim()) {
			return await ctx.replyV2({
				title: `${client.emoji.cross} Missing Argument`,
				description: "Please provide a question to ask the AI.",
				isAlert: true,
				color: client.color.main,
			});
		}

		// Defer reply since AI model call can take a few seconds
		await ctx.deferReply();

		try {
			// Get AI configuration settings for this guild
			const guildSettings = await client.prisma.guild.findUnique({
				where: { id: ctx.guild.id },
				select: {
					aiPersonality: true,
					aiCustomPrompt: true,
					aiSearchEnabled: true,
				},
			});

			const settings = {
				aiPersonality: guildSettings?.aiPersonality || "CASUAL",
				aiCustomPrompt: guildSettings?.aiCustomPrompt || null,
				aiSearchEnabled: guildSettings?.aiSearchEnabled || false,
			};

			const response = await getAIResponse(prompt, settings, true);

			// Split response if it's too long for a single embed description (4096 characters limit)
			const formattedPrompt = prompt.length > 50 ? `${prompt.substring(0, 47)}...` : prompt;
			const provider = process.env.GEMINI_API_KEY ? "Gemini AI" : "Mistral AI";
			
			return await ctx.replyV2({
				title: `**Query: ${formattedPrompt}**`,
				description: response.length > 4000 ? `${response.substring(0, 3997)}...` : response,
				color: client.color.main,
				footer: `Asked by ${ctx.author.username} \u2022 Powered by ${provider}`,
			});
		} catch (error) {
			console.error("[ASK_COMMAND_ERROR]", error);
			return await ctx.replyV2({
				title: `${client.emoji.cross} AI Error`,
				description: "Something went wrong while processing your AI request.",
				isAlert: true,
				color: client.color.main,
			});
		}
	}
}
