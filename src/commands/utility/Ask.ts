import { Command, Context } from "../../structures";
import {
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";
import { getAIResponse } from "../../handlers/aiHandler";
import { ApplicationIntegrationType, InteractionContextType } from "discord.js";

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
			integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
			contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
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
		if (!ctx.deferred && !ctx.replied) {
			await ctx.deferReply();
		}

		try {
			// Get AI configuration settings for this guild (or default for DMs)
			const guildId = ctx.guild?.id;
			let settings = {
				aiPersonality: "CASUAL",
				aiCustomPrompt: null as string | null,
				aiSearchEnabled: false,
			};

			if (guildId) {
				const guildSettings = await client.prisma.guild.findUnique({
					where: { id: guildId },
					select: {
						aiPersonality: true,
						aiCustomPrompt: true,
						aiSearchEnabled: true,
					},
				});
				if (guildSettings) {
					settings.aiPersonality = guildSettings.aiPersonality || "CASUAL";
					settings.aiCustomPrompt = guildSettings.aiCustomPrompt || null;
					settings.aiSearchEnabled = guildSettings.aiSearchEnabled || false;
				}
			}

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
		} catch (error: any) {
			return await ctx.replyV2({
				title: `${client.emoji.cross} Error`,
				description: `Failed to process AI query: ${error.message}`,
				isAlert: true,
				color: client.color.red,
			});
		}
	}
}
