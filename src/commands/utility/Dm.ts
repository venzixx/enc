import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    GuildMember,
    MessageFlags
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { PlaceholderManager } from '../../utils/PlaceholderManager';
import { isDev } from '../../utils/devCheck';

export default class Dm extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'dm',
			description: {
				content: 'Direct message a user with text or a saved embed.',
				usage: 'dm <user> <text | [embedID]>',
				examples: ['dm @User Hello there!', 'dm 865906211948724226 [welcome_rules]']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [],
				client: [PermissionFlagsBits.EmbedLinks]
			},
			options: [
				{
					name: 'user',
					description: 'The user to send the DM to',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'content',
					description: 'The text content or saved embed in brackets (e.g. [embedID])',
					type: ApplicationCommandOptionType.String,
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply(true);

		const cleanUp = async (replyMsg: any) => {
			if (ctx.message) {
				await ctx.message.delete().catch(() => {});
				if (replyMsg && typeof replyMsg.delete === 'function') {
					setTimeout(async () => {
						await replyMsg.delete().catch(() => {});
					}, 5000); // 5 seconds
				}
			}
		};

		// Check authorization: User must have MANAGE_MESSAGES permission OR be a registered developer
		const hasPerm = ctx.member?.permissions.has(PermissionFlagsBits.ManageMessages);
		const developer = await isDev(client, ctx.author.id);

		if (!hasPerm && !developer) {
			const replyMsg = await ctx.replyV2({ 
				description: `${client.emoji.cross} You do not have permission to use this command.`, 
				color: client.color.red, 
				isAlert: true 
			});
			await cleanUp(replyMsg);
			return replyMsg;
		}

		const targetMember = await Resolver.resolveMember(ctx);
		const targetUser = targetMember ? targetMember.user : await Resolver.resolveUser(ctx);

		if (!targetUser) {
			const replyMsg = await ctx.replyV2({ 
                description: `${client.emoji.cross} Could not resolve that user. Please provide a valid mention or user ID.`, 
                color: client.color.red, 
                isAlert: true 
            });
			await cleanUp(replyMsg);
			return replyMsg;
		}

		let rawContent = ctx.options.getString('content') || args.slice(1).join(' ');
		if (!rawContent) {
			const replyMsg = await ctx.replyV2({ 
                description: `${client.emoji.cross} Please provide a message or \`[embedID]\` to send.`, 
                color: client.color.red, 
                isAlert: true 
            });
			await cleanUp(replyMsg);
			return replyMsg;
		}

		rawContent = rawContent.trim();

		// Check if it's a saved embed reference, e.g. [welcome_rules]
		const embedMatch = rawContent.match(/^\[(.+?)\]$/);
		
		let messagePayload: any = { content: rawContent };

		if (embedMatch) {
			const embedTag = embedMatch[1];
			// Check if this saved embed actually exists in the database
			const savedEmbed = await client.prisma.savedEmbed.findUnique({
				where: {
					guildId_tag: {
						guildId: ctx.guild.id,
						tag: embedTag
					}
				}
			});

			if (!savedEmbed) {
				const replyMsg = await ctx.replyV2({ 
					description: `${client.emoji.cross} Could not find a saved embed with tag \`${embedTag}\` in this server.`, 
					color: client.color.red, 
					isAlert: true 
				});
				await cleanUp(replyMsg);
				return replyMsg;
			}

			// We use PlaceholderManager to resolve it.
			let resolverMember = targetMember;
			if (!resolverMember) {
				// If target is not in the guild, fallback to utilizing the command author's member object
				resolverMember = ctx.member as GuildMember;
			}

			try {
				// Convert [embedTag] reference to {embedTag} so PlaceholderManager can find and resolve it
				const placeholderText = `{${embedTag}}`;
				const resolved = await PlaceholderManager.resolve(client, placeholderText, resolverMember, ctx.guild);
				
				messagePayload = {
					content: resolved.content || undefined,
					embeds: resolved.embeds,
					components: resolved.components
				};
			} catch (err: any) {
				const replyMsg = await ctx.replyV2({ 
					description: `${client.emoji.cross} Failed to resolve saved embed: ${err.message}`, 
					color: client.color.red, 
					isAlert: true 
				});
				await cleanUp(replyMsg);
				return replyMsg;
			}
		}

		try {
			if (messagePayload.content && !embedMatch) {
				messagePayload.content += `\n\n-# Sent by **${ctx.author.username}** via **${ctx.guild?.name || 'Discord'}**`;
			}
			await targetUser.send(messagePayload);
			const replyMsg = await ctx.replyV2({ 
				description: `${client.emoji.success} Successfully sent direct message to **${targetUser.tag}**!`, 
				color: client.color.green 
			});
			await cleanUp(replyMsg);
			return replyMsg;
		} catch (error: any) {
			console.error(`Failed to DM user ${targetUser.id}:`, error);
			const replyMsg = await ctx.replyV2({ 
				description: `${client.emoji.cross} Failed to DM **${targetUser.tag}**: ${error.message}. They may have their DMs closed, or have blocked the bot.`, 
				color: client.color.red, 
				isAlert: true 
			});
			await cleanUp(replyMsg);
			return replyMsg;
		}
	}
}
