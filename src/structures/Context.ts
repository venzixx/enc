import {
	type APIEmbed,
	type AnySelectMenuInteraction,
	type ButtonInteraction,
	type Channel,
	type CommandInteraction,
	type Guild,
	type GuildMember,
	type GuildTextBasedChannel,
	type InteractionReplyOptions,
	Message,
	type MessageCreateOptions,
	type MessageReplyOptions,
	type ModalSubmitInteraction,
	type User,
	type InteractionEditReplyOptions,
	type ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import type { ExtendedClient } from "../client";
import { t } from "./I18n";
import { V2Helper, type V2Options } from "../utils/V2Helper";

type Interaction =
	| CommandInteraction
	| ButtonInteraction
	| AnySelectMenuInteraction
	| ModalSubmitInteraction;

export default class Context {
	public ctx: Interaction | Message;
	public interaction: Interaction | null;
	public message: Message | null;
	public id: string;
	public channelId: string;
	public client: ExtendedClient;
	public author: User;
	public channel: GuildTextBasedChannel;
	public guild: any; 
	public member: GuildMember | null;
	public memberVoiceChannel: Channel | null;
	public targetMessage: Message | null = null;
	public targetUser: User | null = null;
	public response: Message | null = null;
	public deferred = false;
	public replied = false;
	public prefix = "";
	public lng = "en-US";
	public command: any = null;

    public t(key: any, options?: any): string {
        return t(key, { ...options, lng: this.lng });
    }

    public locale(key: any, options?: any): string {
        return this.t(key, options);
    }

    public get isInteraction(): boolean {
        return !!this.interaction;
    }

    public get options(): any {
        if (this.interaction) {
            return (this.interaction as ChatInputCommandInteraction).options;
        }
        // Mock options for prefix commands with improved argument indexing
        const args = (this.ctx as any).args || [];
        const commandOptions = this.command?.options || [];
        const hasSubcommands = commandOptions.some((o: any) => o.type === 1 || o.type === 2);
        const offset = hasSubcommands ? 1 : 0;

        const getOptionIndex = (name: string, providedIndex?: number) => {
            if (providedIndex !== undefined && providedIndex !== 0) return providedIndex + offset;
            const foundIndex = commandOptions.findIndex((o: any) => o.name === name);
            return (foundIndex !== -1 ? foundIndex : 0) + offset;
        };

        return {
            getString: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                if (!args[idx]) return null;
                
                // If it's the last option in the command definition, join the rest of the arguments
                const optIndexInDef = commandOptions.findIndex((o: any) => o.name === name);
                if (optIndexInDef !== -1 && optIndexInDef === commandOptions.length - 1) {
                    return args.slice(idx).join(' ');
                }
                return args[idx];
            },
            getInteger: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                return args[idx] ? parseInt(args[idx]) : null;
            },
            getBoolean: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                return args[idx] === 'true';
            },
            getUser: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                const id = args[idx]?.replace(/[<@!>]/g, '');
                return id ? this.client.users.cache.get(id) || null : null;
            },
            getMember: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                const id = args[idx]?.replace(/[<@!>]/g, '');
                return id ? this.guild?.members.cache.get(id) || null : null;
            },
            getChannel: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                const id = args[idx]?.replace(/[<#>]/g, '');
                return id ? this.guild?.channels.cache.get(id) || null : null;
            },
            getRole: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                const id = args[idx]?.replace(/[<@&>]/g, '');
                return id ? this.guild?.roles.cache.get(id) || null : null;
            },
            getMentionable: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                return args[idx] || null;
            },
            getNumber: (name: string, index?: number) => {
                const idx = getOptionIndex(name, index);
                return args[idx] ? parseFloat(args[idx]) : null;
            },
            getAttachment: (name: string) => null,
            getSubcommand: () => hasSubcommands ? args[0] || null : null,
            getSubcommandGroup: () => null,
        };
    }

    public get createdTimestamp(): number {
        return this.ctx.createdTimestamp;
    }

	constructor(client: ExtendedClient, ctx: Interaction | Message) {
		this.client = client;
		this.ctx = ctx;
		this.interaction = ctx instanceof Message ? null : ctx;
		this.message = ctx instanceof Message ? ctx : null;
		this.id = ctx.id;
		this.channelId = ctx.channelId ? ctx.channelId : "";
		this.author = ctx instanceof Message ? ctx.author : ctx.user;
		this.channel = ctx.channel as GuildTextBasedChannel;
		this.guild = ctx.guild;
		this.member = ctx.member as GuildMember;
		this.memberVoiceChannel = this.member?.voice?.channel || null;

		if (!(ctx instanceof Message) && ctx.isMessageContextMenuCommand()) {
			this.targetMessage = ctx.targetMessage as Message;
		}
		if (!(ctx instanceof Message) && ctx.isUserContextMenuCommand()) {
			this.targetUser = ctx.targetUser as User;
		}
	}

	public async sendMessage(options: string | MessageCreateOptions | InteractionReplyOptions) {
		if (this.interaction) {
			if (this.interaction.replied || this.interaction.deferred) {
				return await this.interaction.editReply(options as InteractionEditReplyOptions);
			}
            
            if (typeof options === 'object') {
                const opt = options as any;
                if (opt.ephemeral) {
                    const { ephemeral, ...rest } = opt;
                    const existingFlags = rest.flags ? (Array.isArray(rest.flags) ? rest.flags : [rest.flags]) : [];
                    const finalFlags = Array.from(new Set([...existingFlags, MessageFlags.Ephemeral]));
                    const resp = await this.interaction.reply({ ...rest, flags: finalFlags });
                    this.replied = true;
                    return resp;
                }
            }
			const resp = await this.interaction.reply(options as InteractionReplyOptions);
            this.replied = true;
            return resp;
		}
		const response = await this.channel?.send(options as MessageCreateOptions);
        if (response) this.response = response;
        return response;
	}

    public async sendDeferMessage(options: string | MessageCreateOptions | InteractionReplyOptions) {
        return this.sendMessage(options);
    }

	public async editMessage(options: string | MessageCreateOptions | InteractionEditReplyOptions) {
		if (this.interaction) {
			return await this.interaction.editReply(options as InteractionEditReplyOptions);
		}
		if (this.response) {
			return await this.response.edit(options as any);
		}
        // Fallback for logic where editMessage might be called before sendMessage
        if (this.message) {
            const response = await this.channel?.send(options as MessageCreateOptions);
            if (response) this.response = response;
            return response;
        }
	}


	public async deleteMessage() {
		if (this.interaction) {
			return await this.interaction.deleteReply();
		}
		if (this.message) {
			return await this.message.delete();
		}
	}

    // Compat aliases
    public async send(options: any) { return this.sendMessage(options); }
    public async reply(options: any) { return this.sendMessage(options); }
    public async editReply(options: any) { return this.editMessage(options); }
    public async deleteReply() { return this.deleteMessage(); }

	public async deferReply(ephemeral = false) {
		if (this.interaction) {
			const resp = await this.interaction.deferReply({ flags: ephemeral ? [MessageFlags.Ephemeral] : undefined });
            this.deferred = true;
            return resp;
		}
		return null;
	}

    /**
     * Sends a Discord Components V2 message.
     */
    public async sendV2(options: V2Options) {
        const layout = V2Helper.createLayout(options);
        if (options.ephemeral && this.interaction) {
            (layout as any).ephemeral = true;
        }
        return this.sendMessage(layout as any);
    }

    public async replyV2(options: V2Options) {
        return this.sendV2(options);
    }

    /**
     * Edits a Discord Components V2 message.
     */
    public async editMessageV2(options: V2Options) {
        const layout = V2Helper.createLayout(options);
        return this.editMessage(layout as any);
    }

    public async editReplyV2(options: V2Options) {
        return this.editMessageV2(options);
    }

	public async followUp(options: string | InteractionReplyOptions) {
		if (this.interaction) {
			return await this.interaction.followUp(options);
		}
		return await this.channel?.send(options as MessageCreateOptions);
	}
}
