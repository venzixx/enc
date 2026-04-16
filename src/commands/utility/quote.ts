import { 
    ApplicationCommandType, 
    MessageContextMenuCommandInteraction, 
    AttachmentBuilder 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { QuoteGenerator } from '../../utils/QuoteGenerator';

export default class QuoteCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'quote',
			description: {
				content: 'Generate a premium image quote from a message.',
				usage: 'quote (reply to a message)',
				examples: ['quote']
			},
			category: 'general',
			cooldown: 10,
			slashCommand: true,
			type: ApplicationCommandType.Message // Enable Context Menu
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		let targetMessage = null;

		// 1. Resolve Target Message
		if (ctx.interaction && ctx.interaction instanceof MessageContextMenuCommandInteraction) {
			// Context Menu Trigger
			targetMessage = ctx.interaction.targetMessage;
		} else {
			// Prefix/Slash Trigger - Check for Reply
			if (ctx.message?.reference?.messageId) {
				try {
					targetMessage = await ctx.channel.messages.fetch(ctx.message.reference.messageId);
				} catch (err) {
					return await ctx.replyV2({
                        description: '❌ I couldn\'t fetch the message you replied to.',
                        isAlert: true,
                        color: client.color.red
                    });
				}
			}
		}

		if (!targetMessage) {
			return await ctx.replyV2({
                description: '❌ Please **reply** to the message you want to quote, or use the right-click menu!',
                isAlert: true,
                color: client.color.red
            });
		}

		if (!targetMessage.content && !targetMessage.attachments.size) {
			return await ctx.replyV2({
                description: '❌ That message has no text to quote!',
                isAlert: true,
                color: client.color.red
            });
		}

        await ctx.deferReply();

		try {
			// 2. Generate Image
			const content = targetMessage.content || "(Image/Attachment)";
			const author = targetMessage.author;
			const avatarUrl = author.displayAvatarURL({ extension: 'png', size: 512 });

			const buffer = await QuoteGenerator.generate(
                content, 
                author.displayName || author.username, 
                `@${author.username}`, 
                avatarUrl
            );

			const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });

            // 3. Send
			return await ctx.sendMessage({ 
                files: [attachment] 
            });

		} catch (error) {
			console.error('Quote Command Error:', error);
			return await ctx.replyV2({
                description: '❌ Something went wrong while generating the quote.',
                isAlert: true,
                color: client.color.red
            });
		}
	}
}
