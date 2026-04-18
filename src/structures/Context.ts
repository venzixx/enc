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
	public response: Message | null = null;
	public deferred = false;
	public replied = false;
	public lng = "en-US";

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
        return {
            getString: (name: string, index = 0) => args[index] || null,
            getInteger: (name: string, index = 0) => parseInt(args[index]) || null,
            getBoolean: (name: string, index = 0) => args[index] === 'true',
            getUser: (name: string, index = 0) => args[index]?.replace(/[<@!>]/g, '') || null,
            getMember: (name: string, index = 0) => args[index]?.replace(/[<@!>]/g, '') || null,
            getChannel: (name: string, index = 0) => args[index]?.replace(/[<#>]/g, '') || null,
            getRole: (name: string, index = 0) => args[index]?.replace(/[<@&>]/g, '') || null,
            getMentionable: (name: string, index = 0) => args[index] || null,
            getNumber: (name: string, index = 0) => parseFloat(args[index]) || null,
            getAttachment: (name: string) => null,
            getSubcommand: () => args[0] || null,
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
	}

	public async sendMessage(options: string | MessageCreateOptions | InteractionReplyOptions) {
		if (this.interaction) {
			if (this.replied || this.deferred || this.interaction.replied || (this.interaction as any).deferred) {
                this.replied = true;
				return await this.interaction.editReply(options as InteractionEditReplyOptions);
			}
			this.replied = true;
            if (typeof options === 'object' && (options as any).ephemeral) {
                const { ephemeral, ...rest } = options as any;
                return await this.interaction.reply({ ...rest, flags: [MessageFlags.Ephemeral] });
            }
			return await this.interaction.reply(options as InteractionReplyOptions);
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
			this.deferred = true;
			return await this.interaction.deferReply({ flags: ephemeral ? [MessageFlags.Ephemeral] : undefined });
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
