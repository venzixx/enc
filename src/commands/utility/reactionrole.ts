import { parseEmoji, PermissionFlagsBits } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";

export default class ReactionRole extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'reactionrole',
			description: {
				content: 'Manage reaction roles for a specific message.',
				usage: 'reactionrole <add/remove> <message_id> <emoji> <role>',
				examples: ['reactionrole add 123456789 :âœ…: @Member']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.AddReactions]
			},
			options: [
				{
					name: 'add',
					description: 'Add a reaction role',
					type: 1,
					options: [
						{ name: 'message_id', description: 'The ID of the message', type: 3, required: true },
						{ name: 'emoji', description: 'The emoji', type: 3, required: true },
						{ name: 'role', description: 'The role', type: 8, required: true }
					]
				},
				{
					name: 'remove',
					description: 'Remove a reaction role',
					type: 1,
					options: [
						{ name: 'message_id', description: 'The ID of the message', type: 3, required: true },
						{ name: 'emoji', description: 'The emoji', type: 3, required: true }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const sub = ctx.options.getSubcommand();
		const messageId = ctx.options.getString('message_id');
		const emoji = ctx.options.getString('emoji');

		const targetMsg = await ctx.channel.messages.fetch(messageId).catch(() => null);
		if (!targetMsg) {
			return await ctx.replyV2({ 
                title: 'âŒ Message Not Found', 
                description: 'Could not find that message in this channel. Please ensure the ID is correct and I have access to it.',
                isAlert: true,
                color: client.color.red,
                ephemeral: true
            });
        }

		const parsed = emoji ? parseEmoji(emoji) : null;
		if (!parsed) {
			return await ctx.replyV2({ 
                title: 'âŒ Invalid Emoji', 
                description: 'The emoji provided is invalid or unreachable.',
                isAlert: true,
                color: client.color.red,
                ephemeral: true
            });
        }
		const emojiId = parsed.id ? parsed.id : parsed.name;

		if (sub === 'add') {
			const role = ctx.options.getRole('role');
			await client.prisma.reactionRole.create({
				data: {
					guildId: ctx.guild.id,
					messageId,
					emoji: emojiId,
					roleId: role.id
				}
			});

			await targetMsg.react(emoji).catch(() => {});

            // Retroactive role assignment
            const reaction = targetMsg.reactions.cache.get(emojiId!) || targetMsg.reactions.cache.get(parsed.name!);
            if (reaction) {
                const users = await reaction.users.fetch();
                for (const [id, user] of users) {
                    if (user.bot) continue;
                    const member = await ctx.guild.members.fetch(id).catch(() => null);
                    if (member) await member.roles.add(role.id).catch(() => {});
                }
            }

			await ctx.replyV2({ 
                title: 'âœ… Reaction Role Added', 
                description: `Successfully linked **${emoji}** to the ${role} role for message \`${messageId}\`.\n\n*Note: If there were existing reactors, they have been assigned the role.*`,
                isAlert: true,
                color: client.color.main
            });
		} else {
			await client.prisma.reactionRole.deleteMany({
				where: {
					guildId: ctx.guild.id,
					messageId,
					emoji: emojiId!
				}
			});

			await ctx.replyV2({ 
                title: 'âœ… Reaction Role Removed', 
                description: `Successfully unlinked **${emoji}** from message \`${messageId}\`.`,
                isAlert: true,
                color: client.color.main
            });
		}
	}
}
