import { AttachmentBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import GIFEncoder from 'gif-encoder-2';
import { fetch } from 'undici';

export default class Gif extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'gif',
			aliases: [],
			description: {
				content: 'Convert a replied-to image (or uploaded image) to GIF format.',
				usage: 'gif',
				examples: ['gif']
			},
			category: 'utility',
			cooldown: 5,
			slashCommand: false,
			hidden: true
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const msg = ctx.message;
		if (!msg) return;

		let targetMsg: any = msg;

		// If this is a reply, fetch the referenced message
		if (msg.reference?.messageId) {
			const fetched = await ctx.channel.messages.fetch(msg.reference.messageId).catch(() => null);
			if (fetched) {
				targetMsg = fetched;
			}
		}

		// Find image URL from targetMsg (or fallback to original message if targetMsg doesn't have one)
		let imageUrl = this.getImageUrl(targetMsg);
		if (!imageUrl && targetMsg.id !== msg.id) {
			imageUrl = this.getImageUrl(msg);
		}

		if (!imageUrl) {
			return await ctx.replyV2({
				description: `${client.emoji.cross} Please reply to a message containing an image, or attach/link an image with the command.`,
				isAlert: true
			});
		}

		await ctx.deferReply();

		try {
			// Fetch the image
			const res = await fetch(imageUrl);
			if (!res.ok) {
				return await ctx.replyV2({
					description: `${client.emoji.cross} Failed to download the target image.`,
					isAlert: true
				});
			}

			const arrayBuffer = await res.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// Load into canvas
			const img = await loadImage(buffer);

			// We cap the canvas size at 1500x1500 to prevent OOM errors for massive images
			let width = img.width;
			let height = img.height;
			const maxDimension = 1500;

			if (width > maxDimension || height > maxDimension) {
				const ratio = Math.min(maxDimension / width, maxDimension / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			const canvas = createCanvas(width, height);
			const ctx2d = canvas.getContext('2d');
			ctx2d.drawImage(img, 0, 0, width, height);

			// Initialize GIF Encoder
			const encoder = new GIFEncoder(width, height);
			encoder.start();
			encoder.setRepeat(0); // 0 = loop forever
			encoder.setDelay(500); // 500ms frame delay
			encoder.setQuality(10); // 10 = default (lower is better quality but slower)

			// Add frames
			encoder.addFrame(ctx2d as any);
			encoder.addFrame(ctx2d as any); // Add twice to make a valid loopable GIF

			encoder.finish();
			const gifBuffer = encoder.out.getData();

			const attachment = new AttachmentBuilder(gifBuffer, { name: 'image.gif' });
			return await ctx.reply({ files: [attachment] });
		} catch (error) {
			console.error('GIF command error:', error);
			return await ctx.replyV2({
				description: `${client.emoji.cross} An error occurred while converting the image to GIF.`,
				isAlert: true
			});
		}
	}

	private getImageUrl(message: any): string | null {
		// 1. Check attachments
		if (message.attachments && message.attachments.size > 0) {
			const attachment = message.attachments.find((att: any) => att.contentType?.startsWith('image/'));
			if (attachment) return attachment.url;
		}

		// 2. Check embeds
		if (message.embeds && message.embeds.length > 0) {
			const embed = message.embeds.find((emb: any) => emb.image || emb.thumbnail);
			if (embed) return embed.image?.url || embed.thumbnail?.url || null;
		}

		// 3. Check raw URLs in message content
		if (message.content) {
			const urlRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif))/i;
			const match = message.content.match(urlRegex);
			if (match) return match[1];
		}

		return null;
	}
}
