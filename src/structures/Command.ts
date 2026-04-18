import { 
	type APIApplicationCommandOption,
	type AutocompleteInteraction,
	type PermissionResolvable,
	ApplicationCommandType
} from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import type { ExtendedClient } from "../client";

interface CommandDescription {
	content: string;
	usage: string;
	examples: string[];
}

interface CommandPlayer {
	voice: boolean;
	dj: boolean;
	active: boolean;
	djPerm: string | null;
}

interface CommandPermissions {
	dev: boolean;
	client: PermissionResolvable;
	user: PermissionResolvable;
}

interface CommandOptions {
	name: string;
	name_localizations?: Record<string, string>;
	description?: Partial<CommandDescription>;
	description_localizations?: Record<string, string>;
	aliases?: string[];
	cooldown?: number;
	args?: boolean;
	vote?: boolean;
	player?: Partial<CommandPlayer>;
	permissions?: Partial<CommandPermissions>;
	slashCommand?: boolean;
	type?: ApplicationCommandType;
	options?: APIApplicationCommandOption[];
	category?: string;
	hidden?: boolean;
}

export default class Command {
	public client: ExtendedClient;
	public name: string;
	public name_localizations?: Record<string, string>;
	public description: CommandDescription;
	public description_localizations?: Record<string, string>;
	public aliases: string[];
	public cooldown: number;
	public args: boolean;
	public vote: boolean;
	public player: CommandPlayer;
	public permissions: CommandPermissions;
	public slashCommand: boolean;
	public type: ApplicationCommandType;
	public options: APIApplicationCommandOption[];
	public category: string;
	public hidden: boolean;

	constructor(client: ExtendedClient, options: CommandOptions) {
		this.client = client;
		this.name = options.name;
		this.name_localizations = options.name_localizations ?? {};
		this.description = {
			content: options.description?.content ?? "No description provided",
			usage: options.description?.usage ?? "No usage provided",
			examples: options.description?.examples ?? ["No examples provided"],
		};
		this.description_localizations = options.description_localizations ?? {};
		this.aliases = options.aliases ?? [];
		this.cooldown = options.cooldown ?? 3;
		this.args = options.args ?? false;
		this.vote = options.vote ?? false;
		this.player = {
			voice: options.player?.voice ?? false,
			dj: options.player?.dj ?? false,
			active: options.player?.active ?? false,
			djPerm: options.player?.djPerm ?? null,
		};
		this.permissions = {
			dev: options.permissions?.dev ?? false,
			client: options.permissions?.client ?? [
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.EmbedLinks,
			],
			user: options.permissions?.user ?? [],
		};
		this.slashCommand = options.slashCommand ?? false;
		this.type = options.type ?? ApplicationCommandType.ChatInput;
		this.options = options.options ?? [];
		this.category = options.category ?? "general";
		this.hidden = options.hidden ?? false;
	}

	public async run(_client: ExtendedClient, _message: any, _args: string[]): Promise<any> {
		return await Promise.resolve();
	}
	public async autocomplete(_interaction: AutocompleteInteraction): Promise<void> {
		return await Promise.resolve();
	}
}
